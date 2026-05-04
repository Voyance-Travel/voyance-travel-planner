## What I found

The current Paris trip is not suffering from just one stale orphan row anymore. The remaining symptoms are coming from multiple read/render paths using different definitions of “the itinerary” and “the total”:

1. **Activities count drift**
   - Saved JSON currently has many transport/logistics rows mixed with real activity rows.
   - Some UI surfaces count all saved rows; others hide transport/synthetic/option rows. This explains counts like 24 vs 22 depending on which filtered view rendered.

2. **Payments total drift / Reconciling state**
   - The Payments tab total still combines multiple sources: visible payable rows, the financial snapshot, manual payments, and activity-cost rows.
   - The financial snapshot reads raw `activity_costs` rows directly and does **not** apply the same live-itinerary/orphan filtering that Budget ledger and Payments item rows now apply.
   - Manual paid hotel/activity entries can also appear as orphan payment recovery rows, affecting the visual list and “paid so far” without matching a live itinerary item.

3. **Duplicate Le Comptoir symptom**
   - The specific old orphan cost row appears removed in the database now, but the UI can still show duplicate-looking venue rows because:
     - Budget/Payments have separate fallback/orphan-recovery logic.
     - Orphan payment recovery still surfaces old paid items like the removed L’Arpège payment.
     - Counts and list rows are not all based on the same canonical “live activities only” filter.

4. **Session-to-session total changes**
   - On component load, the app still runs side-effect sync paths for logistics and image/writeback/local state changes. Some are intended, but they trigger `booking-changed` and refetches.
   - The snapshot can briefly compare an optimistic total with the DB total, creating an apparent never-ending reconciliation loop.

## Plan

### 1. Create one shared live-itinerary filter
Add a small shared helper for itinerary financial visibility:

- Build a live activity ID set from `itinerary_data.days[*].activities[*].id` / rendered `days`.
- Classify visible real activities vs hidden transport/logistics/synthetic rows using the same rules everywhere.
- Expose helpers like:
  - `isLiveActivityCostRow(row, liveIds)`
  - `isVisibleItineraryActivity(activity, activitiesForDay)`
  - `getStableActivityCount(days)`

This prevents each tab from inventing its own activity count.

### 2. Make the financial snapshot use the same live-row filter
Update `useTripFinancialSnapshot` so `tripTotalCents` excludes stale/orphan `activity_costs` rows exactly like Budget and Payments do.

Specifically:
- Fetch the trip’s itinerary activity IDs alongside budget toggles.
- Ignore non-logistics `activity_costs` rows whose `activity_id` is absent from the live itinerary.
- Apply hotel/flight inclusion toggles after the orphan filter.
- Keep manual hotel/flight override behavior, but do not let manual orphan activity payments change the canonical trip total.

### 3. Remove misleading optimistic reconciliation updates
Update the `booking-changed` handler and `syncBudgetFromDays` event payload so Payments does not show a temporary optimistic total that is immediately replaced by a DB total.

Instead:
- Invalidate/refetch the canonical queries only.
- If an optimistic total is retained anywhere, use it only as a temporary loading placeholder, not as the value that triggers a delta/reconciliation badge.

### 4. Harden Payments orphan payment recovery
Change `usePayableItems` orphan payment recovery so old payments for removed activities do not appear as normal Activities rows.

Options implemented in code:
- Keep them in paid totals, but put them under a clearly labeled “Removed / historical payments” section, or
- Hide them from Activities & Experiences and only include them in “Paid so far”.

For this bug, I’ll use the safer UX: **do not show removed activity payments in the live Activities list**, because they are not part of the itinerary and are causing duplicate-looking rows.

### 5. Make Budget “All Costs” and Payments list use matching dedupe keys
Remove the remaining orphan-rescue naming behavior that can reassign a live venue name to an unrelated stale row.

- If a cost row has an `activity_id` and that ID is not live, skip it.
- Do not pop a replacement venue name from `(day, category)` queues.
- Deduplicate live rows by `trip_id + activity_id`; for display, never by mutable title alone.

### 6. Normalize the displayed activity count
Update the Day/Trip activity counters to use the same `getStableActivityCount(days)` helper, excluding:
- transport/transit rows,
- synthetic hotel/flight/departure rows,
- hidden option alternatives.

This should stop 24 → 22 type fluctuations when the underlying saved itinerary has not actually changed.

### 7. One-time data cleanup for this trip and existing trips
Run a data cleanup after code changes:

- Delete `activity_costs` rows whose non-logistics `activity_id` is not present in the trip JSON.
- Optionally mark old `trip_payments` rows for removed activities as historical/removed if the schema supports it; otherwise the code will hide them from live lists.

No schema change is needed unless we decide to add a `removed_from_itinerary` flag to payments. I’ll avoid schema changes unless required.

## Files to change

- `src/hooks/useTripFinancialSnapshot.ts`
- `src/hooks/usePayableItems.ts`
- `src/services/tripBudgetService.ts`
- `src/components/itinerary/EditorialItinerary.tsx`
- potentially a new shared helper file under `src/lib/` for live itinerary cost/count filtering

## Expected result

- Trip total remains stable between reloads unless the user explicitly edits the trip.
- Payments no longer shows a persistent “Reconciling…”/transient mismatch state.
- Le Comptoir appears once in live Activities/Budget/Payments.
- Activity count is stable and uses the same definition across sessions.
- Historical paid items remain accounted for financially without masquerading as current itinerary activities.