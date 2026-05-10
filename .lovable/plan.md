# Flight-add → dayMode metadata sync

## The bug

The health engine (`TripHealthPanel.tsx:91`) decides whether a day needs breakfast/lunch/dinner from `day.metadata.quality.dayMode`. That value, plus the sibling `meal_policy_at_generation`, is written **only at trip generation** in `action-generate-trip-day.ts` and re-read (never recomputed) in `action-save-itinerary.ts:305`.

Result: when a user generates a trip with no flight info, every day is stamped `dayMode: 'full_exploration'`. If they later add a flight via `MultiLegFlightEditor` / `handleMarkFlightLeg` / `handleReorderFlightLegs` / `AddBookingInline`, the cascade in `cascadeTransportToItinerary.ts` shifts activity *times* but never re-derives the meal policy. Day 1 stays `full_exploration` even though the user actually arrives at 22:00 — so the health panel still expects breakfast+lunch+dinner and never raises a "missing breakfast" or "missing dinner" warning on the real arrival/departure days.

(Note: there is no `trip_days` table in this repo. The cached metadata lives in `trips.itinerary_data.days[i].metadata.quality.{dayMode, meal_policy_at_generation}`. The fix targets that.)

## Fix — single helper, called from every post-generation flight-write path

### 1. New helper: `src/lib/itinerary/recomputeDayModes.ts`

Pure client function:

- Inputs: `days[]` (current `itinerary_data.days`), `flight_selection`, optional `cities[]` (for multi-city transitions).
- For each day:
  - Compute `isFirstDay` / `isLastDay` from `dayNumber` + `totalDays`.
  - Resolve arrival/departure 24h times from `flight_selection` legs (prefer `legs[]` with `isDestinationArrival` / `isDestinationDeparture`, fallback to `departure` / `return`). Reuse the parsing already in `cascadeTransportToItinerary.ts` (extract a small `extractArrivalDeparture24` util there or duplicate locally — small).
  - Call the existing `deriveMealPolicy` logic. To avoid pulling edge code into the bundle, port the policy table to a TS helper at `src/lib/itinerary/deriveMealPolicy.ts` mirroring `supabase/functions/generate-itinerary/meal-policy.ts` (it's ~30 lines of pure thresholds — no edge deps).
  - Write the result back as:
    ```ts
    day.metadata = {
      ...day.metadata,
      quality: {
        ...day.metadata?.quality,
        dayMode: policy.dayMode,
        meal_policy_at_generation: {
          dayMode: policy.dayMode,
          requiredMeals: policy.requiredMeals,
          isFullExplorationDay: policy.isFullExplorationDay,
          recomputed_from_flight_change_at: new Date().toISOString(),
        },
      },
    };
    ```
- **Locking respected:** never overwrite a day whose `metadata.quality.dayMode_locked === true` (new flag, set if a user manually overrode dayMode — none today, but reserve the contract).

Returns `{ updatedDays, changed: boolean }`.

### 2. Wire into every post-generation flight-write path

All of these already exist; each gets a 3-line addition: call `recomputeDayModes`, then route the resulting days through `safeUpdateItineraryData` (which already dispatches `activity-costs-changed` and refresh events the health panel listens to).

| Location | File:Line | Today |
|---|---|---|
| Mark destination arrival/departure leg | `EditorialItinerary.tsx:3631` `handleMarkFlightLeg` | Persists `flight_selection`, runs `runCascadeAndPersist`, refetches itinerary. **Add recompute step before refetch.** |
| Reorder flight legs | `EditorialItinerary.tsx` `handleReorderFlightLegs` (~3134) | Same shape — persists `flight_selection`, calls `onBookingAdded`. **Add recompute step + persist itinerary.** |
| Add/edit flight via AddBookingInline | `AddBookingInline.tsx` (writes `flight_selection`) | **Add recompute call after the trip update.** |
| Manual booking modal | `ManualBookingModal.tsx` (writes `flight_selection`) | Same. |
| Normalize on load | `TripDetail.tsx:2753` `normalizeFlightSelection` block | Already idempotent. **Add a one-shot guard:** if any day's cached `meal_policy_at_generation` is missing OR predates the trip's `flight_selection.updated_at`, recompute then. This back-fills existing trips that were generated without flights. |

### 3. Cascade integration

`cascadeTransportToItinerary.ts::runCascadeAndPersist` is the natural choke point — it already loads days, mutates them, and persists. Hook the recompute *inside* it so callers don't have to remember:

- After it produces `updatedDays`, call `recomputeDayModes(updatedDays, flight_selection, cities)`.
- Persist via the same write it already performs.
- Bump the returned `CascadeResult.changed` if any dayMode flipped.

This makes `handleMarkFlightLeg` / `handleReorderFlightLegs` automatically correct, and any future flight-write path that uses cascade gets the fix for free.

### 4. Health panel kick

After the recompute writes, dispatch the existing `itinerary-data-changed` (or whichever event `TripHealthPanel` listens to — verify in `TripHealthPanel.tsx`) so the user sees the new "missing dinner on arrival day" warning without a refresh.

## Out of scope (separate P0 items)

- Generator-side metadata caching bug — separate ticket; this fix is purely the *post-generation* sync.
- `MultiLegFlightEditor` itself in `Start.tsx` runs **before** itinerary generation, so its `onLegsChange` doesn't need this — generation will read the freshly-written `flight_selection` and stamp policies correctly first time.

## Verification

1. Generate a trip with no flight. Confirm every day's `metadata.quality.dayMode === 'full_exploration'`.
2. Add a flight arriving 22:00 on Day 1 via the destination-arrival leg marker. Confirm Day 1 flips to `late_arrival`, `requiredMeals === ['dinner']` (or `[]`).
3. Health panel shows the correct missing-meal warnings; no warnings fire for breakfast/lunch on Day 1 anymore.
4. Reorder flight legs → dayMode for last day flips between `early_departure` / `full_exploration` accordingly.
5. Open an existing trip generated before this fix → one-shot back-fill runs, dayModes update once.
6. Manually-edited days (future `dayMode_locked`) are untouched.

---

## Implementation summary

Implemented the plan:

1. **`src/lib/itinerary/deriveMealPolicy.ts`** (new) — client port of the server meal-policy thresholds.
2. **`src/lib/itinerary/recomputeDayModes.ts`** (new) — pure helper that re-derives `metadata.quality.{dayMode, meal_policy_at_generation}` for Day 1 / last day from `flight_selection`. Respects future `dayMode_locked` flag.
3. **`src/services/cascadeTransportToItinerary.ts`** — `runCascadeAndPersist` now always calls `recomputeDayModes` (even when no activity timing changes), so every flight-write path that goes through cascade auto-syncs dayModes.
4. **`src/components/itinerary/EditorialItinerary.tsx`** — `handleReorderFlightLegs` now invokes `runCascadeAndPersist` after persisting the new order, so leg reorders trigger dayMode recompute.
5. **`src/pages/TripDetail.tsx`** — one-shot back-fill effect runs once per trip, stamping `metadata.dayMode_backfilled_at`. Closes the gap for trips generated before this fix.

Already-correct paths (no edit needed):
- `handleMarkFlightLeg` already calls cascade.
- `AddBookingInline` already calls cascade after writing `flight_selection`.
