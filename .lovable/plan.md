## Diagnosis

The Barcelona failure is not just “the model ignored must-dos.” The engine let a paid generation continue even though the trip had effectively no sightseeing capacity: Day 1 arrival/check-in consumed the evening, Day 2 was early checkout/airport transfer, and all five selected places had no viable window. The current safety nets mostly run after generation, so they can mark the trip partial or try injection, but they do not prevent a logistics-only shell from being produced or clearly explain that the selected plan is infeasible.

The hotel total issue is separate but similar in UX impact: the math now tracks excluded hotel/flight amounts, but the header and Payments list still do not make “excluded from Trip Total” obvious.

## Plan

### 1. Make selected places authoritative everywhere
- Create one shared “selected places” resolver used by prompt generation, deterministic injection, coverage checks, persist validation, and health metadata.
- Merge both sources every time:
  - `trip_day_intents` rows with `priority='must'`
  - legacy trip metadata like `mustDoActivities`, `perDayActivities`, and `userAnchors`
- Treat explicit selected landmarks/venues as required, not soft suggestions.
- Fix the accented-name classifier so places like `Park Güell`, `Barri Gòtic`, and `Sagrada Família` are not downgraded because of Unicode characters.

### 2. Add a pre-generation feasibility gate
- Before the itinerary chain starts generating paid content, compute actual sightseeing windows from arrival/departure logistics.
- If required places exist but the trip has zero viable sightseeing capacity, stop generation with an actionable state instead of producing a shell itinerary.
- Persist metadata explaining the reason, for example:
  - `NO_SIGHTSEEING_CAPACITY`
  - selected places that could not fit
  - arrival/departure windows that blocked scheduling
- Do not mark the trip `ready`, do not freeze it, and trigger the existing credit-safety/refund path if a charge already happened.

### 3. Upgrade must-do coverage from “best effort” to a hard contract
- Move coverage validation into the final persist gate so a trip cannot become `ready` when any required selected place is missing.
- Stamp `must_do_coverage` even when the trip is `partial`, not only when it reaches `ready`, so we have forensic evidence on failures.
- Replace the current “only block ready if 100% of selected places are missing” logic with:
  - any missing required selected place blocks `ready`
  - soft wishes may warn without blocking
- Keep deterministic injection, but make it a recovery mechanism after feasibility passes, not the only protection.

### 4. Surface the failure clearly in the itinerary UI
- When a trip is partial because selected places could not fit, show a direct banner instead of making the itinerary look complete.
- Suggested copy: “Your travel times leave no sightseeing window for the places you selected.”
- Include the missing selected places and a clear next step: adjust travel times/dates or regenerate after changes.

### 5. Complete the Trip Total clarity fix
- In the itinerary header, change the label when logistics are excluded, e.g. `Trip Total · activities only`.
- In the equation row, render muted excluded chips like `Hotel $250 excluded` / `Flights $X excluded` so the user can see why the headline total is lower.
- In Payments, add an `Excluded from total` badge to hotel/flight rows when their budget toggles are off.
- Add tests for the excluded hotel case so the header cannot regress to showing `$23` with no explanation.

### 6. Regression tests that lock the real bug class
- Barcelona infeasible fixture: late arrival + early departure + five selected places must return actionable partial/infeasible state, never `ready`, never frozen, and must stamp missing coverage.
- Barcelona feasible fixture: with one real sightseeing day, the selected places are scheduled or deterministically injected, and coverage passes.
- Unicode intent test: `Park Güell`, `Barri Gòtic`, `Sagrada Família` become required selected-place intents.
- Header/Payments tests: excluded hotel is visibly labeled in both surfaces.