## Goal
Eliminate the EUR rate drift (0.86 vs 0.92) and any future divergence by making the FX table a single shared module read by both the frontend and the edge function.

## Constraint
Edge functions (Deno) cannot import from `src/lib/...`, and `src/` should not import from `supabase/functions/<name>/...`. The realistic SOT location is `supabase/functions/_shared/`, which Vite can resolve from the frontend and Deno can resolve from edge code.

## Changes

### 1. New shared module: `supabase/functions/_shared/exchange-rates.ts`
- Export `RATES_AS_OF`, `RATES_AS_OF_LABEL`, `EXCHANGE_RATES_FROM_USD` (the canonical 2026-05-04 table currently in `src/lib/currency.ts`, EUR=0.86).
- Export helpers `convertFromUSD(amount, ccy)`, `convertToUSD(amount, ccy)`, `hasRate(ccy)` derived from the same table (TO_USD = 1 / FROM_USD).
- No Deno-only or Vite-only APIs — pure TS constants + functions.

### 2. `src/lib/currency.ts`
- Delete the inline `EXCHANGE_RATES_FROM_USD` table, `convertFromUSD`, `convertToUSD`, `hasRate`, `RATES_AS_OF`, `RATES_AS_OF_LABEL`.
- Re-export them from `../../supabase/functions/_shared/exchange-rates.ts` so existing `import { … } from '@/lib/currency'` call sites keep working unchanged.
- Keep `formatCurrency`, `formatMoneyFromUsdCents`, `rateDisclosure` here (display concerns, frontend-only).

### 3. `supabase/functions/generate-itinerary/currency-utils.ts`
- Delete the local `EXCHANGE_RATES_TO_USD` table and the local `convertToUSD` body.
- Re-export `convertToUSD` from `../_shared/exchange-rates.ts`. Provide a thin `EXCHANGE_RATES_TO_USD` shim (derived from `EXCHANGE_RATES_FROM_USD`) for back-compat with the two call sites that import the constant by name (`generation-core.ts`, `action-generate-day.ts`), so we don't have to touch them.
- Keep `normalizeCostToUSD`, `deriveIntelligenceFields`, `isRecurringEvent` exactly as-is — those are unrelated logic.

### 4. Verification
- `rg "EXCHANGE_RATES_(TO|FROM)_USD\s*[:=]\s*\{" src supabase/functions` → expect only the one definition in `_shared/exchange-rates.ts`.
- `rg "EUR:\s*0\.92"` → expect 0 matches.
- Run the existing `src/lib/trip-pricing.test.ts` and any currency-touching tests.
- Spot-check a EUR trip in preview: F&D card total and trip-total header should now agree.

### Out of scope
- Refreshing rate values (they stay at the 2026-05-04 levels currently in `src/lib/currency.ts`).
- Touching `formatCurrency` in `src/services/tripPaymentsAPI.ts` (independent helper).
- Adding a live FX feed.

## Files touched
- New: `supabase/functions/_shared/exchange-rates.ts`
- Edited: `src/lib/currency.ts`, `supabase/functions/generate-itinerary/currency-utils.ts`