/**
 * Single source of truth for FX rates, shared by frontend (`src/lib/currency.ts`)
 * and edge functions. Rates are static, hand-maintained mid-market levels.
 *
 * All canonical money in the app is stored in USD; conversion happens at
 * display or normalization time using THIS table.
 *
 * To refresh: bump `RATES_AS_OF` and update the table values. Do NOT add a
 * second table elsewhere — both runtimes must read from here.
 */

export const RATES_AS_OF = '2026-05-04';
export const RATES_AS_OF_LABEL = 'May 4, 2026';

// 1 USD = X units of target currency.
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
  // Long-tail (less frequently refreshed)
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

/**
 * Derived inverse table. Keys mirror EXCHANGE_RATES_FROM_USD; values are
 * 1 / FROM_USD so legacy edge call sites that read this constant by name
 * continue to compile. Do NOT add entries here directly — add them to
 * EXCHANGE_RATES_FROM_USD and they propagate.
 */
export const EXCHANGE_RATES_TO_USD: Record<string, number> = Object.fromEntries(
  Object.entries(EXCHANGE_RATES_FROM_USD).map(([code, rate]) => [code, rate === 0 ? 0 : 1 / rate])
);

/** Convert an amount from USD to the target currency. */
export function convertFromUSD(amountInUSD: number, targetCurrency: string): number {
  const rate = EXCHANGE_RATES_FROM_USD[(targetCurrency || '').toUpperCase()];
  if (!rate) return amountInUSD;
  return amountInUSD * rate;
}

/** Convert an amount from a source currency to USD. */
export function convertToUSD(amount: number, sourceCurrency: string): number {
  const code = (sourceCurrency || '').toUpperCase();
  if (!code || code === 'USD') return amount;
  const rate = EXCHANGE_RATES_FROM_USD[code];
  if (!rate || rate === 0) return amount;
  return amount / rate;
}

/** Whether we have a real (non-fallback) rate for this currency. */
export function hasRate(currency: string): boolean {
  return Object.prototype.hasOwnProperty.call(
    EXCHANGE_RATES_FROM_USD,
    (currency || '').toUpperCase()
  );
}
