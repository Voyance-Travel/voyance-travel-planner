/**
 * Shared currency module — single source of truth for FX conversion & formatting.
 *
 * All canonical money values in the app are stored in **USD cents** (or whole USD).
 * Display-time conversion to a target currency happens here. Both the itinerary
 * header and the Budget tab read from this module so they always agree.
 *
 * Rates are static, hand-maintained mid-market approximations. Bump RATES_AS_OF
 * whenever the table is refreshed so the UI disclosure stays honest.
 */

// FX table & helpers are defined once in supabase/functions/_shared/exchange-rates.ts
// and re-exported here so existing `@/lib/currency` imports keep working.
// Edge functions import the same module directly; do NOT add a second table.
export {
  RATES_AS_OF,
  RATES_AS_OF_LABEL,
  EXCHANGE_RATES_FROM_USD,
  convertFromUSD,
  convertToUSD,
  hasRate,
} from '../../supabase/functions/_shared/exchange-rates';
import { EXCHANGE_RATES_FROM_USD, RATES_AS_OF_LABEL, convertFromUSD } from '../../supabase/functions/_shared/exchange-rates';

/**
 * Format a whole-currency-unit amount using Intl. Always renders whole units
 * across all currencies for visual consistency (no mixed €38.7 vs €108).
 * Pass `null`/`undefined` to render a dash; `0` renders as "Free".
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency: string = 'USD'
): string {
  if (amount === null || amount === undefined) return '-';
  if (amount === 0) return 'Free';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }
}

/**
 * Convenience: take canonical USD cents and format in the target currency,
 * applying FX conversion when needed. This is what the Budget tab and the
 * itinerary header should both use to stay in sync.
 */
export function formatMoneyFromUsdCents(
  usdCents: number,
  targetCurrency: string = 'USD'
): string {
  const usd = usdCents / 100;
  const amount =
    targetCurrency.toUpperCase() === 'USD' ? usd : convertFromUSD(usd, targetCurrency);
  return formatCurrency(amount, targetCurrency);
}

/**
 * Format raw cents that are ALREADY in `currency` (no FX conversion).
 * Use this for `settings.budget_total_cents` and budget-allocation rows —
 * never for `snapshot.tripTotalCents` (those are canonical USD cents and
 * must go through `formatMoneyFromUsdCents`).
 */
export function formatBudgetCurrencyCents(
  cents: number | null | undefined,
  currency: string = 'USD'
): string {
  if (cents === null || cents === undefined || !isFinite(cents)) return '-';
  return formatCurrency(cents / 100, currency);
}

/**
 * Canonical display currency for a trip surface (PaymentsTab + BudgetTab).
 * Rules:
 *   1. If a budget currency is set, it wins — the only meaningful comparison
 *      on either surface is "spent vs budget", and that requires one currency.
 *   2. Otherwise honor the user's local/USD toggle (tripCurrency).
 *   3. Default USD.
 */
export function getCanonicalDisplayCurrency(opts: {
  budgetCurrency?: string | null;
  tripCurrency?: string | null;
}): string {
  const bc = (opts.budgetCurrency || '').toUpperCase();
  if (bc) return bc;
  const tc = (opts.tripCurrency || '').toUpperCase();
  return tc || 'USD';
}

/** Human-readable rate disclosure, e.g. "1 USD = 0.86 EUR (rates as of May 4, 2026)". */
export function rateDisclosure(targetCurrency: string): string | null {
  const code = targetCurrency.toUpperCase();
  if (code === 'USD') return null;
  const rate = EXCHANGE_RATES_FROM_USD[code];
  if (!rate) return null;
  // Pick a sensible precision based on rate magnitude.
  const precision = rate >= 100 ? 0 : rate >= 10 ? 1 : rate >= 1 ? 2 : 3;
  return `1 USD = ${rate.toFixed(precision)} ${code} (rates as of ${RATES_AS_OF_LABEL}). Final charges may vary.`;
}
