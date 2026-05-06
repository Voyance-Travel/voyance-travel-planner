# Reconcile Payments buckets to the Trip Total ($987 vs $1,035 bug)

## Why this keeps happening

Two hooks compute totals from the **same** ledger but apply **different** rules:

| Rule | `useTripFinancialSnapshot` (header $987) | `usePayableItems` (rows $1,035) |
|---|---|---|
| Toggles (hotel/flight) | ✅ | ✅ |
| Drops rows whose `activity_id` is gone from `itinerary_data` | ✅ drops them | ❌ orphan-**rescues** by reassigning to a live activity, then counts |
| `$0` DB row + positive JSON `cost` (paid category) | uses DB `$0` | rewrites cents to **JSON cost × travelers** |
| Adds **Misc / Spending Money reserve** | ✅ adds to total | ❌ never appears as a row |
| Manual `activity` payments | ✅ via `manualOtherCents` | ✅ via `addManualGroups('activity')` |

Net effect on this trip: the JSON-cost rescue and/or orphan-rescue inflate the activity bucket above what the snapshot counts, while the misc reserve quietly inflates the snapshot above the visible row sum. Either direction can win — yesterday it was Paris (rows < total), today it's $1,035 > $987.

This is the same shape of "AI/extraction inconsistency" pattern: two consumers of the same data apply slightly different cleanup heuristics and end up with two answers.

## Fix Plan

Make the two hooks **share a single canonical pricing function** so a bucket sum is mathematically forced to equal the headline.

### 1. Extract `resolveCanonicalCostRows(args)`
New file: `src/services/canonicalCostRows.ts`. Pure function. Inputs: `activityCosts`, `liveActivityIds`, `liveActivityById` (for JSON-cost rescue), `includeHotel`, `includeFlight`, `manualPayments`, `miscReserveCents`. Output:

```ts
{
  rows: Array<{
    kind: 'activity-cost' | 'manual' | 'reserve',
    sourceRowId: string,
    effectiveActivityId?: string,        // post-rescue
    dayNumber: number,
    category: string,
    cents: number,
    rescueTag?: 'orphan-id' | 'json-zero-rescue',
  }>,
  totalCents: number,
  hotelCents: number,
  flightCents: number,
  reserveCents: number,
}
```

The function applies in this exact order: toggle filter → orphan-id rescue or drop (one shared decision) → `$0` JSON rescue (one shared decision) → reserve injection.

### 2. Rewire both hooks to consume it
- `useTripFinancialSnapshot` replaces its inline `for (const row of costs)` block with `const canonical = resolveCanonicalCostRows(...)` and uses `canonical.totalCents` directly.
- `usePayableItems` builds its `result` array from `canonical.rows` instead of re-walking `activityCosts`. Transit grouping, naming, and orphan-payment recovery layer on top of the same rows.

### 3. Surface the Misc Reserve as a real line item
In `usePayableItems`, when `canonical.reserveCents > 0`, push a synthetic `essentialItems` row:

```
{ id: 'misc-reserve', type: 'other', name: 'Spending money & tips reserve', amountCents: reserveCents }
```

Now the buckets visibly add up to the header — no invisible delta. (The reserve already counts toward the budget; this just stops it from hiding.)

### 4. Add a runtime invariant
In `PaymentsTab.tsx`, after computing `estimatedTotal` and the bucket sum, assert:

```ts
const bucketSum = essentialItems.reduce(...) + activityItems.reduce(...);
if (Math.abs(bucketSum - estimatedTotal) > 100) {  // > $1
  console.warn('[PaymentsTab] reconciliation drift', { bucketSum, estimatedTotal, diff });
  // existing "Reconciling…" badge already triggers off this discrepancy;
  // strengthen its tooltip with the actual delta and direction.
}
```

This is the safety net: any future regression that re-introduces a divergent rule fires immediately in console + tooltip instead of silently skewing the breakdown.

### 5. Make the header label honest
The "Matches itinerary" badge under "Trip Total" currently fires whenever `tripTotalCents > 0`. Change it to fire only when the invariant in step 4 passes (`|bucketSum − estimatedTotal| ≤ $1`). Otherwise show "Reconciling…" with the delta tooltip we already built.

## Files to change
- `src/services/canonicalCostRows.ts` *(new)* — single source of truth
- `src/hooks/useTripFinancialSnapshot.ts` — delegate the activity-cost loop to canonical
- `src/hooks/usePayableItems.ts` — build rows from canonical instead of re-walking
- `src/components/itinerary/PaymentsTab.tsx` — runtime invariant, honest "Matches itinerary" badge
- `src/hooks/__tests__/canonicalCostRows.test.ts` *(new)* — covers: orphan-rescue parity, JSON-zero rescue parity, misc reserve appears as a row, sum-of-rows = totalCents.

## Verification
- Open the Rome trip showing $987/$1,035: header and "Activities & Experiences" + "Spending money reserve" rows must add to the same dollar.
- Toggle Include Hotel / Include Flight: header and bucket sum stay in lockstep on every toggle.
- Add a manual activity expense: it appears as a row AND moves the header by exactly its amount.
- Force an orphan row in the DB: the row is either dropped from both views or rescued in both views — never one-sided.
- Unit test `bucketSum === totalCents` across 6 fixture trips (clean, with-orphans, with-zero-cost-dining, with-misc-reserve, hotel-toggled-off, flight-toggled-on).

## Out of scope
- Migration / backfill of orphaned `activity_costs` rows. The shared resolver makes them harmless either way; cleanup can be a separate maintenance task.
- Changing how the AI itself prices activities (this is a **reconciliation** fix, not an estimation fix).
