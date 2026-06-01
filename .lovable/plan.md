# Fix: 2h 59m "Walk to Hotel" survives airport-transfer repair

## Root cause (confirmed)

In `supabase/functions/generate-itinerary/pipeline/repair-day.ts` §3b (lines ~1036–1245):

- `isAirportTransferCard(a, idx)` only treats a free-form transit card in the first 3 slots as the airport transfer when **both** `TRANSIT_VERB_RE` matches **and** `matchesHotelDestination(title)` returns true.
- `matchesHotelDestination` requires either a generic word (`hotel|inn|resort|…`) after "to", or the full lowercased `hotelName` to appear as a substring (≥4 chars).
- When the LLM emits `"Walk to Balmoral"` but the stored hotel is `"The Balmoral, a Rocco Forte hotel"`, the substring check fails. `existingTransferIdx === -1`, so the **INJECT** branch runs.
- The INJECT branch (1218–1245) inserts a fresh locked transfer card at index 1 but — unlike the RECONCILE branch — has **no dedupe sweep**. The original AI walk card stays in the day with its 2h 59m duration. Both cards persist; the user sees the walk first.

## Fix (frontend-of-pipeline / repair only — no behavior change for healthy days)

Two surgical changes, both inside §3b in `repair-day.ts`:

1. **Broaden detection.** Replace the strict `matchesHotelDestination` gate with a looser "first-3-slots transit card sitting before any non-logistics activity" heuristic:
   - Still require `idx < 3` and a transport-ish category + `TRANSIT_VERB_RE` title.
   - Drop the hotel-name substring requirement. Day-1 arrival has exactly one airport→lodging transfer; any unlocked transit card in those slots that isn't already classified as something else (sightseeing, dining, etc.) is it.
   - Keep an explicit **exclusion**: skip cards whose title resolves to a non-hotel POI (already covered by category gate, but add a guard for `tour|museum|gallery|landmark` in title to be safe).
   - Keep the existing generic-word and full-hotel-name matches as fast paths so logs still attribute correctly.

2. **Symmetric dedupe in INJECT branch.** Mirror lines 1195–1210: after inserting the fresh transfer card at index 1, sweep the first ~5 slots and drop any other unlocked transit card whose title matches `TRANSIT_VERB_RE` (including the bogus walk). Skip locked rows except those already tagged `anchorSource === 'airport-transfer'`.

Add a `[Repair §3b]` log line per dropped duplicate so we can verify in edge-function logs.

## Test

Add `supabase/functions/generate-itinerary/__tests__/airport-transfer-walk-dedupe.test.ts` covering:
- LLM emits `"Walk to Balmoral"` (partial hotel name) + repair runs → reconciled, no second card.
- LLM emits `"Walk to The Old Town"` (non-hotel POI) + arrival → INJECT runs, POI walk untouched.
- LLM emits both `"Walk to Hotel"` and a separate dinner → reconcile path dedupes correctly (regression guard for the existing case).
- Idempotent on second run.

## Files

- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — modify `matchesHotelDestination` / `isAirportTransferCard` and add dedupe to the INJECT branch (~30 lines).
- `supabase/functions/generate-itinerary/__tests__/airport-transfer-walk-dedupe.test.ts` — new test file.

## Out of scope

- `getAirportTransferMinutes()` lookup (works correctly).
- Cascade clamp / save-time nets (already wired).
- Bug 2 in the user's message is not addressed here — confirm before expanding scope.

## Open question

The user described "Bug 1" only. Should I also plan Bug 2 in the same pass, or ship this fix first? (No "Bug 2" details were included in this message.)
