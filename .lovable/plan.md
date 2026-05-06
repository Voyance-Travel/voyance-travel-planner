## Root cause

`PaymentsTab` has two parallel data paths into the Trip Total header:

1. **`tripTotalCents`** — `useTripFinancialSnapshot` reads `activity_costs` directly via `supabase`, listens for `window`-level `booking-changed`, and refetches on every dispatch.
2. **`bucketSumCents`** — built by `usePayableItems` from a React Query cache `['activity-costs-payable', tripId]` (`PaymentsTab.tsx` line 249).

Nothing invalidates query #2 when `booking-changed` fires. So after Fix Timing → autosave → `action-save-itinerary` → DB trigger reprojects `activity_costs` and the JSON `cost` blocks (slightly different `perPerson`/`synced_at` recomputation, plus the orphan-payment archival path inside the snapshot can shift the canonical total), the headline `tripTotalCents` updates while `bucketSumCents` stays frozen on the stale cached rows. Drift is non-zero indefinitely → the debounced "Reconciling…" badge latches on.

It also affects, to a lesser extent, every other `booking-changed` dispatch (Mark Paid, swaps, regen) — they all re-fetch the snapshot but leave the Payments rows behind for whatever the React Query staleTime allows.

## Fix

Invalidate the Payments-side caches whenever the snapshot is told to refetch. Two clean options exist; we'll do **both** because they reinforce each other and neither is sufficient alone.

### 1. Invalidate `activity-costs-payable` on `booking-changed` (PaymentsTab.tsx)

Add a `useEffect` in `PaymentsTab` that listens for `booking-changed` and calls:
```ts
queryClient.invalidateQueries({ queryKey: ['activity-costs-payable', tripId] });
queryClient.invalidateQueries({ queryKey: ['trip-inclusion-toggles', tripId] });
fetchPayments();
```
This pulls the fresh `activity_costs` rows that `usePayableItems` consumes, in lockstep with the snapshot refetch.

### 2. Make Fix Timing dispatch `booking-changed` only once, after autosave commits

Currently `handleApplyRefreshChanges` flips `setHasChanges(true)` → 3-second debounced autosave → backend reprojection. The Payments tab refetch happens whenever `booking-changed` fires from inside the cost-sync chain (`syncBudgetFromDays` line 1474). Fix Timing doesn't change costs, but the autosave path still calls into `action-save-itinerary` whose preserve/repair pipeline may emit a recomputed cost block that triggers the trigger.

Add a defensive guard inside `useTripFinancialSnapshot.fetchData`: if the new `totalCents` matches the previous fetched `totalCents` exactly, skip the `setData` (already a no-op) **and also skip the `setLastDelta`** — already the case. No code change needed here; just confirm.

The real change is to make Fix Timing's downstream re-render path explicit: after the apply path's `setHasChanges(true)`, also invalidate the Payments queries so the bucket recomputes against the same activity_costs the snapshot will see, even if the autosave hasn't fired yet.

In `EditorialItinerary.tsx` `handleApplyRefreshChanges` (~line 2566): after `setHasChanges(true)`, dispatch `window.dispatchEvent(new CustomEvent('booking-changed', { detail: { tripId } }))`. With the new listener in #1, this synchronizes both sides immediately.

### 3. Drop the `'activity-costs-payable'` cache `staleTime` to 0 (PaymentsTab.tsx line 249)

Belt-and-braces: ensure the query is always considered stale so any external invalidation re-fetches without delay.

## Out of scope

- The trigger / reprojection logic itself is correct; we only need the UI caches to track it.
- The 1.5 s debounce on the badge stays as-is; it's correct behavior for transient flicker, just couldn't survive a permanent stale-cache mismatch.

## Files to edit

- `src/components/itinerary/PaymentsTab.tsx` — add `booking-changed` listener that invalidates the Payments queries; set `staleTime: 0` on `activity-costs-payable`.
- `src/components/itinerary/EditorialItinerary.tsx` — in `handleApplyRefreshChanges`, dispatch `booking-changed` after `setHasChanges(true)`.

## Verification

1. Trigger Fix Timing on a Rome day with overlap; confirm Payments header transitions through "Matches itinerary" → (nothing visible) → "Matches itinerary" without the badge ever sticking.
2. Mark an activity Paid; confirm header still resolves to "Matches itinerary" within ~1 s.
3. Regenerate a day; confirm same.