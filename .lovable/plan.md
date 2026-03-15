

## Single-City Itinerary — Deep Audit: Generation, Features, Integration

### Pipeline Health Summary

The 7-stage generation pipeline, budget/payments integration, and all 3 editing lanes (Chat, Swap, Discover) are functional. Previous fixes (cost sync, smart pacing, hotel cascade, batch dedup, optimistic locking) are in place and working. **No broken edge functions detected.**

However, I found **6 gaps** — including one critical bug where a recently added feature is silently failing.

---

### GAP 1: Flight Itinerary Patch Never Fires (CRITICAL — Dead Code)

`patchItineraryWithFlight()` expects this interface:
```text
{ outbound: { arrivalTime: "14:30" }, return: { departureTime: "18:00" } }
```

But `AddBookingInline.tsx` passes the `flightSelection` object which has this shape:
```text
{ departure: { arrival: { time: "14:30" } }, return: { departure: { time: "18:00" } } }
```

The property names don't match (`outbound` vs `departure`, `arrivalTime` vs `arrival.time`), so `flight.outbound?.arrivalTime` is always `undefined` and the patch silently returns `false` — no activities are ever adjusted.

**Fix**: Update `patchItineraryWithFlight` to accept the actual `flight_selection` schema. Extract times from `flight.departure?.arrival?.time` and `flight.return?.departure?.time`, with fallbacks to `legs[]` array for multi-leg flights.

**Files**: `src/services/flightItineraryPatch.ts`

---

### GAP 2: Double Cascade on Flight Save (MEDIUM)

When a flight is saved in `AddBookingInline.tsx`, TWO cascade mechanisms fire sequentially:
1. `runCascadeAndPersist()` — uses `shiftDayAfter()` to shift activities and persists via `saveItineraryOptimistic`
2. `patchItineraryWithFlight()` — reads `itinerary_data` fresh from DB and applies its own shifts via raw `.update()`

Even after fixing GAP 1, these two would fight: cascade #1 shifts activities and saves, then cascade #2 reads the shifted data and may shift again, creating double-shifted times. Also, cascade #2 uses raw `.update()` bypassing the optimistic lock, potentially causing version conflicts.

**Fix**: Remove the separate `patchItineraryWithFlight` call and merge its time-extraction logic into the existing `runCascadeAndPersist` flow, which already handles activity shifting correctly and uses optimistic saves.

**Files**: `src/components/itinerary/AddBookingInline.tsx`, `src/services/cascadeTransportToItinerary.ts`

---

### GAP 3: `activity_costs` Rows Skip $0 Activities (LOW)

In Stage 6 (line 4059), the cost writer skips activities where `costPerPerson <= 0`. This means free activities (parks, walking tours, free museums) have no `activity_costs` row. While this saves space, it means:
- The `v_payments_summary` view's `activity_count` underreports
- The `cleanupRemovedActivityCosts` function can't detect orphaned free activities
- Budget category breakdowns show fewer total items than the itinerary

This is low severity since financial totals are unaffected, but creates a data completeness gap.

**Fix**: Insert $0 rows for free activities so the count is accurate and cleanup logic works universally.

**Files**: `supabase/functions/generate-itinerary/index.ts` (line 4059)

---

### GAP 4: Chat/Discover Edit Cost Sync Uses Wrong `numTravelers` Path (MEDIUM)

In `ItineraryAssistant.tsx` (line 426), the cost sync correctly uses the `travelers` prop. However, in `EditorialItinerary.tsx` `syncBudgetFromDays` (line 1304-1336), the `syncActivitiesToCostTable` call constructs cost rows but **does not pass `numTravelers`** — it only sends `id`, `dayNumber`, `category`, `costPerPersonUsd`, and `source`. The `syncActivitiesToCostTable` function then defaults missing `numTravelers` to 1.

This means direct edits in EditorialItinerary (drag, remove, add from Discover, manual add) write `num_travelers=1` to `activity_costs`, while the initial generation correctly writes the actual traveler count. After any direct edit, the `v_trip_total` view (`cost_per_person * num_travelers`) will undercount for group trips.

**Fix**: Pass `numTravelers: travelers` in the `syncBudgetFromDays` cost sync block in `EditorialItinerary.tsx`.

**Files**: `src/components/itinerary/EditorialItinerary.tsx` (around line 1304-1336)

---

### GAP 5: `booking-changed` Event Not Dispatched After Flight/Hotel Save in AddBookingInline (LOW)

The `booking-changed` custom event (which triggers `useTripFinancialSnapshot` to refetch) is only dispatched from `TripDetail.tsx` (line 2724), not from `AddBookingInline.tsx`. After saving a flight or hotel via AddBookingInline, the financial snapshot hook doesn't automatically refresh — the user must navigate away and back, or another event must trigger it.

**Fix**: Dispatch `window.dispatchEvent(new CustomEvent('booking-changed', { detail: { tripId } }))` after successful flight and hotel saves in AddBookingInline.

**Files**: `src/components/itinerary/AddBookingInline.tsx`

---

### GAP 6: Optimistic Update Fallback in `itineraryActionExecutor` May Stale-Write (LOW)

The `updateTripItinerary` function (line 780-800) tries the optimistic update if a cached version exists, then falls back to raw `.update()` if no version is cached. However, the `flightItineraryPatch.ts` and `hotelItineraryPatch.ts` both use raw `.update()` directly, bypassing the version cache entirely. This means:
- After a hotel/flight patch, the version in the DB is incremented (by the patch's raw write updating `updated_at` but NOT `itinerary_version`) — actually, the raw writes don't increment version at all, so the cached version stays valid
- But if a collaborator edits simultaneously, the raw write overwrites their changes silently

This is low severity since flight/hotel patches are rare one-time actions, but it's a consistency gap.

**Fix**: Have all itinerary-modifying services use `saveItineraryOptimistic` instead of raw updates.

---

### Recommendations — Priority Order

1. **Fix flight patch interface mismatch** — Currently dead code, flights never cascade to itinerary
2. **Consolidate flight cascade** — Merge patch logic into `runCascadeAndPersist` to prevent double-shifting
3. **Pass `numTravelers` in EditorialItinerary cost sync** — Group trip budget accuracy
4. **Dispatch `booking-changed` from AddBookingInline** — Financial snapshot auto-refresh
5. **Insert $0 activity_costs rows** — Data completeness
6. **Unify all itinerary writes through optimistic update** — Concurrent edit safety

### Files Involved

| Fix | Files |
|-----|-------|
| GAP 1+2 (flight cascade) | `src/services/flightItineraryPatch.ts`, `src/components/itinerary/AddBookingInline.tsx`, `src/services/cascadeTransportToItinerary.ts` |
| GAP 3 ($0 rows) | `supabase/functions/generate-itinerary/index.ts` |
| GAP 4 (numTravelers) | `src/components/itinerary/EditorialItinerary.tsx` |
| GAP 5 (booking-changed) | `src/components/itinerary/AddBookingInline.tsx` |

