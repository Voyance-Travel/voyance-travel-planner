## Problem

In Day 02 (Amsterdam), a recent chat ask produced three bugs:

1. **Van Gogh Museum was "thrown on top"** — it has an image, price, duration, and a lock icon, but **no startTime** and **no description**. The chronological sort pushes timeless cards to the top of the day, above Omelegg at 08:30.
2. **Omelegg breakfast applied cleanly** — proving the executor itself worked, but the model emitted Van Gogh as a bare locked anchor (the same "Soft vs Hard User-Intent" pattern memory already mitigates for chips, not for chat-driven `rewrite_day`).
3. **"Canal tour" was silently dropped** — the model didn't include it and nothing in the executor verified that every user-named ask actually landed in the new day.

Result: the user sees one success, one untimed locked stub, and one missing item, with a green "applied" toast that lies about coverage.

## Plan

### 1. Catch untimed new locks at the executor boundary

In `src/services/itineraryActionExecutor.ts → executeRewriteDayAction` (and the same shape inside swap / regenerate), after the AI returns `newActivities`:

- Identify rows that are **new** (not in `day.activities` by id) AND `locked || protected` AND missing `startTime/endTime`.
- For each, run the existing `fillMissingStartTimes` helper from `_shared/timing-cascade.ts` (port already used at parse/save). If the row still has no usable anchor, assign a believable slot using the surrounding timed activities (insert into the largest gap ≥ duration, or default to a category-typed slot: museum → 10:00, dining → meal band, tour → afternoon).
- Stamp `needsAnchorEnrichment: true` + `anchorSource: 'chat-added'` so the existing anchor-enrichment path backfills description/address on the next read.

This keeps the fix in frontend executor code — no generator prompt changes — and prevents the "thrown on top" visual regression at the source.

### 2. Verify every user-named ask actually landed

Still in `executeRewriteDayAction`, before persisting:

- Extract candidate intents from `instructions` using a lightweight tokenizer (already have `intentsFromUserAnchors` in `src/utils/userAnchors.ts`; reuse or wrap it). For `"do flight and hotel, add a canal tour"` this yields `['flight','hotel','canal tour']`.
- Match each intent against `newActivities` using title/category/keyword (e.g. `canal tour` → title or description contains `canal` AND category in `tour|activity|sightseeing`).
- Collect `missingIntents` for any intent with zero match.
- If `missingIntents.length > 0`:
  - Return `success: true` but include a structured `partial: { missing: [...] }` field and rewrite the toast copy to `"Applied N changes — couldn't fit: canal tour. Ask me to try again."` instead of the unconditional green confirm.

### 3. Surface the partial result in the chat UI

In `src/components/itinerary/ItineraryAssistant.tsx` (the consumer of executor results):

- When `result.partial?.missing` is present, render a one-line follow-up: `"I missed: canal tour. Want me to retry just that?"` with a retry chip that re-fires `rewrite_day` scoped to the missing intents only.

### 4. Regression coverage

Add `src/services/__tests__/itineraryActionExecutor.rewriteDay.test.ts`:

- Case A: AI returns a new locked activity without startTime → executor assigns a slot, marks `needsAnchorEnrichment`, never persists with `startTime==null`.
- Case B: instructions mention "canal tour" but AI omits it → executor returns `partial.missing = ['canal tour']` and message reflects it; persist still happens for the rest.
- Case C: all intents matched → no `partial` field, classic success.

### 5. Memory

Append a short rule to `mem://constraints/itinerary/soft-vs-hard-user-intent`: "Chat `rewrite_day` results MUST run intent-coverage check + untimed-new-lock backfill in the executor before persist; otherwise free-text asks silently disappear and locked anchors land untimed at top-of-day."

## Out of scope

- No changes to the generator prompt or `generate-itinerary` edge function — the executor is the right chokepoint and a smaller, lower-risk surface.
- No changes to the universal locking contract — chat-added locks remain locked; we only fix their timing and verify coverage.

## Files touched (estimated)

- `src/services/itineraryActionExecutor.ts` — add untimed-lock backfill + intent-coverage check
- `src/utils/userAnchors.ts` — small export tweak if `intentsFromUserAnchors` isn't already callable from the executor
- `src/components/itinerary/ItineraryAssistant.tsx` — render `partial.missing` follow-up
- `src/services/__tests__/itineraryActionExecutor.rewriteDay.test.ts` — new
- `mem://constraints/itinerary/soft-vs-hard-user-intent` — append rule
