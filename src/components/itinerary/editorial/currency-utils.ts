// Extracted from EditorialItinerary.tsx during the file-size decomposition.
// Currency detection + normalization helpers.
import type { EditorialDay } from '../EditorialItinerary';

export function normalizeCurrencyCode(input: unknown): string | null {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();

  // Common symbols / names → ISO 4217 codes
  const map: Record<string, string> = {
    '$': 'USD',
    'USD': 'USD',
    'US DOLLAR': 'USD',
    'DOLLAR': 'USD',

    '€': 'EUR',
    'EUR': 'EUR',
    'EURO': 'EUR',

    '£': 'GBP',
    'GBP': 'GBP',
    'POUND': 'GBP',
    'POUNDS': 'GBP',

    '¥': 'JPY',
    'JPY': 'JPY',
    'YEN': 'JPY',
  };

  return map[upper] ?? (upper.length === 3 ? upper : null);
}

export function inferCurrencyFromCountry(country?: string): string | null {
  if (!country) return null;
  const c = country.trim().toLowerCase();

  const eurozone = new Set([
    'austria', 'belgium', 'croatia', 'cyprus', 'estonia', 'finland', 'france',
    'germany', 'greece', 'ireland', 'italy', 'latvia', 'lithuania', 'luxembourg',
    'malta', 'netherlands', 'portugal', 'slovakia', 'slovenia', 'spain', 'andorra',
    'monaco', 'san marino', 'vatican', 'vatican city', 'kosovo', 'montenegro',
  ]);

  if (eurozone.has(c)) return 'EUR';

  // Broad country → currency map
  const countryMap: Record<string, string> = {
    'united kingdom': 'GBP', 'uk': 'GBP', 'england': 'GBP', 'scotland': 'GBP', 'wales': 'GBP', 'northern ireland': 'GBP',
    'united states': 'USD', 'usa': 'USD', 'us': 'USD',
    'japan': 'JPY',
    'canada': 'CAD',
    'australia': 'AUD',
    'new zealand': 'NZD',
    'switzerland': 'CHF',
    'china': 'CNY',
    'south korea': 'KRW', 'korea': 'KRW',
    'india': 'INR',
    'mexico': 'MXN',
    'brazil': 'BRL',
    'argentina': 'ARS',
    'colombia': 'COP',
    'chile': 'CLP',
    'peru': 'PEN',
    'thailand': 'THB',
    'vietnam': 'VND',
    'indonesia': 'IDR', 'bali': 'IDR',
    'malaysia': 'MYR',
    'philippines': 'PHP',
    'singapore': 'SGD',
    'taiwan': 'TWD',
    'hong kong': 'HKD',
    'turkey': 'TRY', 'türkiye': 'TRY',
    'south africa': 'ZAR',
    'egypt': 'EGP',
    'morocco': 'MAD',
    'kenya': 'KES',
    'tanzania': 'TZS',
    'nigeria': 'NGN',
    'ghana': 'GHS',
    'israel': 'ILS',
    'jordan': 'JOD',
    'united arab emirates': 'AED', 'uae': 'AED',
    'saudi arabia': 'SAR',
    'qatar': 'QAR',
    'oman': 'OMR',
    'bahrain': 'BHD',
    'kuwait': 'KWD',
    'iceland': 'ISK',
    'norway': 'NOK',
    'sweden': 'SEK',
    'denmark': 'DKK',
    'poland': 'PLN',
    'czech republic': 'CZK', 'czechia': 'CZK',
    'hungary': 'HUF',
    'romania': 'RON',
    'bulgaria': 'BGN',
    'russia': 'RUB',
    'ukraine': 'UAH',
    'sri lanka': 'LKR',
    'nepal': 'NPR',
    'cambodia': 'KHR',
    'myanmar': 'MMK', 'burma': 'MMK',
    'laos': 'LAK',
    'pakistan': 'PKR',
    'bangladesh': 'BDT',
    'costa rica': 'CRC',
    'panama': 'PAB',
    'cuba': 'CUP',
    'jamaica': 'JMD',
    'dominican republic': 'DOP',
    'guatemala': 'GTQ',
    'uruguay': 'UYU',
    'paraguay': 'PYG',
    'bolivia': 'BOB',
    'ecuador': 'USD',
    'fiji': 'FJD',
    'maldives': 'MVR',
    'mauritius': 'MUR',
    'seychelles': 'SCR',
  };

  return countryMap[c] ?? null;
}

export function inferCurrencyFromDays(days: EditorialDay[]): string | null {
  const counts = new Map<string, number>();

  for (const day of days) {
    for (const act of day.activities ?? []) {
      const cur = normalizeCurrencyCode((act as any)?.cost?.currency);
      // Skip USD since backend normalizes all costs to USD — it doesn't reflect actual local currency
      if (cur && cur !== 'USD') counts.set(cur, (counts.get(cur) ?? 0) + 1);
    }
  }

  let best: { cur: string; n: number } | null = null;
  for (const [cur, n] of counts.entries()) {
    if (!best || n > best.n) best = { cur, n };
  }
  return best?.cur ?? null;
}
