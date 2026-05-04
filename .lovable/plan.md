# Make Budget & Itinerary Currency Display Consistent

## What's actually happening

Both the itinerary header ("Trip Total") and the Budget tab read the **same** canonical number — `financialSnapshot.tripTotalCents`, stored in **USD cents**. The discrepancy is purely a **display-layer** problem:

| Surface | Value source | What it does to it |
|---|---|---|
| Itinerary header | `tripTotalCents / 100` (USD) | Converts USD → EUR via `convertFromUSD` using a hardcoded `EUR: 0.92` rate; renders with `€` |
| Budget tab | `tripTotalCents / 100` (USD) | Renders directly with the user's `budget_currency` glyph (`$` today). **No conversion applied.** |

Result: the two surfaces show the **same underlying USD number** dressed in different currency clothing. The `~1.28` "implied rate" the user noticed isn't a real rate — it's an artifact of the budget tab showing raw USD ($2,921) and the header showing a 0.92x converted EUR figure (€2,287 ≈ $2,486). The remaining $435 gap is hotel/flight reconciliation timing (snapshot vs. fallback path on line 3338-3340) which I'll align as part of this fix.

Additional issues found:

1. **Static FX table.** `EXCHANGE_RATES_FROM_USD` lives in `EditorialItinerary.tsx` with hardcoded rates from ~2024. EUR is `0.92`, today's mid-market is ~`0.86`. No "rate as of" disclosure.
2. **Budget tab can lie.** If a user picks `budget_currency = 'EUR'`, the tab will print "€2,921" against a value that's actually 2,921 USD cents. No conversion, no warning.
3. **No rate disclosure anywhere.** Neither surface tells the user what FX rate they're seeing or that it's an estimate.

## Plan

### 1. Single shared currency module
Extract `EXCHANGE_RATES_FROM_USD`, `convertFromUSD`, `convertToUSD`, and a new `formatMoney(cents, currency)` helper out of `EditorialItinerary.tsx` into `src/lib/currency.ts`. Add a `RATES_AS_OF` constant (e.g. `'2026-05-04'`) exported alongside the table. Refresh EUR/GBP/JPY/CHF/CAD/AUD/MXN to current mid-market rates.

### 2. Make the Budget tab convert, not just relabel
In `useTripBudget.ts`, change `formatCurrency(cents)` to:
- Treat input cents as USD (the canonical storage unit).
- If `settings.budget_currency !== 'USD'`, run the value through `convertFromUSD` before formatting.
- Use the new shared `formatMoney` helper so both surfaces share one code path.

This means a Paris trip with `budget_currency = 'EUR'` will correctly show **€2,687** for a $2,921 USD trip, not "€2,921".

### 3. Align the header and budget total
The itinerary header total falls back to `totalActivityCost*travelers + flightCost + hotelCost` only while the snapshot is loading (line 3338). Verify the Paris trip's snapshot is actually loaded when the header renders — if it is, both surfaces will read the same `tripTotalCents` and (after step 2) display the same converted number. Add a brief loading skeleton on the header total to prevent the fallback path from flashing a stale value.

### 4. Disclose the rate
Add a small tooltip/info icon next to both totals (header `Trip Total` and Budget tab `Trip Total`) reading:
> "Converted at 1 USD = 0.86 EUR (rates as of May 4, 2026). Final charges may vary."
Only shown when display currency ≠ `USD`. Sourced from the new `RATES_AS_OF` constant so it stays honest when the table is updated.

### 5. (Optional, behind a follow-up) Live rates
Wire a daily refresh from a free FX endpoint (e.g. exchangerate.host or Frankfurter) into a Supabase edge function that updates a `fx_rates` table; the client reads that instead of the static map. **Not in this turn unless you ask** — current scope is to make the static rates honest and consistent.

## Files touched

- **new** `src/lib/currency.ts` — shared rates table, converters, `formatMoney`, `RATES_AS_OF`
- `src/components/itinerary/EditorialItinerary.tsx` — import from shared module, drop the inline copy, add rate-disclosure tooltip on the header total
- `src/hooks/useTripBudget.ts` — convert via `convertFromUSD` when `budget_currency !== 'USD'`
- `src/components/planner/budget/BudgetTab.tsx` — add the same rate-disclosure tooltip next to the Trip Total row

## What this fixes for the user's Paris trip

- Header and Budget tab will print **the same number** in whatever currency the user picks.
- EUR rate moves from stale `0.92` to current `~0.86`, bringing the header closer to a defensible number.
- If they switch the budget currency to EUR, they'll see a real €-converted figure, not USD-with-a-euro-sign.
- Both totals will show "as of {date}" so the conversion is no longer opaque.

## Out of scope

- Live FX feed (separate follow-up).
- Per-activity native-currency storage (the canonical USD model is fine; this plan only fixes the *display* inconsistency).
- The Day 2 nightcap $0 / orphan taxi data fix from the prior turn — that's a separate data repair and still pending.
