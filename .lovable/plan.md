## Plan: stop generating visible dead gaps and collisions

### Goal
Make the generation pipeline treat the inline gap warnings as pre-publish failures, not just UI annotations. The user should receive the repaired itinerary on first load, without needing a refresh or manually noticing/filling gaps.

### What I found
- The generation gap filler explicitly skips `isFirstDay`, which explains the Day 1 lunch-to-dinner 5h30m dead window.
- Gap filling runs before several late mutation stages: final meal guard, hotel-return injection, validation gate, orphan-transit cleanup, and the persist-time timing cascade.
- The persist-time cascade can fix overlaps like breakfast ending 09:15 vs Cathedral starting 09:00, but because it runs at the persist boundary, no final gap-fill pass runs after it. That means the system can fix one timing bug while silently creating or preserving a large open block.
- Transit recomputation has a sanity clamp only above 180 minutes, so a misleading 109-minute intra-Faro leg can survive even though it is implausible for a local island ferry-to-Old-Town transition.

### Implementation steps
1. **Replace the “skip first day” gap-fill rule with a usable-window rule**
   - Allow Day 1 gap fill after the arrival/brunch/lunch-start window is satisfied.
   - Still avoid filling arrival logistics, hotel check-in, freshen-up, and user-locked items.
   - This directly targets the 13:30 → 19:00 Day 1 gap.

2. **Add a final pre-persist schedule gate**
   - After all late generation mutations, run one deterministic sequence:
     1. timing cascade / overlap repair
     2. orphan transit cleanup
     3. morning/afternoon/evening gap fill
     4. timing cascade again on inserted cards
     5. final gap audit
   - If a non-departure day still has an unexplained ≥240-minute active-day gap, mark generation as needing repair instead of presenting it as clean.

3. **Make the persist boundary return the repaired itinerary, not the pre-repair one**
   - Ensure the object saved by `persistTripItinerary` after cascade repairs is the same object passed forward to the UI state/poller response.
   - This prevents the “first itinerary shown, repaired itinerary appears only after hard refresh” class of bugs.

4. **Tighten intra-city transit sanity for impossible local legs**
   - Add a local-route cap for non-airport, non-intercity transit cards: if the route is inside one city and not explicitly long-distance/ferry excursion, clamp/mark unverified above a reasonable ceiling.
   - Add a special water-crossing allowance so real ferry legs can be 15–45 minutes, but not 109 minutes unless coordinates or route data prove it.

5. **Add regression tests with the exact failures**
   - Day 1 Faro lunch 13:30 → dinner 19:00 must be filled or explicitly marked as intentional free time by generation.
   - Day 1 breakfast 08:30–09:15 vs Cathedral 09:00 must be repaired before persist/UI response.
   - Day 2 Chapel of Bones 16:54 → dinner 20:14 must be filled or blocked as unclean.
   - Ilha Deserta → Old Town 109-minute transit must be clamped/flagged unless verified.

### Expected result
Generated itineraries can still include honest free time, but large unexplained windows and direct timing collisions will be repaired or blocked before the itinerary is shown as ready.