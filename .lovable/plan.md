# "Reservation Urgency: ." trailing-period leak in activity body

## What the user sees

A Wellness Session card on Day 1 renders a line:

```
Reservation Urgency: .
```

Trailing period, blank value — a classic prompt-template leak.

## Root cause

The generator wires `buildReservationUrgencyPrompt()` (`reservation-urgency.ts:132`) into the system prompt at two sites:

- `action-generate-trip.ts:332-340` (full-trip path)
- `generation-core.ts:890` (per-day path), composed at `generation-core.ts:903`

The prompt header reads `RESERVATION URGENCY REQUIREMENTS` and instructs the model to emit a JSON field `"reservationUrgency"`. It NEVER asks for the literal label "Reservation Urgency: " to appear in user-facing text. The model is bleeding the prompt label into the activity `description` / `tips` body — sometimes with a value, sometimes (as here) as a bare `Reservation Urgency: .` orphan.

Why nothing strips it today:

1. **`pipeline/validate-day.ts:checkLabelLeaks`** only scans `title`, not `description` / `tips` / `notes`. So `TITLE_LABEL_LEAK` repair never fires for body leaks.
2. **`src/utils/activityNameSanitizer.ts:sanitizeActivityText`** has a long strip list (`SYSTEM_LABEL_RE`, `SLOT_PREFIX_RE`, `PROMPT_ARTIFACT_REPLACE_RE`, etc.) but no pattern for `Reservation Urgency:` or other AI-echoed prompt headers (e.g. `Booking Urgency:`, `Reservation Window:`, `Booking Window:`).
3. **No backend scrub on description/tips** — `repair-day.ts` only scrubs titles and times. The bad string is persisted to `itinerary_activities.description` / `.tips` and surfaces every render.

## Fix — defense in depth across the same surfaces we use for other prompt-leak bugs

### Layer 1 — UI sanitizer (immediate heal for already-persisted data)

`src/utils/activityNameSanitizer.ts:sanitizeActivityText`:

- Add `RESERVATION_LABEL_LEAK_RE` matching the bare prompt label (with optional value):
  - `\b(?:Reservation|Booking)\s+(?:Urgency|Window|Lead\s*Time)\s*:\s*[^.\n]*\.?` — strips the entire `Label: …` segment up to the next sentence boundary.
- Add an **orphan key:value scrubber** that catches any line/segment shaped `^\s*[A-Z][A-Za-z ]{2,40}\s*:\s*\.?\s*$` (label followed by nothing or just a period). Conservative whitelist — only when the value is empty or a lone punctuation mark — so we never eat real `"Note: closed Mondays."` content.
- Wire both into the existing `.replace(...)` chain right after `PROMPT_ARTIFACT_REPLACE_RE` and before the whitespace squash.
- Update `src/utils/__tests__/activityNameSanitizer.artifacts.test.ts` with three cases:
  - `"Soothing massage. Reservation Urgency: ."` → `"Soothing massage."`
  - `"Reservation Urgency: book_soon. Spa with hammam."` → `"Spa with hammam."`
  - Real content `"Reservation: required for Sunday brunch."` is preserved (singular `Reservation:` ≠ template label).

### Layer 2 — Backend pre-persist scrub (kill at the source)

`supabase/functions/generate-itinerary/pipeline/repair-day.ts`:

- Add a small `scrubBodyPromptLeaks(act)` helper near the existing `TITLE_LABEL_LEAK` block (~line 2499) that strips the same `RESERVATION_LABEL_LEAK_RE` plus the orphan-key:value pattern from `description`, `tips`, `insiderTip`, `notes`, `details`. Use the same regexes shared with the UI to keep behavior aligned (extract to `_shared/prompt-leak-scrub.ts`).
- Run it inside the existing day repair loop, push a repair entry `action: 'scrubbed_body_prompt_leak'` for observability.

`supabase/functions/generate-itinerary/action-save-itinerary.ts`:

- Apply the same shared scrub at JSON snapshot time (next to the existing pre-dawn / bookend sweeps), so legacy days flowing through save also self-heal.

### Layer 3 — Validator widening

`supabase/functions/generate-itinerary/pipeline/validate-day.ts:checkLabelLeaks`:

- Extend the loop to also scan `description`, `tips`, `notes` against a new `BODY_LABEL_LEAK_PATTERNS` set (same `RESERVATION_LABEL_LEAK_RE` + orphan-key:value).
- When found, raise `FAILURE_CODES.TITLE_LABEL_LEAK` with the field name; the repair pass calls the shared scrub.

### Layer 4 — (Optional, low-risk) Prompt hardening

`supabase/functions/generate-itinerary/reservation-urgency.ts:buildReservationUrgencyPrompt`:

- Append one line: `IMPORTANT: Do NOT include the words "Reservation Urgency" or this section's labels anywhere in user-facing description, tips, or notes — only in the JSON "reservationUrgency" field.` Keeps future regressions less likely.

## Files to edit

- New: `supabase/functions/_shared/prompt-leak-scrub.ts` — shared regex + `scrubBodyPromptLeaks(act)` helper used by repair, save, and validator.
- Edit: `src/utils/activityNameSanitizer.ts` — add reservation-label + orphan-key:value strip in `sanitizeActivityText`.
- Edit: `src/utils/__tests__/activityNameSanitizer.artifacts.test.ts` — add the three scenarios above.
- Edit: `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — call shared scrub in the body-leak repair step.
- Edit: `supabase/functions/generate-itinerary/pipeline/validate-day.ts` — widen `checkLabelLeaks` to scan body fields.
- Edit: `supabase/functions/generate-itinerary/action-save-itinerary.ts` — final body-leak sweep next to existing predawn/bookend sweeps.
- Edit: `supabase/functions/generate-itinerary/reservation-urgency.ts` — one-line prompt hardening.
- New tests:
  - `supabase/functions/_shared/__tests__/prompt-leak-scrub.test.ts` — covers `Reservation Urgency: .` strip, value-bearing strip, false-positive guard for legit `"Reservation: required for X."`.

## Memory

Add `mem://constraints/itinerary/reservation-urgency-prompt-leak`:
- Prompt label `Reservation Urgency:` (and siblings `Booking Urgency`, `Reservation Window`, `Booking Window`) MUST NEVER appear in user-facing description/tips. Stripped by shared `scrubBodyPromptLeaks` (server) + `sanitizeActivityText` (UI).
- Orphan `Label: .` key:value patterns with empty/dot value are stripped at all 3 surfaces.
- Sentinel: `repair.action='scrubbed_body_prompt_leak'`.

Update `mem://index.md` Core to add a one-liner: "Prompt-template labels (`Reservation Urgency:` etc.) never live in description/tips — shared `scrubBodyPromptLeaks` enforces at validate / repair / save / UI."
