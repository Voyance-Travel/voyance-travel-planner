## One true conclusion

The root issue is not that one validator is weak. The root issue is that the app has **many partial truth systems** and no single final commit gate that owns the paid itinerary before it becomes `ready`.

Lisbon proves it:

- **Flight truth existed** (`21:00`) but the generated arrival card was system-locked at `19:00 → 21:00`, so the Executioner skipped it.
- **Must-do truth existed** (`Ride Tram 28`) but injection happened late and overlapped breakfast, while the title pipeline had already named days from stale/aspirational content.
- **Hotel cost truth existed** (`$750` activity_costs row) but UI budget inclusion truth hid it, so Payments said `$12` “matches”.
- **Geo truth existed in text** (`Alfama`) but address truth contradicted it (`Avenida da Liberdade`), and the geo guard only checked title/centroid, not semantic neighborhood contradiction.
- **Airport-loop truth was obvious** (`check-in → travel to airport`) but no final logistics invariant rejected it as impossible on a non-departure day.

So the real failure is: **we validate fragments, then later passes mutate or reinterpret the itinerary, and the final product is allowed to ship even when canonical truths disagree.**

## Correct architectural fix: Final Commit Gate

Build one deterministic `finalizeTripForCommit` boundary and make it the only path that can mark a trip `ready` / `fully_persisted=true`.

This gate must run after all generation, repair, meal guard, must-do injection, executioner, schedule sanity, cost sync, and title coherence logic. If it cannot produce a coherent itinerary, it must leave the trip `partial` with explicit health codes — never publish a polished paid itinerary with known contradictions.

## Implementation plan

### 1. Create a single final commit contract

Add a backend finalizer module that accepts:

- raw `days`
- flight truth
- hotel truth
- must-do truth
- cost ledger truth
- destination/neighborhood truth
- trip metadata

It returns either:

```ts
{ ok: true, days, metadata, healthCodes: [] }
```

or:

```ts
{ ok: false, days, metadata, healthCodes, blockingReasons }
```

No downstream pass can mutate `days` after this.

### 2. Make flight anchors truth-owned, not normal locks

System-created anchors are not user locks.

Rules:

- User/manual/imported/booked rows remain immutable.
- System flight/transfer/check-in anchors may be repaired by flight/hotel truth.
- Old arrival block convention `19:00 → 21:00` with truth `21:00` becomes `21:00 → 21:15`, not a two-hour airport activity.
- If flight truth exists and arrival card disagrees, the finalizer repairs it or blocks `ready`.

Blocking code: `FINAL_FLIGHT_ANCHOR_MISMATCH`.

### 3. Add impossible-logistics invariants

Rules:

- Non-departure day cannot contain hotel check-in followed by airport-bound travel.
- Non-departure airport transfer is allowed only as arrival airport → hotel, before check-in/luggage-drop.
- Departure transfer requires departure flight/train truth; otherwise no concrete transfer duration is emitted.
- Any unverified transfer over 180 minutes is clamped or dropped before commit.

Blocking/repair codes:

- `FINAL_AIRPORT_LOOP_DROPPED`
- `FINAL_TRANSFER_DURATION_CLAMPED`
- `FINAL_DEPARTURE_TRANSFER_WITHOUT_CLOCK`

### 4. Make must-dos a blocking paid-deliverable requirement

Rules:

- Must-do injection runs inside the finalizer, after meals and real activity blocks exist.
- Injected must-dos cannot overlap meals or committed activities.
- A day title cannot reference a must-do unless that must-do is visibly scheduled on that day.
- If any explicit must-do remains missing, trip status must be `partial`, not `ready`.

Blocking/repair codes:

- `FINAL_MUST_DO_MISSING`
- `FINAL_MUST_DO_OVERLAP_REJECTED`
- `FINAL_DAY_TITLE_REWRITTEN`

### 5. Add semantic neighborhood/address coherence

The current geo check is too geometric. Add a semantic guard:

- If title/description says `Alfama`, address/location cannot point to `Avenida da Liberdade`.
- For neighborhood-wandering activities, prefer neighborhood-level location over a misleading exact street address.
- Start with Lisbon neighborhood aliases, then keep helper extensible by city.

Blocking/repair codes:

- `FINAL_NEIGHBORHOOD_ADDRESS_CONFLICT`
- `FINAL_LOCATION_DOWNGRADED_TO_NEIGHBORHOOD`

### 6. Fix financial truth semantics

Payments cannot say “Trip Total $12 — Matches itinerary” when a real selected hotel cost exists.

Rules:

- If a selected hotel has `totalPrice` or `pricePerNight × nights`, Payments must surface it as a real expected cost.
- If the user excludes hotel from the planning budget, UI copy must say “Excluded from budget”, not “Free”, and must not claim the out-of-pocket trip total is only activities/transit.
- Forward creation default: priced hotel means `budget_include_hotel=true` unless explicitly opted out.

Codes/tests:

- `FINAL_HOTEL_COST_EXCLUDED_FROM_OUT_OF_POCKET`
- Lisbon fixture: `$104 itinerary + $750 hotel = $854 out-of-pocket`.

### 7. Wire status honestly

Only the finalizer can set:

- `itinerary_status='ready'`
- `metadata.fully_persisted=true`
- `metadata.itinerary_frozen_at`

If blocking reasons exist:

- status stays `partial`
- UI gets health codes
- paid delivery is not presented as complete

### 8. Tests that must pass before calling this fixed

Add one Lisbon regression fixture covering all failures together:

- arrival truth `21:00`, generated system-locked `19:00 → 21:00` repaired
- no post-check-in airport loop
- no 525-minute transfer
- Tram 28 visibly scheduled without meal overlap
- no day title says Tram unless Tram exists that day
- Alfama activity not pinned to Avenida da Liberdade
- hotel `$750` appears as expected out-of-pocket spend

Also add smaller unit tests for each invariant so this does not become another one-off patch.

## What changes from the last 50 attempts

We stop adding another validator beside the others.

We make one finalizer the **paid-deliverable compiler**. Everything before it is draft generation. Everything after it is persistence only. If canonical truths disagree, the itinerary cannot be marked ready.