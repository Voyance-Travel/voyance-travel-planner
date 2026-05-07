## Problem

On the Venice luxury trip, Day 1 shows:

- **Day badge:** ~€51/pp
- **Activity cards visible total:** ≥ €102 (lunch ~€17 + dinner ~€85)

User reads "math is broken." The numbers are actually internally consistent — €102 is the **group total** and €51 is the **per-person** half — but the UI mixes the two units on the same screen, with tiny `/pp` suffixes that are easy to miss.

## Root cause

Both surfaces compute from the same data, but render in different units:

1. **Day badge** (`EditorialItinerary.tsx` ~9895–9902) — `breakdownPerPersonUsd = breakdownGroupUsd / travelers`. Always per-person when `travelers > 1`, suffixed `/pp`.
   - For Venice Day 1: ledger has 2 dining rows of `cost_per_person_usd` 10 and 50 → group $120 → $60/pp → ~€51/pp. ✓

2. **Activity cards** (`getActivityCostInfo`, lines 1044–1078) — when JSONB `cost.amount` is 0 (which is the case for every Venice Day 1 row), the code falls through to `estimateCostSync`. That engine multiplies per-person × travelers internally for dining categories, so the function returns the **group total** and re-tags `basis = 'flat'`. `basisLabel('flat', 2)` returns `''`, so the card renders the group number with **no `/pp` suffix**.
   - Venice Day 1 cards: dinner shows `~$100` → ~€85, lunch shows `~$20` → ~€17. Sum ≈ €102.

So the day badge is in `/pp` and the cards are in group total. They sum to the right ratio (€102 / 2 = €51) but look broken because the units aren't visible side-by-side and the `/pp` suffix on the badge is small.

A second contributor: every visible card cost on this trip is an *estimate* (`~`), because the JSONB `cost.amount` is `0` for every Day 1 activity even though `activity_costs` has real numbers (`itinerary-sync` rows from the editor sync). The card path doesn't consult `activity_costs` for non-floor sources, so it falls back to AI estimation. Cards say `~€85` even though the ledger has the same number with high confidence.

## Fix

Three changes, all in `src/components/itinerary/EditorialItinerary.tsx`. No backend changes.

### 1. Make cards consult the ledger for any source, not just protected floors

Today `getLedgerOverride` only returns a value when the row's `source` is in `PROTECTED_FLOOR_SOURCES` (Michelin, ticketed, auto-corrected, reference). Extend `useLedgerCostOverrideMap` (`src/utils/ledgerCostOverride.ts`) to load **all** rows, but record their source. In `getActivityCostInfo`:

- If a ledger row exists for this `activity.id`, prefer it as the card's cost when:
  - The JSONB `cost.amount` is 0 / missing, OR
  - The source is one of the protected floors (existing behavior).
- The override returns the value with `basis: 'per_person'` (since `cost_per_person_usd` is per-person by definition) and `isEstimated: false` (ledger writes are confirmed).

Result for Venice Day 1: lunch card shows `$10/pp` (≈ €8.5/pp), dinner card shows `$50/pp` (≈ €43/pp). Sum = €51/pp, matches the badge exactly. No more `~` either.

### 2. Stop tagging dining estimates as `flat` group totals

Lines 1065–1070 retag dining as `basis = 'flat'` after `estimateCostSync` because that engine pre-multiplies. That's the unit-mixing bug for cards. Replace the retag with a divide:

```ts
const isPerPersonDining = PER_PERSON_ENGINE_CATS.has((category || '').toLowerCase());
const finalAmount = isPerPersonDining
  ? Math.round(amount / Math.max(travelers, 1))
  : amount;
const finalBasis: CostBasis = isPerPersonDining ? 'per_person' : basis;
```

Now cards show per-person dining values consistently with `/pp`, matching the badge unit. The existing per-person tooltip ("Group total: …") that's already wired up at line 11774 will surface the multiplication for users who want it.

### 3. Defensive day-badge consistency check (dev only)

Add a `console.warn` in `DayCard` when the rendered day badge value diverges from the sum of visible card costs by more than 5%, so this regresses loudly in dev rather than silently:

```ts
if (process.env.NODE_ENV !== 'production') {
  const cardSum = day.activities.reduce((s, a) => {
    const i = getActivityCostInfo(a, travelers, budgetTier, destination, destinationCountry, isManualMode);
    if (i.isEstimated && !isManualMode) return s;
    const perPp = i.basis === 'per_person' ? i.amount : i.amount / Math.max(travelers, 1);
    return s + perPp;
  }, 0);
  if (totalCost > 0 && Math.abs(cardSum - totalCost) / totalCost > 0.05) {
    console.warn(`[DayCard] Day ${day.dayNumber} badge ${totalCost.toFixed(2)} vs cards sum ${cardSum.toFixed(2)} (>5% drift)`);
  }
}
```

## Verification

- Reload the Venice trip → Day 1 lunch card reads `$10/pp` (~€8.5/pp), dinner reads `$50/pp` (~€43/pp), badge stays at ~€51/pp. Sum of card per-person values = badge.
- Toggle a different trip with non-dining estimates (museum, transit) → those cards still render in their original basis (transit per_person, attractions per_person), nothing regresses.
- Hover the dinner card tooltip → still shows "Group total: €85" for travelers = 2.
- Dev console: no `[DayCard]` drift warning on any rendered day.

## Out of scope

- Backfilling JSONB `cost.amount` from the ledger (separate cleanup; the card-side ledger lookup makes it unnecessary for display).
- Reworking the unified `/pp` vs group toggle in the trip header (that toggle is intentional and unaffected).
