# EUR display rounding makes a single rate look like many

## What's actually happening

There is exactly one EUR rate in the app: `1 USD = 0.86 EUR` (≡ `1.1628 USD/EUR`), defined in `src/lib/currency.ts`. Every line reconciles to that rate exactly:

| Item | DB USD/pp | × 0.86 = EUR/pp | Displayed as |
|---|---|---|---|
| Holybelly | $25.00 | €21.50 | **€22** (rounded) |
| Bouillon Pigalle | $25.00 | €21.50 | **€22** (rounded) |
| L'Entrecôte | $50.00 | €43.00 | **€43** (no round) |
| Robuchon | $180.00 | €154.80 | **€155** (rounded) |
| Spa / Musée Hébert / Les Bains | $65.22 | €56.09 | **€56** (rounded) |
| Louvre | $24.00 | €20.64 | **€21** (rounded) |

Total stays in unrounded USD (the source of truth), then renders. So when a user back-computes `displayed_eur × 2 / displayed_usd_total`, they get rates ranging 1.13–1.18 even though there's only one rate.

## The fix

`formatCurrency` (in `src/lib/currency.ts`) currently uses `minimumFractionDigits: 0, maximumFractionDigits: 0` for every currency. That zero-decimal rendering is what creates the apparent inconsistency.

Change: when the value would round more than ~$1 worth (i.e. for non-USD per-person amounts under ~$200), render with **one decimal place**. This:
- Shows €21.5 instead of €22 → user's back-calculation gives the right rate.
- Keeps large totals tidy (€1,234 not €1,234.0) by capping decimals at the unit-magnitude threshold.

Concrete rule:
```ts
// Whole-currency unit amounts under 100 in non-USD currencies show 1 decimal,
// so back-of-envelope math reconciles to the published FX rate.
const useDecimal = currency.toUpperCase() !== 'USD' && Math.abs(amount) < 100;
new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency,
  minimumFractionDigits: useDecimal ? 1 : 0,
  maximumFractionDigits: useDecimal ? 1 : 0,
}).format(amount);
```

USD continues to render as whole dollars (matches existing UI everywhere).

## Files to change

- `src/lib/currency.ts` — `formatCurrency` decimal rule.

That's the entire fix. Totals don't change (they were always correct USD), only the per-person dual-display becomes self-consistent.

## Out of scope

This does not address the real-world rate drift (0.86 vs ~0.92 spot today) — that's a rate-table refresh decision, not a math bug, and the disclosure tooltip already says "rates as of May 4, 2026… final charges may vary."
