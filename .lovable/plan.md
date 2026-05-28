I agree with your diagnosis: the current pipeline does not work as a system. The Rome trip shows the same class of failure across three surfaces: timing collapses, required food disappears, and requested places are treated as optional until it is too late.

The root issue is not one Rome bug. It is that the app still has separate advisory validators, repair passes, read-time patches, and cost readers instead of one hard commit contract that decides whether a trip is actually valid.

```text
Current failure pattern
AI creates itinerary
  -> some validators notice some things
  -> some repair layers patch some things
  -> save/frozen guard may block later correction
  -> trip can still look structurally complete while semantically broken
```

## Confirmed causes from the current code path

1. **The new commit gate is still only a status gate, not a full commit boundary.**
   It can demote `ready` to `partial`, but it does not yet own the full sequence: repair, meal enforcement, request coverage, table sync, cost ledger, and freeze. Recent logs also show saves being blocked by the frozen guard before a repair can persist, which means the system can identify a bad trip but still fail to replace it.

2. **Nightcap timing is caught too late and hidden in other layers.**
   The final integrity contract now flags morning nightcaps, but the generation validator and timing auditor do not consistently treat nightlife/nightcap as an evening-only role. On the frontend timing spine, `nightcap` is still classified like a hotel-return/bookend, which can hide it from gap and health checks.

3. **Meal requirements are not part of final readiness.**
   Meal policy exists and prompts the AI, and generation validation checks missing meals, but the final commit integrity contract does not yet say: “Day 2 requires breakfast/lunch/dinner, and if they are absent this trip cannot be ready.” That is why a middle Rome day can end up with zero food.

4. **User requests are not treated as a feasibility contract.**
   Trevi Fountain and Colosseum should become explicit requested-item obligations. If time allows, missing them must block ready. If time does not allow, the trip should become `partial/infeasible` with a user-visible list: “scheduled / left out / why.” Right now, the system can silently drop requested places and still try to present a finished itinerary.

5. **Gap detection has a real scope bug.**
   The health gap function says it accepts either a full trip array or one day’s activities, but when it receives a day-scoped array whose activities do not each carry `dayNumber`, it filters everything out and returns no warnings. That makes long empty windows invisible.

6. **Math still has competing read paths.**
   The cost system mostly prefers the activity-cost ledger, but the displayed header/day/payment totals still do some float conversion and multiple independent fetches. That can produce small but persistent drift.

## Implementation plan

### 1. Turn the commit gate into a real commit contract

Create a shared backend `commitItinerary` flow that every generation/save/regeneration/chat/self-heal path must use before any trip can become ready or frozen.

The commit order will be non-negotiable:

```text
normalize schedule
-> classify roles
-> enforce time windows
-> enforce meal policy
-> enforce requested-place coverage / feasibility
-> enforce gaps and landing/departure sequence
-> persist final JSON
-> sync normalized tables
-> write activity_costs from that exact JSON
-> reconcile ledger coverage
-> only then mark ready + fully persisted + frozen
```

If any hard invariant fails, the trip is saved as `partial`, not `ready`, with exact reasons.

### 2. Make timing role validation canonical

Add one shared semantic timing validator used by generation validation, final commit, and legacy audit.

It will enforce:

- nightcap/cocktail/speakeasy/rooftop bar cannot start in the morning
- breakfast/lunch/dinner must be inside their time bands
- hotel restaurant/bar/spa cannot occur before check-in
- stale/predawn hotel-return bookends cannot hide a huge active-day gap
- departure-day activities cannot appear after checkout/airport transfer cutoff

Also fix the frontend role classifier so `nightcap` is not treated as a hotel-return bookend.

### 3. Make meal coverage a final readiness rule

At commit time, derive the required meals for each day from the saved arrival/departure context and actual day shape.

Rules:

- full middle day: breakfast, lunch, dinner required
- valid arrival/departure exceptions preserved
- drinks-only never satisfies dinner
- zero-food middle day cannot become ready
- if there truly is not enough time, mark partial/infeasible and explain, instead of pretending the traveler will “feed themselves”

### 4. Make user requests contractual with feasibility output

Convert selected places and custom must-dos into a coverage manifest at commit time:

```text
requested item -> scheduled | omitted_feasible | omitted_infeasible | ambiguous
```

Rules:

- feasible required item missing blocks ready
- impossible item does not fake success; trip becomes partial with omitted list
- user sees exactly what was left out and why
- no logistics-only “finished” trip when requested places exist

For the Rome case, this is where Trevi Fountain and Colosseum would either be scheduled or explicitly listed as omitted due to time constraints.

### 5. Fix gap detection where it is actually broken

Repair the day-scoped filtering bug so `detectGapsForDay(day.activities, dayNumber)` does not discard all activities when individual cards lack `dayNumber`.

Also restore the 3-hour warning threshold for active-day gaps so “structurally sound but practically empty” days are caught.

### 6. Make math integer-ledger based

Move the displayed total equation to integer cents only and remove avoidable USD float math.

Then make the displayed trip total, header chips, day breakdown, and Payments tab read from one resolved ledger result instead of separate fetches/resolver calls where possible.

### 7. Add regression tests for failure classes, not cities

Add tests that prove these cannot ship again:

- nightcap at 9 AM cannot become ready
- middle full day with zero meals cannot become ready
- requested Trevi/Colosseum-style places missing while feasible cannot become ready
- over-requested short trip becomes partial with omitted requested items
- day-scoped gap detection catches a 3-hour gap
- stale predawn hotel-return cannot mask an evening schedule gap
- displayed totals use integer cents and stay consistent across header/payments

## Expected result

After this, the system does not need another Rome-specific patch. The app will either produce a valid ready itinerary, or it will honestly return a partial/infeasible itinerary with the exact missing meals, broken timing, or omitted user requests listed before it ever claims the trip is done.