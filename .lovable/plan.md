# Transit duration sanity check in repair-day

Add a sanity guard immediately after the `pickTransitTier` / `pickTransitFallback` call in `supabase/functions/generate-itinerary/pipeline/repair-day.ts` (~line 3759–3761) to catch implausible transit durations caused by coord-parse failures.

## Change

After the existing `let tier = derivedDist > 0 ? pickTransitTier(...) : pickTransitFallback(...)` statement, insert the sanity block from the spec:

- Detect airport/terminal/gate via title regex.
- Non-airport: if `durationMinutes < 8` AND (`derivedDist === 0` OR `derivedDist > 1500`) → log `[transit-sanity] Implausibly short tier …` and replace with `pickTransitFallback(null, 20, destName)` (Rome 5-min walk for 6.6km bug).
- Airport: if `durationMinutes > 120` → log `[transit-sanity] Airport transfer inflated …`, cap `durationMinutes = 75`, rewrite `instructions` to `Transfer to {destName|'airport'} (~75 min by taxi)` (inverse 210-min bug).

Block contains the literal comment `Rome regression:` for grep acceptance.

## Out of scope

- No edits to `pickTransitTier`, `pickTransitFallback`, or the water-crossing override block below.
- No changes to `extractCoords` or upstream haversine logic.

## Acceptance

All 4 greps in the spec pass; post-deploy Rome Day 1 connector ≥20 min, Day 3 airport transfer ≤75 min, edge logs contain `[transit-sanity]` entries.
