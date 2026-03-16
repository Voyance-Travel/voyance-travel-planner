

## Remaining Discrepancies — Root Causes and Fixes

### Issue 1: Per-person rounding ($166 vs $165.50)
**Budget tab** already uses `Math.floor` (line 491). **Payments tab** still uses `Math.round` (lines 1197, 1233). Fix: change both to `Math.floor`.

### Issue 2: $331 vs $331.20 — Different formatCurrency functions
Two different `formatCurrency` functions with different rounding:
- **Budget tab** (local): `maximumFractionDigits: 0` → shows `$331`
- **Payments tab** (from `tripPaymentsAPI.ts`): default 2 decimals → shows `$331.20`

Fix: Make both use `maximumFractionDigits: 0` for the trip total display. Round the snapshot cents to the nearest whole dollar at the source in `useTripFinancialSnapshot`, so all consumers get the same integer cents.

### Issue 3: Day totals don't add up to Trip Total
`getDayTotalCost` calls `getActivityCost` → `getActivityCostInfo` which runs `estimateCostSync` for activities without explicit prices (e.g., Imperial Palace walk gets ~$35). These estimated costs inflate the per-day badge but are NOT in `activity_costs` (the canonical total).

Two options:
- **Option A**: Remove estimates from day badges — show only confirmed costs. Day badges would be lower but consistent with the Trip Total.
- **Option B**: Write estimated costs to `activity_costs` during generation so they're included in the canonical total. Day badges and trip total would both be higher but consistent.

**Recommendation: Option A** — Show only confirmed costs in day badges. This is simpler, avoids inflating the DB total with guesses, and matches the budget transparency mandate. Add a subtle indicator when a day has activities with no price data.

### Files to change

| File | Change |
|------|--------|
| `src/services/tripPaymentsAPI.ts` | Update `formatCurrency` to use `maximumFractionDigits: 0` |
| `src/components/itinerary/PaymentsTab.tsx` | Change `Math.round` to `Math.floor` for per-person display (2 locations) |
| `src/components/itinerary/EditorialItinerary.tsx` | Update `getActivityCost` / day badge to only show confirmed costs (skip `estimateCostSync` for display totals), or add a note like "+" when estimates are included |

### Expected outcome
- Budget shows $331, Payments shows $331 (same rounding)
- Per-person: $165/person everywhere (floor of $165.50)
- Day badges show confirmed costs only, matching the canonical trip total when summed

