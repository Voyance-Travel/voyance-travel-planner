/**
 * Address-to-destination guard.
 *
 * Lightweight detector for the "wrong country" failure mode that survives
 * `detectCrossCityMention` (which only fires when the address mentions a
 * sibling city in the SAME country). When the model pulls a venue from a
 * different country entirely (e.g. "Tartine, San Francisco" in a Venice
 * trip), the within-country city scan returns null. This module supplies
 * the missing country-token check.
 *
 * Pure-regex; no Google/Places call. See plan §4.
 */

const COUNTRY_TOKENS: Array<{ key: string; re: RegExp; name: string }> = [
  { key: 'italy', re: /,\s*ital(y|ia)\b|\bital(y|ia)\b\s*$/i, name: 'Italy' },
  { key: 'france', re: /,\s*france\b|\bfrance\b\s*$/i, name: 'France' },
  { key: 'spain', re: /,\s*(spain|españa)\b|\b(spain|españa)\b\s*$/i, name: 'Spain' },
  { key: 'germany', re: /,\s*(germany|deutschland)\b/i, name: 'Germany' },
  { key: 'uk', re: /,\s*(uk|united kingdom|england|scotland|wales)\b/i, name: 'United Kingdom' },
  { key: 'japan', re: /,\s*japan\b/i, name: 'Japan' },
  { key: 'usa', re: /,\s*(usa|united states|u\.s\.a?\.?)\b|,\s*(ca|ny|tx|fl|wa|or|il|ma)\s*\d{5}/i, name: 'United States' },
  { key: 'mexico', re: /,\s*mexico\b/i, name: 'Mexico' },
  { key: 'portugal', re: /,\s*portugal\b/i, name: 'Portugal' },
  { key: 'greece', re: /,\s*greece\b/i, name: 'Greece' },
  { key: 'netherlands', re: /,\s*(netherlands|holland)\b/i, name: 'Netherlands' },
  { key: 'austria', re: /,\s*austria\b/i, name: 'Austria' },
  { key: 'switzerland', re: /,\s*switzerland\b/i, name: 'Switzerland' },
];

function inferCountryKey(s: string): string | null {
  const d = (s || '').toLowerCase();
  if (/\bital(y|ia)\b|\b(rome|roma|venice|venezia|florence|firenze|milan|milano|naples|napoli|verona|bologna|turin|torino|sicily|sicilia)\b/.test(d)) return 'italy';
  if (/\bfrance\b|\b(paris|marseille|lyon|bordeaux|nice|toulouse|nantes|strasbourg|cannes|provence)\b/.test(d)) return 'france';
  if (/\b(spain|españa)\b|\b(madrid|barcelona|seville|sevilla|valencia|granada|bilbao|malaga|ibiza)\b/.test(d)) return 'spain';
  if (/\b(germany|deutschland)\b|\b(berlin|munich|münchen|hamburg|cologne|köln|frankfurt)\b/.test(d)) return 'germany';
  if (/\b(uk|united kingdom|england|scotland|wales)\b|\b(london|edinburgh|glasgow|manchester|liverpool)\b/.test(d)) return 'uk';
  if (/\bjapan\b|\b(tokyo|kyoto|osaka|hiroshima|sapporo)\b/.test(d)) return 'japan';
  if (/\b(usa|united states)\b|\b(new york|nyc|san francisco|sf|los angeles|la|chicago|miami|seattle|portland|austin|boston|brooklyn|manhattan)\b/.test(d)) return 'usa';
  if (/\bmexico\b|\b(mexico city|cdmx|cancun|tulum|oaxaca|guadalajara)\b/.test(d)) return 'mexico';
  if (/\bportugal\b|\b(lisbon|lisboa|porto)\b/.test(d)) return 'portugal';
  if (/\bgreece\b|\b(athens|santorini|mykonos|crete)\b/.test(d)) return 'greece';
  if (/\b(netherlands|holland)\b|\b(amsterdam|rotterdam)\b/.test(d)) return 'netherlands';
  if (/\baustria\b|\b(vienna|salzburg)\b/.test(d)) return 'austria';
  if (/\bswitzerland\b|\b(zurich|geneva|bern|lausanne)\b/.test(d)) return 'switzerland';
  return null;
}

/**
 * Returns the foreign-country display name if the address text points at a
 * country other than the destination's country. Null on match or on
 * unknown destinations (we never false-positive on uncovered countries).
 */
export function detectCountryMismatch(addressText: string, destination: string): string | null {
  if (!addressText || addressText.length < 4) return null;
  const destKey = inferCountryKey(destination);
  if (!destKey) return null;
  for (const c of COUNTRY_TOKENS) {
    if (c.key === destKey) continue;
    if (c.re.test(addressText)) return c.name;
  }
  return null;
}

/** Inspect activity address-like fields for a country mismatch. */
export function activityCountryMismatch(activity: any, destination: string): string | null {
  const fields: string[] = [];
  const rawAddr = activity?.address ?? activity?.location;
  if (typeof rawAddr === 'string') fields.push(rawAddr);
  if (rawAddr && typeof rawAddr === 'object') {
    if (typeof rawAddr.address === 'string') fields.push(rawAddr.address);
    if (typeof rawAddr.formattedAddress === 'string') fields.push(rawAddr.formattedAddress);
  }
  if (typeof activity?.location === 'object' && activity.location?.address) fields.push(String(activity.location.address));
  for (const f of fields) {
    const hit = detectCountryMismatch(f, destination);
    if (hit) return hit;
  }
  return null;
}
