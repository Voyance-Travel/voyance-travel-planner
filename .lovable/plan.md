
The mixed display (€38.7, €47.3, €20.6 vs €108, €70) is caused by `formatCurrency` in `src/lib/currency.ts` (lines 181-186): for non-USD amounts < 100, it forces 1 decimal; for amounts ≥ 100 or USD, it uses 0 decimals. The original intent — letting users back-compute the FX rate — is invisible to the typical reader and creates visible inconsistency.

## Fix

`src/lib/currency.ts` → `formatCurrency`:

- Drop the `< 100` decimal carve-out.
- Always render with `minimumFractionDigits: 0, maximumFractionDigits: 0` for whole-unit display across all currencies and amounts (matches the rest of the UI which already wraps values in `Math.floor(displayCost(...))`).
- Keep the `0 → "Free"` and `null/undefined → "-"` behavior.
- Update the JSDoc to reflect the rule: "always whole units; rounding handled at format time".

## Knock-on cleanup

Search for any other formatter that injects fractional digits into per-person dining or activity costs, in case a second path exists. Spot-check:
- `src/utils/formatCostMobile.ts` (M/K abbreviations — leave unchanged; those decimals serve a real purpose)
- `src/lib/budget-realism.ts` (multiplier `1.4×` — leave unchanged; not a price)
- Any inline `.toFixed(1)` on prices — none found in pricing render paths.

No two-decimal source identified yet — the user-reported "two decimals" is most likely the same `< 100` branch fed an amount that rounded to e.g. `€20.60`, where Intl will print `20.6` (one decimal) — once we force 0 fraction digits, both edge cases disappear in one change.

## Files touched
- `src/lib/currency.ts` — single function body change

## Out of scope
- No backend / generator changes.
- No FX rate change. Disclosure ("1 USD = 0.86 EUR") still surfaces for users who care about exact conversion.

Approve?
