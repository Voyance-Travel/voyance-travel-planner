## Three small, scoped cleanups

The current run is the cleanest yet. We're not redoing the pipeline — just shaving three real-world rough edges.

---

### Issue 1 — Health checker falsely flags Day 1 "missing breakfast"

**What's happening**
- Server `deriveMealPolicy` (`src/lib/itinerary/deriveMealPolicy.ts` L74–84) requires breakfast on a first day only when arrival < 10:30 AM. A 10:15 arrival (615 min) sits just under that and gets all three meals required.
- The Health panel (`TripHealthPanel.tsx` L112–118) recomputes its own simplified `requiredMeals` map from `dayMode`, defaulting to all three meals when `dayMode='morning_arrival'`. This is the actual source of the warning.

**Fix (frontend only — Health panel)**
- Read `requiredMeals` directly from `day.metadata.quality.requiredMeals` (or the persisted meal policy) when present, so the panel cannot drift from server policy.
- Fallback map: also handle `morning_arrival` → infer from arrival time (or trust persisted value).
- Bump the "needs breakfast" cutoff from arrival < 10:30 to arrival < 09:30 in `deriveMealPolicy.ts`. Late check-in / settle-in time means a 10:15 arrival realistically skips breakfast.

**Outcome**: The phantom "Day 1 missing breakfast" warning disappears for arrivals in the 09:30–12:00 band.

---

### Issue 2 — Lunch scheduled between checkout and airport on the departure day

**What's happening**
- `enforceDepartureDayLogistics` (§15z) already prunes non-logistics cards that start *after* the departure transfer.
- A lunch card placed *between* a late checkout and the transfer is technically valid by timing but feels wrong — user is supposed to be heading to the airport, not eating.

**Fix (backend repair pipeline)**
- In `enforceDepartureDayLogistics` (run after §15z), add a "no meal in the airport-bound window" rule: if a `dining` card sits between the checkout time and `transferStart`, AND `transferStart − dining.endTime < 90 min`, drop the dining card. Locked / user / extracted rows exempt.
- Tighten `meal-policy.ts` `midday_departure` and `afternoon_departure`: when `depMins − checkoutMins < 240` (less than ~4 hours of usable window before transfer), drop `lunch` from `requiredMeals`. Currently `midday_departure` (dep < 15:00) requires only `breakfast` — good — but `afternoon_departure` (dep < 18:00) requires `breakfast,lunch` and that's the case generating the offending lunch.
- Sentinel `[DEPARTURE_MEAL_PRUNED]` for telemetry.

**Outcome**: Departure days end with breakfast → checkout → transfer → flight, with no awkward sit-down meal in the middle.

---

### Issue 3 — User has to hard-refresh to see the clean itinerary

**What's happening**
- Right after generation, the local UI shows a slightly stale picture (the "Return to Four Seasons before check-in" inversion). A hard refresh re-reads canonical DB data and the issue disappears.
- Plumbing already exists: `dispatchTripPersisted` + `TRIP_PERSISTED_EVENT` + `resyncItineraryFromDb`. We're just not firing a guaranteed resync at the end of the generation chain.

**Fix (frontend, no business-logic change)**
- In `TripDetail.tsx` (the place that owns trip session state and already listens for `TRIP_PERSISTED_EVENT`), add a one-shot post-generation resync: when `itinerary_status` transitions to `ready` (or `metadata.itinerary_frozen_at` is newly stamped), call `resyncItineraryFromDb(tripId)` and replace local state with the canonical DB version. This is the silent "auto hard-refresh" the user was doing manually.
- Also fire `dispatchTripPersisted({ source: 'generation-complete' })` from the generation-complete handler in `voyanceFlowController.ts` / wherever the chain ends, so the existing listener picks it up without any new wiring.

**Outcome**: User never sees the pre-resync version. The first paint after generation matches what a hard refresh would have shown.

---

### Files I expect to touch

- `src/lib/itinerary/deriveMealPolicy.ts` — bump breakfast cutoff to 09:30
- `src/components/trip/TripHealthPanel.tsx` — read persisted `requiredMeals`, drop the local default-to-three behavior
- `supabase/functions/generate-itinerary/meal-policy.ts` — drop `lunch` from `afternoon_departure` when usable window < 4h
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` (or wherever `enforceDepartureDayLogistics` lives) — prune dining within 90 min of transfer
- `src/pages/TripDetail.tsx` — auto-resync on `ready` transition
- `src/lib/voyanceFlowController.ts` (or generation-complete site) — dispatch `TRIP_PERSISTED_EVENT` on chain finish
- New tests: meal-policy 10:15 arrival → no breakfast; afternoon_departure short-window → no lunch; departure-day prune drops lunch in airport-bound window

### What I'm NOT changing
- The generation prompt
- The cost / budget pipeline
- The hotel-return bookend logic (it's working — just needs the resync to surface it correctly)

Approve and I'll ship.