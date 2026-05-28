## What is actually wrong

This is not a Rome bug, Barcelona bug, route bug, or math bug.

The root failure is architectural: the itinerary system has many validators, sanitizers, self-heals, UI repairs, cost repairs, frozen guards, and parser-side corrections, but no single authoritative definition of what a valid trip is.

That means each new “fix” can correctly identify one symptom while still allowing another layer to persist or display a broken canonical trip.

The current code confirms the pattern:

- `persistTripItinerary` runs many passes, but several hard timing defects are still treated as warnings or observability only.
- `validateChronology` explicitly says critical issues can remain and the write still proceeds.
- `sanitizeSchedule` mostly knows meals/sightseeing, so semantic cards like `Nightcap at ...` categorized as `activity` can escape.
- `action-save-itinerary` can return success for frozen-blocked writes, creating the exact “we fixed nothing” loop.
- The system can mark a trip `ready` even when the persisted itinerary contains hard semantic contradictions or missing required user intent.

## Architectural fix

### 1. Introduce a canonical itinerary integrity contract

Create one backend contract that all canonical itinerary writes must pass before a trip can be marked `ready`.

This is not another local regex patch. It becomes the final authority for:

- fresh generation
- regenerate day/trip
- save itinerary
- chat/action mutations
- legacy repair/heal flows
- normalized-table rebuilds

The contract classifies every activity by role:

```text
arrival-logistics
check-in-logistics
hotel-contained-venue
normal-activity
meal
nightlife
nightcap
late-nightlife-continuation
hotel-return-bookend
departure-logistics
```

Then it validates the full day sequence, not isolated cards.

### 2. Make hard-invalid trips impossible to mark ready

Before any write sets `itinerary_status = ready/generated` or stamps `fully_persisted=true`, run the integrity contract.

Hard failures must block ready status and persist as `partial` with metadata explaining the exact codes.

Hard failures include:

```text
TEMPORAL_ROLE_TIME_MISMATCH
HOTEL_VENUE_BEFORE_CHECKIN
BOOKEND_AFTER_INVALID_SEQUENCE
UNEXPLAINED_ACTIVE_DAY_GAP
REQUIRED_USER_INTENT_MISSING
NO_SIGHTSEEING_CAPACITY
LOGISTICS_ONLY_CURATED_DAY
COST_LEDGER_DISPLAY_DRIFT
```

This directly addresses the repeated “shell itinerary paid trip” problem: logistics-only is only acceptable when the user truly has no sightseeing window and the trip is explicitly marked partial/infeasible, not ready.

### 3. Turn “repair blocked by frozen trip” into an explicit outcome

The current frozen guard can return success while doing nothing.

Change repair/action save behavior so:

- user-visible mutation attempts cannot silently no-op
- system integrity repairs may write through frozen status using a narrow `allowFrozenWrite` path
- blocked writes return an explicit result like `FROZEN_BLOCKED`, not success
- metadata records repair attempts and whether they actually persisted

This stops the loop where we think a repair ran, but the database remains unchanged.

### 4. Consolidate timing validators into the shared role spine

Replace scattered timing assumptions with one shared classifier used by:

- schedule sanitizer
- chronology validator
- persist validation
- bookend verification
- output consistency validation
- frontend parser/read-time health checks

Specific fixes covered by the shared classifier:

- `Nightcap`, `cocktail`, `aperitif`, `rooftop bar`, and `lounge` cannot be scheduled in the morning.
- A hotel restaurant/bar/spa cannot be scheduled before check-in unless explicitly marked as pre-check-in luggage/drop-off logistics.
- `Return to Hotel` cannot be used to hide a broken chronology chain.
- A Day 1/Day N logistics-only day cannot be considered complete if the user selected must-dos and there is usable activity time.

### 5. Make required user selections part of the hard contract

Selected places and must-do activities must not be advisory.

At persist gate:

- resolve required intents from both structured rows and metadata
- Unicode-normalize venue matching so names like `Park Güell` match correctly
- compare required places against persisted activities
- if any required place is missing and there was feasible time, block `ready`
- if no feasible time exists, mark `partial` with `NO_SIGHTSEEING_CAPACITY`

This prevents both outcomes we have seen:

- shell trips marked ready
- selected places silently dropped

### 6. Make itinerary math read from one source

Use the `activity_costs` ledger as the displayed total contract everywhere:

- itinerary day badge
- header Days(group)
- Payments tab
- activity cards when a ledger row exists

Rules:

- check-in / checkout / return-to-hotel rows do not contribute to activities total
- JSON cost is only a temporary fallback when no ledger row exists
- no `Math.floor` display drift between day totals and header totals
- if ledger coverage is incomplete, show reconciling state instead of pretending totals are final

### 7. Restore global gap warnings at 3 hours

Unplanned active-day gaps of 180+ minutes must be detected consistently.

The UI and backend should share the same threshold and avoid false positives from overnight sleep or hotel-return bookends.

### 8. Add regression tests for failure classes, not city strings

Add fixtures that prove the architecture works across trips:

- nightcap at 9 AM blocks ready
- hotel venue before check-in blocks ready
- selected/must-do place missing blocks ready
- infeasible selected places produce partial/infeasible metadata, not shell-ready
- frozen invalid trip can be system-repaired and the database actually changes
- frozen blocked write returns explicit blocked result
- 180+ minute active-day gap warns
- header/day/payments totals match from the same ledger source

### 9. Repair the current Rome trip only after the global contract lands

After the contract is in place:

- run the new integrity repair path against the Rome trip
- verify the database row changed, not just UI state
- confirm the invalid nightcap/check-in/gap/math issues are gone
- confirm the trip is either valid-ready or explicitly partial with hard failure metadata

## Success criteria

This is done only when:

- the same invalid prompt cannot produce a ready broken trip twice in a row
- a logistics-only curated day cannot be marked ready
- selected user places cannot silently disappear
- frozen repair attempts cannot pretend success without persistence
- Rome/Barcelona-style failures are covered by tests
- database state, itinerary UI, header totals, and Payments agree from one contract