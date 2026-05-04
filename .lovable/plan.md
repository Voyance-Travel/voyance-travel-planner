## Root cause

`budget-coach` sends the itinerary to Gemini and trusts whatever IDs/titles come back. Two failure modes:

1. **Hallucinated `current_item` titles.** The post-filter only checks `activity_id` against `dismissedSet` and `protectedActivityIds`. It NEVER verifies the ID belongs to the itinerary at all. If the model invents an ID (or reuses an ID but writes a fabricated `current_item` like "Lunch at L'Atelier de Joël Robuchon"), the suggestion is rendered as-is. The UI shows `s.current_item` (the AI's free-text), not the real activity title.

2. **Stale/out-of-range IDs survive.** When the itinerary has only ~3 swappable items per day with $0 cost (free venues), the model fills the requested 5–8 slots by inventing items. Free venues are stripped from `activityCostCentsById` (because cost === 0), so even the cost-floor guard `newCostCents >= currentCostCents` passes — `currentCostCents` falls back to the AI's own `current_cost`, which it also invented.

For the user's Paris trip: of 25 cost rows, 4 are `[Free venue]` (cost 0) and the rest are mostly $25–$65. The Robuchon, Frenchie, Le Jardin, etc. don't exist in the trip — Gemini hallucinated a "luxury Paris itinerary" template.

## Fix

Two strict server-side guards in `supabase/functions/budget-coach/index.ts`. No DB changes, no client changes.

1. **ID-must-exist guard.** Build `allValidIds = Set<string>` from the full itinerary. Drop any suggestion whose `activity_id` is not in that set. Log it.

2. **Title-must-match guard.** Build `activityTitleById`. For each suggestion, normalize both the AI's `current_item` and the real activity title (lowercase, strip punctuation) and require either:
   - real title contains the AI's `current_item` substring, OR
   - AI's `current_item` contains the real title substring, OR
   - token overlap ≥ 60% (cheap Jaccard on word tokens ≥ 4 chars).

   Otherwise drop. This catches the case where the model reuses a real ID but writes a fabricated title for the user-visible card.

3. **Force-overwrite the rendered title.** Replace `current_item` in the returned suggestion with the actual activity title from the itinerary, so even if the model's text is slightly off the user sees the real itinerary item.

4. **Drop $0 / unknown-cost items entirely from what's sent to the model** (they shouldn't be candidates for "make cheaper" anyway). This shrinks the swappable pool and makes the model more likely to pick real items instead of inventing.

## Files touched

- `supabase/functions/budget-coach/index.ts` — add `allValidIds` and `activityTitleById`, add ID-existence + title-match guards in the post-filter, overwrite `current_item` with the real title, filter `cost <= 0` out of the prompt summary.

## Validation

After fix, re-running budget-coach on the Paris trip (4 free venues, ~21 priced items) should:
- Never return Robuchon/Frenchie/Le Jardin etc. — none have matching IDs.
- If model still invents, every invented suggestion is dropped server-side and logged with `→ FILTERED OUT (unknown activity_id)` or `→ FILTERED OUT (title mismatch)`.
- Suggestions that survive will render with the actual itinerary item title in the UI.
