## Symptoms

- Budget tab and Payments tab show different totals for the same trip ("Totals differ by $X").
- A leftover "Reconciling…" wording (now "Totals differ by …") sticks indefinitely after Fix Timing in Rome and on fresh first loads.
- Behavior is intermittent (3 of 5 Venice runs), and goes away on re-render.

## Root causes (verified in code)

`PaymentsTab.bucketSumCents` and `useTripFinancialSnapshot.tripTotalCents` are computed from **different fetch pipelines** and **different inputs for the same dollars**, so they drift whenever the inputs disagree even briefly.

1. **Three independent, uncoordinated fetches**
   - `useTripFinancialSnapshot` runs its own `supabase.from('trips' / 'activity_costs' / 'trip_payments')` (not React Query).
   - `PaymentsTab` runs a separate React Query `['activity-costs-payable', tripId]` and a separate `getTripPayments` call.
   - All three are invalidated on `booking-changed`, but they complete at different times. The 1.5 s `showDriftBadge` timer is shorter than typical refetch windows on slow networks / right after `Fix Timing` (which fires `booking-changed` repeatedly). Result: the badge latches on and never clears once the fetches finally land in a different order than expected.
   - The `activityCosts` query's loading state is **not** part of the drift gate — only `financialSnapshot.loading` and `payments` `loading` are. So drift is "evaluated" while the bucket sum is still hydrating.

2. **Hotel/flight cents come from two different sources**
   - Snapshot's hotel/flight cents = `activity_costs` day-0 rows (via `resolveCanonicalCostRows`).
   - `usePayableItems` bucket cents = `hotelSelection.totalPrice` / `computeHotelCostUsd(...)` and `flightSelection.totalPrice` when a selection exists, falling back to the day-0 row only otherwise.
   - When the user changes their hotel/flight selection but the day-0 `activity_costs` row hasn't resynced yet (or vice versa), bucket sum and total disagree by exactly the price gap. This is the most common multi-hundred-dollar "Totals differ by $283" case.

3. **Misc reserve gating asymmetry**
   - Snapshot only adds `miscReserveContributionCents` when `meaningfulActivityCount >= 1` (filtered by its own category + title regex).
   - PaymentsTab unconditionally adds `financialSnapshot.miscReserveCents` to the bucket via the `misc-reserve` synthetic row. They agree today only because the bucket reads the snapshot's already-gated value — but if snapshot is mid-fetch and returns 0 transiently while bucket already has the prior reserve, drift appears.

4. **`booking-changed` storms during `Fix Timing` / autosave**
   - `Fix Timing` triggers many `booking-changed` events back-to-back. Snapshot debounces with a single `setTimeout(600)`, PaymentsTab does not. Under load, one side updates while the other is still in flight — guaranteed transient drift > 1.5 s.

## Fix plan (frontend / presentation only — no schema, no backend changes)

### 1. Single canonical source for bucket cents
- In `usePayableItems`, when computing the headline display row for hotel and flight, **always price them off the canonical day-0 `activity_costs` row** (the same input the snapshot uses).
- Keep `hotelSelection.name` / airline strings for the row label, but never use `hotelSelection.totalPrice` / `flightSelection.totalPrice` for `amountCents` once `activityCosts` is loaded.
- Fall back to selection price only when no day-0 row exists yet (true day-1 of a brand-new trip).
- This eliminates the $283-class drift entirely.

### 2. Unified "snapshot ready" gate in `PaymentsTab`
- Pull the `isFetching` / `isLoading` flag out of the React Query for `activity-costs-payable`.
- Compute `snapshotReady = !financialSnapshot.loading && !loading && !activityCostsFetching` and gate **both** the drift comparison and the `showDriftBadge` timer on it.
- While `snapshotReady` is false, suppress the drift badge entirely (no false "Totals differ" during refetch).

### 3. Auto-reconcile loop with bounded retries
- When drift is detected and `snapshotReady` is true, kick a single coordinated refetch:
  - `financialSnapshot.refetch()`
  - `queryClient.invalidateQueries(['activity-costs-payable', tripId])`
  - `queryClient.invalidateQueries(['trip-inclusion-toggles', tripId])`
  - `fetchPayments(0)`
- Track a fingerprint = `${bucketSumCents}|${estimatedTotal}`. Only show the "Totals differ by $X" badge after the **same** non-zero drift fingerprint persists across **two** full reconcile cycles (≈3 s + one auto-refetch). This converts the current "stuck forever" behavior into "self-heals within ~3 s, otherwise shows a real, actionable diff".
- Cap auto-reconciles at 2 per `tripId` mount to avoid loops.

### 4. Debounce `booking-changed` in `PaymentsTab`
- Mirror snapshot's pattern: invalidate queries immediately, then a single `setTimeout(600)` to refetch payments. Replaces any in-flight pending refetch. Removes the storm-induced drift during `Fix Timing`.

### 5. Misc reserve agreement
- In `PaymentsTab`, derive `reserveCents` only when `financialSnapshot.tripTotalCents > 0` (snapshot has actually returned). Today it can render with `miscReserveCents > 0` while the snapshot total is 0 mid-fetch. This locks the misc bucket to the snapshot's gating.

### 6. Tests
- Extend `usePayableItems.test.ts` with a case that asserts: when `hotelSelection.totalPrice = $1200` but `activity_costs` day-0 hotel row = $900, the hotel row's `amountCents` equals $900 (canonical wins) and total matches the snapshot.
- Add a `PaymentsTab` test (or hook test) that drives the drift fingerprint logic: drift cleared on first refetch → no badge; drift persists on second cycle → badge shown.

### Files to touch

- `src/hooks/usePayableItems.ts` — make canonical day-0 row authoritative for hotel/flight cents.
- `src/components/itinerary/PaymentsTab.tsx` — unified `snapshotReady` gate, fingerprint-based double-confirm before badge, auto-reconcile, debounced `booking-changed` handler, misc-reserve gate.
- `src/hooks/__tests__/usePayableItems.test.ts` — new canonical-vs-selection test.
- `src/components/itinerary/__tests__/PaymentsTab.reconcile.test.tsx` (new) — fingerprint badge logic.

### Out of scope

- No changes to `useTripFinancialSnapshot` math, `resolveCanonicalCostRows`, server-side cost pipeline, edge functions, schema, or `trip_payments` writes. The snapshot stays the single source of truth — Payments is brought into line with it.
