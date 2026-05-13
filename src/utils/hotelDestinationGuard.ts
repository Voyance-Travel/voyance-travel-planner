/**
 * Hotel Destination Guard (frontend)
 *
 * Validates that a stored hotel selection's address (and name) actually points
 * at the trip destination. Mirrors `hotelMatchesDestination` in
 * `supabase/functions/hotels/index.ts`. Used as a write-time check at every
 * site that persists `trips.hotel_selection`.
 *
 * See mem://constraints/hotel/destination-resolution-guard.
 *
 * NOTE: This is intentionally a small, hand-rolled country/city scan (mirrors
 * the backend `address-city-resolve.ts` logic). We do not import the edge
 * helper because edge files are Deno-only.
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
  { key: 'puerto_rico', re: /,\s*(puerto rico|pr)\b/i, name: 'Puerto Rico' },
];

function inferCountryKey(s: string): string | null {
  const d = (s || '').toLowerCase();
  if (/\bital(y|ia)\b|\b(rome|roma|venice|venezia|florence|firenze|milan|milano|naples|napoli|verona|bologna|turin|torino|sicily|sicilia)\b/.test(d)) return 'italy';
  if (/\bfrance\b|\b(paris|marseille|lyon|bordeaux|nice|toulouse|nantes|strasbourg|cannes|provence)\b/.test(d)) return 'france';
  if (/\b(spain|españa)\b|\b(madrid|barcelona|seville|sevilla|valencia|granada|bilbao|malaga|ibiza)\b/.test(d)) return 'spain';
  if (/\b(germany|deutschland)\b|\b(berlin|munich|münchen|hamburg|cologne|köln|frankfurt)\b/.test(d)) return 'germany';
  if (/\b(uk|united kingdom|england|scotland|wales)\b|\b(london|edinburgh|glasgow|manchester|liverpool)\b/.test(d)) return 'uk';
  if (/\bjapan\b|\b(tokyo|kyoto|osaka|hiroshima|sapporo)\b/.test(d)) return 'japan';
  if (/\b(puerto rico|san juan|isla verde|condado|old san juan)\b/.test(d)) return 'puerto_rico';
  if (/\b(usa|united states)\b|\b(new york|nyc|san francisco|sf|los angeles|la|chicago|miami|seattle|portland|austin|boston|brooklyn|manhattan|laguna niguel|dana point)\b/.test(d)) return 'usa';
  if (/\bmexico\b|\b(mexico city|cdmx|cancun|tulum|oaxaca|guadalajara)\b/.test(d)) return 'mexico';
  if (/\bportugal\b|\b(lisbon|lisboa|porto)\b/.test(d)) return 'portugal';
  if (/\bgreece\b|\b(athens|santorini|mykonos|crete)\b/.test(d)) return 'greece';
  if (/\b(netherlands|holland)\b|\b(amsterdam|rotterdam)\b/.test(d)) return 'netherlands';
  if (/\baustria\b|\b(vienna|salzburg)\b/.test(d)) return 'austria';
  if (/\bswitzerland\b|\b(zurich|geneva|bern|lausanne)\b/.test(d)) return 'switzerland';
  return null;
}

export function detectHotelCountryMismatch(addressText: string, destination: string): string | null {
  if (!addressText || addressText.length < 4) return null;
  const destKey = inferCountryKey(destination);
  if (!destKey) return null;
  for (const c of COUNTRY_TOKENS) {
    if (c.key === destKey) continue;
    if (c.re.test(addressText)) return c.name;
  }
  return null;
}

export interface HotelLike {
  name?: string;
  address?: string;
  formattedAddress?: string;
}

export interface DestinationGuardResult {
  ok: boolean;
  reason?: string;
  /** Suggested cleaned name (foreign city tokens stripped) */
  cleanedName?: string;
}

/**
 * Returns ok=false if hotel.address OR hotel.name reveals a country mismatch
 * with the trip destination. When ok=false, callers should:
 *   - keep `name` (cleaned) + dates
 *   - drop `address`, `placeId`, `website`, `images`, `googleMapsUrl`
 *   - re-trigger enrichment scoped to the destination
 *   - surface a toast to the user
 */
export function validateHotelMatchesDestination(
  hotel: HotelLike,
  destination: string,
): DestinationGuardResult {
  if (!destination) return { ok: true };
  const addr = hotel.address || hotel.formattedAddress || '';
  const addrMiss = detectHotelCountryMismatch(addr, destination);
  if (addrMiss) {
    return {
      ok: false,
      reason: `address in ${addrMiss}, expected ${destination}`,
      cleanedName: cleanForeignCityFromName(hotel.name || '', destination),
    };
  }
  // Also catch the case where the name itself contains a foreign locale, even
  // before we have an address (e.g. user-typed "Ritz-Carlton, Laguna Niguel").
  const cleaned = cleanForeignCityFromName(hotel.name || '', destination);
  if (cleaned !== (hotel.name || '')) {
    return {
      ok: false,
      reason: `name contains foreign locale; cleaned to "${cleaned}"`,
      cleanedName: cleaned,
    };
  }
  return { ok: true };
}

/**
 * Strip a comma-separated foreign-city/country token from a hotel name.
 * "The Ritz-Carlton, Laguna Niguel" + dest=San Juan → "The Ritz-Carlton".
 */
export function cleanForeignCityFromName(name: string, destination: string): string {
  if (!name) return name;
  const cleaned = name.replace(/[\u2014\u2013]/g, ',');
  const parts = cleaned.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return name;
  const kept = parts.filter(part => !detectHotelCountryMismatch(part, destination));
  const result = kept.join(', ').trim();
  return result || parts[0];
}
