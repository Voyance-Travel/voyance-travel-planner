# Payments Tab Currency Parity — Verification

Re-checked the previously implemented fix. Everything is in place and no further edits are required.

## What's wired

**`src/components/itinerary/PaymentsTab.tsx`**
- `tripCurrency?: string` prop (default `'USD'`)
- `displayMoney(usdCents)` callback uses `formatMoneyFromUsdCents` from `@/lib/currency` (the same FX path the header uses)
- Every user-facing money render (Trip Total, paid/unpaid, per-bucket sub-totals, splits, modals, delete confirmations — 25+ sites) goes through `displayMoney`
- The cents-only `formatCurrency` from `@/services/tripPaymentsAPI` is no longer imported

**`src/components/itinerary/EditorialItinerary.tsx`**
- Passes `tripCurrency={tripCurrency}` into `<PaymentsTab>`

**Reconciling badge (lines 1249–1261)**
- Compares `estimatedTotal` vs `displayedTotal.displayedTotalCents` in raw USD cents (≤ $1 tolerance) — units stay consistent so the badge can actually clear
- Wrapped in `useReconcilingState` so it doesn't latch on transient renders

## Recommendation

No code changes. If a specific trip is still showing a mismatch, share:
1. Trip URL
2. Exact header number vs Payments number (with currency symbol)
3. Any `[PaymentsTab] divergence` line from the browser console

That will tell us whether it's (a) a new data-side drift (snapshot vs payable items), or (b) a stale-cache reload issue, neither of which the currency-render fix is meant to address.
