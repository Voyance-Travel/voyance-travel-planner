## Bug

Card descriptions on Day 3 contain the literal field name:

> "...comply with the basilica's strict dress code. **reservationUrgency: .**"

The internal JSON key (camelCase, no space) is being echoed by the model into `description` / `tips`, then rendered to users.

## Root cause

Every existing scrub layer matches only the spaced, capitalized prompt label `Reservation Urgency:` — none of them match the camelCase JSON key `reservationUrgency:`.

- `supabase/functions/_shared/prompt-leak-scrub.ts` → `RESERVATION_LABEL_LEAK_RE = /\b(?:Reservation|Booking)\s+(?:Urgency|Window|Lead\s*Time)…/` requires whitespace between the two words.
- `src/utils/activityNameSanitizer.ts` → identical regex, same gap.
- `ORPHAN_EMPTY_LABEL_RE` requires the label to start with an uppercase letter (`[A-Z]`), so `reservationUrgency` (lowercase `r`) is also missed.
- DB trigger `scrub_itinerary_prompt_artifacts` (migration `20260508193734…`) doesn't list this label at all.

So a generation that emits `reservationUrgency: .` slips past validate-day, repair-day §10b, action-save-itinerary, the UI sanitizer, and the DB trigger — all five gates.

## Fix (plan)

### 1. Extend the shared regex to cover camelCase + snake_case keys
In `supabase/functions/_shared/prompt-leak-scrub.ts`, broaden `RESERVATION_LABEL_LEAK_RE` so it matches all four shapes in one alternation:

- `Reservation Urgency:` / `Booking Urgency:` / `Booking Window:` / `Lead Time:` (existing)
- `reservationUrgency:` / `bookingUrgency:` / `bookingWindow:` / `leadTime:` (camelCase, **new**)
- `reservation_urgency:` / `booking_window:` / `lead_time:` (snake_case, **new**)

Pattern sketch (case-insensitive, anchored on word boundary, value tolerates empty / `.` / any non-period text up to next sentence):

```
/\b(?:reservation[_\s]?urgency|booking[_\s]?(?:urgency|window)|lead[_\s]?time)\s*:\s*[^.\n]*\.?/gi
```

Apply the same pattern to:
- `src/utils/activityNameSanitizer.ts` (`RESERVATION_LABEL_LEAK_RE` constant — keep the two copies in sync)
- The DB trigger in a new migration (add this regex to the body/title scrub list inside `scrub_itinerary_prompt_artifacts`).

### 2. Loosen ORPHAN_EMPTY_LABEL_RE to accept camelCase keys
Change the leading character class from `[A-Z][A-Za-z]` to `[A-Za-z][A-Za-z]`, so `reservationUrgency: .` and similar lowercase-first JSON keys are stripped as orphan empty labels too. Mirror in both shared file and `activityNameSanitizer.ts`.

### 3. Detector + JSON field cleanup
- Update `hasBodyPromptLeak` / `hasTitleLeak` automatically (they reuse the same regexes).
- `scrubTitleLeaks` already deletes empty/leak-shaped `reservationUrgency` JSON values; extend the leak-shape check to also match the camelCase form (`/^reservation[_]?urgency\s*:/i`).

### 4. Tests
Add cases to `supabase/functions/_shared/__tests__/prompt-leak-scrub.test.ts`:
- `description: 'Wear waterproof footwear. reservationUrgency: .'` → stripped
- `tips: 'Cover shoulders. reservationUrgency:.'` → stripped
- `description: 'Book ahead. booking_window: .'` → stripped
- Regression: `'Reservation: required for brunch.'` still preserved.

Add the same camelCase case to `src/utils/__tests__/activityNameSanitizer.artifacts.test.ts`.

### 5. One-shot DB cleanup
The new migration also runs a single `UPDATE trips SET itinerary_data = scrub_itinerary_prompt_artifacts_payload(itinerary_data)` (or equivalent inline `jsonb_set` walk) so existing trips with the leak — including the live Day 3 example — are fixed without requiring regeneration.

## Files touched
- `supabase/functions/_shared/prompt-leak-scrub.ts`
- `src/utils/activityNameSanitizer.ts`
- `supabase/functions/_shared/__tests__/prompt-leak-scrub.test.ts`
- `src/utils/__tests__/activityNameSanitizer.artifacts.test.ts`
- New migration: extend `scrub_itinerary_prompt_artifacts` regex list + one-shot backfill UPDATE
- `mem://constraints/itinerary/reservation-urgency-prompt-leak` (note camelCase variant added)
