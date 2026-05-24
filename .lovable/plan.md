# Systematic fix for the Bangkok-class failure

The previous patch added one guard inside `persistTripItinerary`. The Bangkok trip proved that's not enough — there are still multiple write paths, multiple "is this the departure day?" deciders, and multiple places that compute "nights" and "total days". A systematic fix means: **one boundary, one set of invariants, enforced on every read and every write, plus a deterministic recovery path for any trip already in a bad state.**

## The five invariants

Every itinerary write and every itinerary read MUST satisfy these. They get a shared module, shared tests, and are called from every path — not re-implemented per caller.

1. **Day-count floor** — `json.days.length >= max(prior_json.days.length, itinerary_days table count, trip.end_date − trip.start_date + 1)` unless caller passes `allowRegression:true`. Day count never goes down silently.
2. **Total-days truth** — the canonical "how many days does this trip have" is `trip.end_date − trip.start_date + 1`. Everything else (header chip, hotel nights, departure-day classifier, bookend) reads from that single function, never from `days.length`.
3. **Departure day is the last calendar day** — `isDepartureDay` is true iff `dayNumber === totalDays(trip)`. Day 1 of a multi-day trip can never be a departure day, regardless of what's in JSON.
4. **`failed_day_numbers` reflects reality** — recomputed from the `itinerary_activities` table on every persist and every page-load self-heal. A day with ≥3 activity rows is never "failed".
5. **Hotel nights** — derived from check-out − check-in (or trip dates when no split-stay), never from `days.length`.

## Architecture

```text
                       ┌──────────────────────────────┐
   every write path ──▶│  persistTripItinerary (sole) │──▶ DB
                       │   ├─ invariant 1 (floor)     │
                       │   ├─ invariant 4 (reconcile) │
                       │   └─ stamp metadata          │
                       └──────────────────────────────┘
                       ┌──────────────────────────────┐
   every read path  ──▶│  loadTripItinerary           │──▶ UI
                       │   ├─ totalDays(trip) (inv 2) │
                       │   ├─ self-heal if json<table │
                       │   └─ recompute departure-day │
                       └──────────────────────────────┘
```

### 1. Single write boundary — already exists, harden it

`supabase/functions/_shared/persist-itinerary.ts` is the boundary. Audit every edge function and client helper for writes to `trips.itinerary_data` that bypass it. Any direct `.update({ itinerary_data })` outside this boundary becomes a lint-test failure (mirrors the existing `no-raw-itinerary-writes.test.ts` pattern). Notable suspects to recheck: `useItineraryPreservation.ts` (writes raw — needs to route through the boundary with `allowRegression:true` since it's a restore), any `optimistic-update` paths, version-restore.

### 2. Single "total days" function — new

Add `src/lib/trip/totalDays.ts` + `supabase/functions/_shared/trip-total-days.ts` (mirrored):

```ts
totalDays(trip) = max(
  daysBetween(trip.start_date, trip.end_date) + 1,
  trip.metadata?.generation_total_days ?? 0,
  itinerary_days_table_count ?? 0,
)
```

Replace every `days.length` used as "how long is this trip" with this helper. Grep targets:
- bookend-verification.ts (`expectedTotalDays` — already partially fixed, route through helper)
- repair-day.ts §15z (departure logistics)
- EditorialItinerary.tsx (header chip, hotel nights)
- TripHealthPanel, TripDetail self-heal gates

### 3. Single departure-day decider — new

`isDepartureDay(dayNumber, trip) = dayNumber === totalDays(trip)`. Replace the 3+ inline checks in bookend-verification, repair-day, action-save-itinerary normalize. Day 1 + totalDays>1 → always false. Add `[BOOKEND_DEPARTURE_GUARD]` log when a caller tries to mark Day 1 as departure on a multi-day trip.

### 4. `failed_day_numbers` reconciler — new

`reconcileFailedDays(tripId)`: SELECT day_number, count(*) FROM itinerary_activities WHERE trip_id=? GROUP BY day_number; drop any day with ≥3 rows from `failed_day_numbers`. Call from:
- end of `persistTripItinerary`
- `TripDetail` mount self-heal
- new `heal-trip-from-tables` RPC (step 6)

Sentinel: `[FAILED_DAYS_RECONCILED] before=[3,4] after=[]`.

### 5. Page-load self-heal hardening

`TripDetail.tsx` already rebuilds from tables when `tableDays > jsonDays`. Three hardenings:
- Trigger on `tableDays > jsonDays` **regardless** of `fully_persisted` polling state (Bangkok was stuck because heal was gated on poll-complete).
- Rebuild path passes `allowRegression:true` so the new floor (invariant 1) doesn't reject the heal itself.
- After rebuild succeeds, call `reconcileFailedDays` + re-run bookend with the corrected `totalDays`.

### 6. One-shot recovery RPC

`supabase/functions/heal-trip-from-tables/index.ts`: rebuild `itinerary_data.days` from `itinerary_days` + `itinerary_activities` for one tripId, reset failed_days, re-run bookend, persist via `saveReason:'one-shot-rebuild-from-tables'`. Auto-invoked once on trip mount when `tableDays > jsonDays`; also exposable to admin tools. Bangkok trip recovers on next reload without manual intervention.

### 7. Hotel-nights single source

`src/lib/hotel-cost.ts` (or sibling): `tripNights(trip) = daysBetween(trip.start_date, trip.end_date)` or `daysBetween(hotel.check_in, hotel.check_out)` when split-stay. Replace `days.length - 1` / `days.length` arithmetic in EditorialItinerary's accommodation chip and pricing.

## Files touched

```text
NEW:   supabase/functions/_shared/trip-total-days.ts
NEW:   supabase/functions/_shared/is-departure-day.ts
NEW:   supabase/functions/_shared/reconcile-failed-days.ts
NEW:   supabase/functions/heal-trip-from-tables/index.ts
NEW:   src/lib/trip/totalDays.ts
NEW:   src/lib/trip/tripNights.ts

EDIT:  supabase/functions/_shared/persist-itinerary.ts      (call reconciler + floor uses totalDays)
EDIT:  supabase/functions/_shared/bookend-verification.ts   (route through helpers)
EDIT:  supabase/functions/generate-itinerary/pipeline/repair-day.ts (§15z uses isDepartureDay)
EDIT:  supabase/functions/generate-itinerary/action-save-itinerary.ts (normalize uses helpers)
EDIT:  src/pages/TripDetail.tsx                              (heal trigger, reconcile, allowRegression)
EDIT:  src/components/itinerary/EditorialItinerary.tsx      (hotel nights + total days chip)
EDIT:  src/hooks/useItineraryPreservation.ts                (route restore through persistTripItinerary)

TESTS:
  persist-day-count-shrink.test.ts          (floor blocks any path)
  isDepartureDay.test.ts                    (Day 1 of N>1 → false, always)
  totalDays.test.ts                         (dates win over days.length)
  reconcileFailedDays.test.ts               (table truth beats stale metadata)
  no-raw-itinerary-writes.test.ts           (extend grep to cover all callers)
  TripDetail.dayCountDrift.test.tsx         (1-day JSON + 4-day table → heal)
  heal-trip-from-tables.test.ts             (RPC rebuilds + reconciles)
```

## Acceptance

- Refreshing trip `53636a0c-…` rebuilds JSON to 4 days, hotel chip reads "3 nights", Day 1 loses the injected return-flight, `failed_day_numbers` clears.
- Any future write attempt with `incoming < max(prior, table, dateSpan)` is rejected with `[PERSIST_DAY_COUNT_SHRINK_BLOCKED]`.
- Lint-test enforces every itinerary write routes through `persistTripItinerary`.
- A grep for `days.length` in trip-duration / nights / departure-day contexts returns zero hits — all replaced with the canonical helpers.

## Out of scope

- Forensics on which caller emitted the original 1-day JSON for Bangkok — the floor (invariant 1) plus the routing-through-boundary lint test make it structurally impossible going forward, regardless of which caller it was.
- Untagged flight-direction labels — shipped in the prior Paris ticket; will verify wiring on the Bangkok trip's Flights tab and only act if regressed.

