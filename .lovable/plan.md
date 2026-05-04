# Le Bon Marché missing from Payments — fix

## Root cause

The activity exists in the itinerary JSON with `cost.amount = 0` and no row in `activity_costs` (it's `category: 'shopping'`, which the cost-repair pipeline doesn't write rows for).

So `usePayableItems`' JSON-walk fallback runs for it and:

1. Reads `explicit = 0` from `a.cost.amount`.
2. Passes `explicitCost: 0` into `estimateCostSync`.
3. `estimateCostSync` short-circuits on `explicitCost !== undefined && explicitCost >= 0` and returns `amount: 0`.
4. The fallback drops the row (`if (cents <= 0) continue`).

Net effect: any paid-category activity stored with `cost.amount = 0` (a missing-data placeholder, not a confirmed free experience) silently disappears from Payments.

## Fix — one file

**`src/hooks/usePayableItems.ts`** (JSON-walk fallback, ~line 388):

Treat `explicit === 0` as "no cost recorded, please estimate" — only pass `explicitCost` to `estimateCostSync` when it's strictly positive. This lets the priceLevel / city-tier estimator produce a real number for shopping, activity, dining, etc. rows that came in with a placeholder `$0`.

```ts
const explicitRaw = /* …same extraction… */;
const explicit = (typeof explicitRaw === 'number' && explicitRaw > 0) ? explicitRaw : undefined;
```

That's the entire change. After it ships, Le Bon Marché will appear with a Paris-shopping estimate (priceLevel/midpoint-based) until the user records an actual amount.

## Why not also write an `activity_costs` row?

The cost-repair pipeline intentionally skips `shopping` (along with other discretionary categories) because budgets for shopping are user-driven. The Payments tab should still surface the activity so the user can mark it paid / enter a real amount — the fallback estimate is the right vehicle for that, we just have to stop letting `0` masquerade as truth.

## Out of scope (still pending from earlier)

- Generic-named itinerary rows (`Dinner (Day 2)`, `transport (Day 2)`).
- Hotel committed without `pricePerNight`.
- All-Costs list collapse bug.
