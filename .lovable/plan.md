## Real bug

Payments shows the **correct** $235 group total for "Nightcap at Le Bar" (2 guests in Paris). The itinerary card is the one lying — it labels the same $235 as "$235 /pp" and the tooltip says "Group total: $470" (i.e. it multiplies by travelers a second time).

### Why

`estimateCostSync(category: 'dining', travelers: 2, …)` in `src/lib/cost-estimation.ts` (line 285) computes:

```
subtotal = perPerson * travelers     // already group total for dining
total    = round(subtotal * (1 + tax_tip_buffer) / 5) * 5
```

It returns `{ amount: total /* group */, perPerson, … }`.

In `src/components/itinerary/EditorialItinerary.tsx` (~line 1002), the wrapper takes `result.amount` and returns `{ amount, basis }` where `basis` was defaulted to `'per_person'` higher in the function. Result: card displays the group total but tags it `/pp` and the tooltip helpfully multiplies it by travelers AGAIN to show a phantom "Group total".

This affects **every estimated dining/restaurant/bar row** with `travelers > 1` — the visible per-person price in the itinerary is inflated 2× (or 3×, 4× for larger groups).

## Fix (one place)

In `EditorialItinerary.tsx` around lines 1015-1021, when the result came from `estimateCostSync` for a per-person category (dining/restaurant/breakfast/brunch/lunch/dinner/cafe/coffee), return the cost with `basis: 'flat'` — meaning "this number IS the group total, do not show /pp and do not multiply".

```ts
const PER_PERSON_CATS = new Set(['dining','restaurant','breakfast','brunch','lunch','dinner','cafe','coffee']);
const engineBasis: CostBasis = PER_PERSON_CATS.has(category.toLowerCase())
  ? 'flat'   // engine already multiplied by travelers
  : basis;   // attractions/activities: engine returns per-person flat anyway

return { amount, isEstimated: result.isEstimated, estimateReason: result.reason, confidence: result.confidence, basis: engineBasis };
```

Net effect on the card:
- `basisLabel(basis='flat', travelers=2)` → no "/pp" suffix
- The "Group total" tooltip line (`travelers > 1 && basis === 'per_person'`) won't render
- Headline number stays $235 — matches Payments

## Why not change the engine

Other call sites (Payments JSON-walk, budgetLedgerSync) already consume `estimateCostSync().amount` as the group total. Changing the engine would require recalibrating every consumer. The display-side fix is one diff and makes the contract explicit at the boundary.

## Files

- `src/components/itinerary/EditorialItinerary.tsx` — set `basis: 'flat'` for engine-estimated per-person categories
- No DB changes; no edge-function changes. The Payments tab is already correct.

## Result

- Itinerary row: `$235` (no `/pp` suffix), tooltip drops the misleading "Group total: $470" line
- Payments row: unchanged at $235 — they finally agree
- All other multi-traveler dining estimates also self-correct
