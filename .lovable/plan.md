## Plan: stop selected attractions from being falsely marked covered

### What I found
- The Buenos Aires trip does contain injected cards for **Recoleta Cemetery** and **San Telmo Market** in stored JSON, but they overlap other activities/meals and can be hidden or made unusable in the visible schedule.
- The current must-do coverage check is too optimistic: it marks an attraction as scheduled when the text exists in JSON, even if the matched card is a **transport row**, a **neighborhood walk**, or an **overlapping injected card** that does not survive as a believable visible activity.
- Example: **Teatro Colón** was counted via `Travel to Teatro Colón` instead of the actual visit card. That same weakness can let “Recoleta neighborhood walk” satisfy “Recoleta Cemetery” class requests.

### Fixes to implement
1. **Harden must-do coverage matching**
   - Update `assert-must-do-coverage.ts` so transport/logistics/accommodation rows cannot satisfy a selected attraction.
   - Require stronger matching for venue-like selections: `Recoleta Cemetery` should not match generic `Recoleta Neighborhood Walk`.
   - Add explicit Buenos Aires aliases for `Teatro Colón`, `Recoleta Cemetery`, `Caminito`, and `San Telmo Market`.

2. **Treat conflicting injected must-dos as not covered**
   - Add a post-coverage visibility/schedule viability check: if a matched must-do card overlaps another real non-transit activity or meal, demote it back to `missing` instead of stamping `missing=[]`.
   - This will force the existing retry/failure path to surface the problem honestly rather than silently claiming coverage.

3. **Prevent new injected must-dos from landing on top of real activities**
   - Tighten `schedule-must-dos.ts` so must-do injections treat dining and real activity blocks as hard busy windows, not only locked rows.
   - Keep transport flexible, but don’t place selected attractions over meals or already scheduled experiences.

4. **Add regression tests**
   - Coverage test: `Recoleta Neighborhood Walk` must not satisfy `Recoleta Cemetery`.
   - Coverage test: `Travel to Teatro Colón` must not satisfy `Teatro Colón`; the actual visit card must.
   - Scheduler test: Recoleta Cemetery + San Telmo Market should not overlap breakfast/lunch/activity blocks.
   - Buenos Aires reproduction test using the current 4 selected attractions.

### Expected result
Future Rome/Mexico City/Buenos Aires-style trips either schedule all selected attractions as real visible cards in valid slots, or clearly report the remaining missing attractions instead of falsely showing full coverage.