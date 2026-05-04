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

// Last refreshed: 2026-05-04. Major pairs updated to current mid-market levels;
// long-tail rates retained from the prior table (may drift, used as fallbacks).
export const RATES_AS_OF = '2026-05-04';
export const RATES_AS_OF_LABEL = 'May 4, 2026';

// 1 USD = X units of target currency
export const EXCHANGE_RATES_FROM_USD: Record<string, number> = {
  USD: 1,
  EUR: 0.86,
  GBP: 0.74,
  JPY: 152,
  CHF: 0.82,
  CAD: 1.34,
  AUD: 1.50,
  NZD: 1.62,
  CNY: 7.15,
  HKD: 7.80,
  SGD: 1.30,
  THB: 34.5,
  MXN: 18.4,
  BRL: 5.10,
  INR: 84.5,
  KRW: 1370,
  ZAR: 18.5,
  SEK: 10.30,
  NOK: 10.55,
  DKK: 6.42,
  PLN: 3.95,
  CZK: 22.5,
  HUF: 355,
  ILS: 3.70,
  AED: 3.67,
  SAR: 3.75,
  TRY: 35.0,
  RUB: 95,
  PHP: 56.5,
  IDR: 16000,
  MYR: 4.45,
  VND: 25000,
  TWD: 32.0,
  ARS: 1050,
  CLP: 940,
  COP: 4150,
  PEN: 3.75,
  EGP: 49,
  MAD: 9.95,
  NGN: 1600,
  KES: 130,
  PKR: 280,
  BDT: 119,
  UAH: 41,
  RON: 4.55,
  BGN: 1.78,
  ISK: 138,
  // Long-tail (retained, less frequently refreshed)
  HRK: 6.93,
  NIO: 36.7,
  GTQ: 7.82,
  CRC: 530,
  PAB: 1,
  DOP: 60,
  JMD: 158,
  TTD: 6.78,
  BBD: 2,
  BSD: 1,
  BZD: 2,
  XCD: 2.70,
  AWG: 1.79,
  ANG: 1.79,
  BMD: 1,
  KYD: 0.82,
  FJD: 2.23,
  PGK: 3.95,
  WST: 2.72,
  TOP: 2.36,
  VUV: 119,
  SBD: 8.46,
  SCR: 13.5,
  MUR: 46,
  MVR: 15.4,
  LKR: 300,
  NPR: 135,
  BND: 1.30,
  KHR: 4100,
  LAK: 22000,
  MMK: 2100,
  MNT: 3450,
  KZT: 490,
  UZS: 12800,
  GEL: 2.70,
  AMD: 390,
  AZN: 1.70,
  BYN: 3.27,
  MDL: 17.8,
  BAM: 1.78,
  MKD: 53,
  RSD: 100,
  ALL: 92,
  XOF: 580,
  XAF: 580,
  GHS: 15.5,
  TZS: 2700,
  UGX: 3700,
  ZMW: 26.5,
  BWP: 13.6,
  NAD: 18.5,
  MZN: 64,
  AOA: 920,
  ETB: 120,
  SOS: 571,
  DJF: 178,
  ERN: 15,
  GMD: 70,
  GNF: 8600,
  LRD: 188,
  SLL: 22500,
  CVE: 95,
  MWK: 1735,
  STN: 21.5,
  SZL: 18.5,
  LSL: 18.5,
  QAR: 3.64,
  KWD: 0.31,
  BHD: 0.377,
  OMR: 0.385,
  JOD: 0.71,
  LBP: 89500,
  SYP: 13000,
  IQD: 1310,
  YER: 250,
  AFN: 72,
  IRR: 42000,
  TMT: 3.50,
  TJS: 10.9,
  KGS: 89,
};

/** Convert an amount from USD to the target currency. */
export function convertFromUSD(amountInUSD: number, targetCurrency: string): number {
  const rate = EXCHANGE_RATES_FROM_USD[targetCurrency.toUpperCase()];
  if (!rate) return amountInUSD;
  return amountInUSD * rate;
}

/** Convert an amount from a source currency to USD. */
export function convertToUSD(amount: number, sourceCurrency: string): number {
  const rate = EXCHANGE_RATES_FROM_USD[sourceCurrency.toUpperCase()];
  if (!rate || rate === 0) return amount;
  return amount / rate;
}

/** Whether we have a real (non-fallback) rate for this currency. */
export function hasRate(currency: string): boolean {
  return Object.prototype.hasOwnProperty.call(
    EXCHANGE_RATES_FROM_USD,
    currency.toUpperCase()
  );
}

/**
 * Format a whole-currency-unit amount using Intl.
 * Pass `null`/`undefined` to render a dash; `0` renders as "Free".
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency: string = 'USD'
): string {
  if (amount === null || amount === undefined) return '-';
  if (amount === 0) return 'Free';
  // For non-USD per-person amounts under 100 units, show one decimal so users
  // back-computing the FX rate get a self-consistent answer (e.g. $25 × 0.86 =
  // €21.5, not €22 which would imply a different rate). USD always renders as
  // whole dollars to match the rest of the UI; large totals stay tidy too.
  const useDecimal = currency.toUpperCase() !== 'USD' && Math.abs(amount) < 100;
  const fractionDigits = useDecimal ? 1 : 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount);
  } catch {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
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
