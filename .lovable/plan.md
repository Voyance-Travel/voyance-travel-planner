# Phantom "Trip total changed" toast on Payments tab open

## Symptom
Switching to the Payments tab fires a `Trip total changed by ±$X` toast (e.g. +$355, −$624) without any user action. Intermittent (Casablanca / Amsterdam yes; Kyoto / Osaka no) — fires only when system reconciliation actually moves the number on tab mount.

## Root cause

`useTripFinancialSnapshot` is shared by the itinerary header AND the Payments tab. When PaymentsTab mounts it runs three system-side reconciliations:

1. `expire_stale_trip_payments` RPC (L239) — flips dead Stripe sessions to `failed`.
2. `archive_orphan_trip_payments` — fires from inside the snapshot hook itself when JSON drops an activity that still has a `trip_payments` row (L342–371). The hook then dispatches its OWN `booking-changed` event to re-sync siblings.
3. `sync-trip-cost-table` backfill — fires when activity_costs coverage <50% (L407–429). Same self-dispatch pattern.

Each of these legitimately changes the trip total, and the snapshot hook's already-live instance (mounted by the itinerary header before the user reached Payments) re-runs `fetchData`, computes `prev → new` delta, sees a >25% jump, and fires `toast.warning("Trip total changed by …")`. The user never touched anything.

The existing 4-second `STABILIZATION_MS` window only suppresses deltas right after mount — system-reconciliation toasts fire well after that window because the reconciliation is triggered by the user navigating to a tab, not by the hook's first read.

## Fix — tag system events as silent, suppress one toast

### 1. `src/hooks/useTripFinancialSnapshot.ts`
- Add `suppressNextToastRef = useRef(false)`.
- When the hook itself dispatches `booking-changed` after orphan archive (L369) or backfill (L428), include `detail: { tripId, silent: true, reason: 'orphan-archive' | 'backfill' }`.
- In the `booking-changed` listener (L572): if `detail.silent === true`, set `suppressNextToastRef.current = true` BEFORE calling `fetchData()` (covers both the immediate and 600ms trailing refetch).
- In the toast block (L485–528): if `suppressNextToastRef.current`, log `[useTripFinancialSnapshot] suppressed system-reconcile toast (reason=…)`, clear the ref, and skip both `toast.info` and `toast.warning` paths. Still update `lastDelta` so the in-app delta badge can attribute the change.

### 2. `src/components/itinerary/PaymentsTab.tsx`
- After `expire_stale_trip_payments` (L239), if the RPC returns `expired_count > 0`, dispatch `window.dispatchEvent(new CustomEvent('booking-changed', { detail: { tripId, silent: true, reason: 'expire-stale' } }))` so the snapshot's listener marks the next refetch silent.
- The user-clicked "Reconcile previous payments" path (L1224) stays loud — it's user-initiated, so toast is appropriate (already a `toast.success` is shown there; suppressing the snapshot toast for that one is also correct → dispatch silent there too).

### 3. Mount-time silence
- `PaymentsTab` `fetchPayments` initial run (L252): set `silent: true` on the dispatched event so that any reconciliation triggered by tab-open never produces a phantom warning toast.

## Out of scope
- Don't change the >25% threshold or the existing user-driven toast behavior (e.g. Mark Paid, Add Booking still toast as before because those dispatch loud events).
- Don't change the `lastDelta` state (the small in-card "Pricing updated" badge stays; only the modal toast is suppressed).
- Tests: add one regression spec asserting that a `booking-changed` event with `detail.silent: true` does not call `toast.warning` even when the post-fetch delta exceeds 25%.

## Files touched
- `src/hooks/useTripFinancialSnapshot.ts`
- `src/components/itinerary/PaymentsTab.tsx`
- `src/hooks/__tests__/useTripFinancialSnapshot.silent.test.ts` (new)
- `mem://constraints/finance/silent-system-reconcile-toast` (new memory entry capturing the silent-event contract)
