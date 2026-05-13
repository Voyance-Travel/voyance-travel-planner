## Root cause

When the user clicks the **Payments** tab, `PaymentsTab` mounts a fresh `useTripFinancialSnapshot` instance. Its `fetchData()` runs orphan‑payment detection, finds at least one orphan, and fires the `archive_orphan_trip_payments` RPC. The RPC then dispatches a `booking-changed` event, which causes the **EditorialItinerary**'s long‑lived snapshot to refetch and observe a lower trip total — past the 4 s stabilization window — which triggers the "Trip total changed by −$624" toast.

The −$624 delta is real money disappearing from the tally. The bug is in the RPC, not the toast.

### The bug

`useTripFinancialSnapshot.ts` deliberately excludes `manual-*` rows from JS-side orphan detection (lines 238–239: `if (/^manual-/i.test(p.item_id)) continue;`). But the SQL function it calls does not honor that contract:

```sql
UPDATE public.trip_payments
SET archived_at = now(),
    archived_reason = 'orphan_reconcile'
WHERE trip_id = p_trip_id
  AND archived_at IS NULL
  AND item_type NOT IN ('flight', 'hotel')
  AND NOT (item_id = ANY(v_activity_ids));
```

`item_id = 'manual-<uuid>'` is by design never present in `itinerary_data.days[].activities[].id`, so every manual dining / transit / misc / "other" expense gets `archived_at = now(), archived_reason = 'orphan_reconcile'` the first time the JS finds *any* legitimate non-manual orphan and triggers the RPC.

Once archived, the snapshot's `from('trip_payments').is('archived_at', null)` filter drops them, the manual hotel/flight/other fold inside `resolveCanonicalCostRows` shrinks, and `totalCents` drops by exactly the lost manual amount (the user's $624). The toast is the messenger.

## Fix

### 1. SQL migration (`archive_orphan_trip_payments`)

Add the missing `manual-*` exclusion so the RPC honors the JS contract:

```sql
UPDATE public.trip_payments
SET archived_at = now(),
    archived_reason = 'orphan_reconcile'
WHERE trip_id = p_trip_id
  AND archived_at IS NULL
  AND item_type NOT IN ('flight', 'hotel')
  AND (item_id IS NULL OR lower(item_id) NOT LIKE 'manual-%')
  AND NOT (item_id = ANY(v_activity_ids));
```

### 2. One‑shot recovery in the same migration

Restore manual rows that the buggy RPC has already archived for any user, so the next snapshot recovers the missing $624 (and any equivalent manual loss on other trips):

```sql
UPDATE public.trip_payments
SET archived_at = NULL,
    archived_reason = NULL
WHERE archived_reason = 'orphan_reconcile'
  AND lower(item_id) LIKE 'manual-%';
```

### 3. JS defense‑in‑depth (`useTripFinancialSnapshot.ts`)

Belt‑and‑suspenders: when computing the orphan fingerprint, log a sentinel if the JS would have skipped a manual row but the RPC could have archived it pre‑fix. After the migration this is just observability; before/during rollout it confirms the SQL is doing the right thing.

```ts
// Sentinel — fires if archive_orphan_trip_payments ever returns a count
// that exceeds the JS-detected orphan set (i.e. manual rows leaked through).
if (count > orphanPaymentItemIds.size) {
  console.warn(`[useTripFinancialSnapshot] orphan archive over-count ${count} > js=${orphanPaymentItemIds.size} — manual leak suspected`);
}
```

### 4. Test

Extend `src/services/__tests__/canonicalCostRows.test.ts` (or co-located resolver tests) with a case proving:
- A `manual-hotel-…` row with `item_type: 'other'` and an unknown activity_id is **not** archived by orphan detection (i.e. its `amount_cents` survives in the manual fold across two consecutive snapshot fetches).

A second test in a new `__tests__/archive-orphan-rpc.test.ts` (or a Supabase RPC integration test if one exists in the repo) asserting the SQL excludes `lower(item_id) LIKE 'manual-%'` is optional — covered by the SQL change itself.

### 5. Memory

Add `mem://constraints/payments/manual-rows-orphan-immune`:

> `archive_orphan_trip_payments` MUST exclude `lower(item_id) LIKE 'manual-%'` to mirror the JS-side orphan-detection skip in `useTripFinancialSnapshot.ts`. Manual hotel/flight/other rows have no `activity_id` in the itinerary by design; archiving them silently drops their contribution from the trip total and surfaces as a phantom "Trip total changed by −$X" toast on Payments tab mount. Sentinel: `[useTripFinancialSnapshot] orphan archive over-count`.

Add a one-line entry to `mem://index.md` Memories pointing at the new constraint.

## Files

- `supabase/migrations/<ts>_archive_orphan_payments_skip_manual.sql` — new
- `src/hooks/useTripFinancialSnapshot.ts` — sentinel log only
- `src/services/__tests__/canonicalCostRows.test.ts` — add manual-row survival test
- `mem://constraints/payments/manual-rows-orphan-immune` — new
- `mem://index.md` — add reference

## Verification

After migration runs:
1. Reload the trip that produced the toast → snapshot total restores by $624 (manual rows un-archived).
2. Click Payments tab → no "Trip total changed" toast.
3. Console shows zero `[useTripFinancialSnapshot] orphan archive over-count` warnings on subsequent reloads.
