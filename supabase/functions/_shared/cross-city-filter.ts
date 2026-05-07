/**
 * Cross-city venue hallucination filter.
 *
 * AI generators sometimes pull real, famous venues from training data and
 * assign them to the wrong city (e.g. Sant'Eustachio Il Caffè → Venice when
 * the venue is in Rome). This module supplies:
 *
 *  1. A token map of well-known cities per country, used to scan venue
 *     addresses / location names for an *other-city* mention while the
 *     destination's own token is missing.
 *  2. A helper to extract a city name from a Google Places formattedAddress.
 *  3. A pure function `isCrossCityAddress` that returns the offending city
 *     token when an activity's address points at a different city than the
 *     destination, and `null` otherwise.
 */

/** Country → ordered list of {token regex, displayName} pairs. */
const COUNTRY_CITY_TOKENS: Record<string, Array<{ re: RegExp; name: string }>> = {
  italy: [
    { re: /\b(roma|rome)\b/i, name: 'Rome' },
    { re: /\b(firenze|florence)\b/i, name: 'Florence' },
    { re: /\b(milano|milan)\b/i, name: 'Milan' },
    { re: /\b(napoli|naples)\b/i, name: 'Naples' },
    { re: /\b(venezia|venice)\b/i, name: 'Venice' },
    { re: /\b(torino|turin)\b/i, name: 'Turin' },
    { re: /\bbologna\b/i, name: 'Bologna' },
    { re: /\bverona\b/i, name: 'Verona' },
    { re: /\b(genova|genoa)\b/i, name: 'Genoa' },
    { re: /\bpalermo\b/i, name: 'Palermo' },
    { re: /\bcatania\b/i, name: 'Catania' },
    { re: /\bbari\b/i, name: 'Bari' },
  ],
  france: [
    { re: /\bparis\b/i, name: 'Paris' },
    { re: /\b(marseille|marseilles)\b/i, name: 'Marseille' },
    { re: /\blyon\b/i, name: 'Lyon' },
    { re: /\bbordeaux\b/i, name: 'Bordeaux' },
    { re: /\bnice\b/i, name: 'Nice' },
    { re: /\bnantes\b/i, name: 'Nantes' },
    { re: /\btoulouse\b/i, name: 'Toulouse' },
    { re: /\bstrasbourg\b/i, name: 'Strasbourg' },
  ],
  spain: [
    { re: /\b(madrid)\b/i, name: 'Madrid' },
    { re: /\b(barcelona)\b/i, name: 'Barcelona' },
    { re: /\b(sevilla|seville)\b/i, name: 'Seville' },
    { re: /\b(valencia)\b/i, name: 'Valencia' },
    { re: /\b(granada)\b/i, name: 'Granada' },
    { re: /\b(bilbao)\b/i, name: 'Bilbao' },
    { re: /\b(malaga|málaga)\b/i, name: 'Malaga' },
  ],
  germany: [
    { re: /\bberlin\b/i, name: 'Berlin' },
    { re: /\b(münchen|munich)\b/i, name: 'Munich' },
    { re: /\bhamburg\b/i, name: 'Hamburg' },
    { re: /\b(köln|cologne)\b/i, name: 'Cologne' },
    { re: /\bfrankfurt\b/i, name: 'Frankfurt' },
  ],
  uk: [
    { re: /\blondon\b/i, name: 'London' },
    { re: /\bedinburgh\b/i, name: 'Edinburgh' },
    { re: /\bglasgow\b/i, name: 'Glasgow' },
    { re: /\bmanchester\b/i, name: 'Manchester' },
    { re: /\b(liverpool)\b/i, name: 'Liverpool' },
  ],
  japan: [
    { re: /\b(tokyo|tōkyō)\b/i, name: 'Tokyo' },
    { re: /\b(kyoto|kyōto)\b/i, name: 'Kyoto' },
    { re: /\b(osaka|ōsaka)\b/i, name: 'Osaka' },
    { re: /\bhiroshima\b/i, name: 'Hiroshima' },
    { re: /\b(sapporo)\b/i, name: 'Sapporo' },
  ],
};

/** Map a destination string ("Venice, Italy", "Rome", "Paris, France") to a country key. */
function inferCountry(destination: string): string | null {
  const d = destination.toLowerCase();
  if (/\bital(y|ia)\b/.test(d) ||
      /\b(rome|roma|venice|venezia|florence|firenze|milan|milano|naples|napoli|verona|bologna|turin|torino)\b/.test(d))
    return 'italy';
  if (/\bfrance\b/.test(d) ||
      /\b(paris|marseille|lyon|bordeaux|nice|toulouse|nantes|strasbourg)\b/.test(d))
    return 'france';
  if (/\bspain\b/.test(d) ||
      /\b(madrid|barcelona|seville|sevilla|valencia|granada|bilbao|malaga)\b/.test(d))
    return 'spain';
  if (/\bgermany\b/.test(d) ||
      /\b(berlin|munich|münchen|hamburg|cologne|köln|frankfurt)\b/.test(d))
    return 'germany';
  if (/\b(uk|united kingdom|england|scotland|wales)\b/.test(d) ||
      /\b(london|edinburgh|glasgow|manchester|liverpool)\b/.test(d))
    return 'uk';
  if (/\bjapan\b/.test(d) ||
      /\b(tokyo|kyoto|osaka|hiroshima|sapporo)\b/.test(d))
    return 'japan';
  return null;
}

/** Find the destination's own city entry in the country list. */
function findDestinationToken(destination: string, country: string): { re: RegExp; name: string } | null {
  const list = COUNTRY_CITY_TOKENS[country];
  if (!list) return null;
  return list.find(c => c.re.test(destination)) || null;
}

/**
 * Returns the conflicting city display name if `text` mentions a well-known
 * city in the destination's country *other than* the destination itself, and
 * the destination's own city token is absent. Otherwise returns null.
 */
export function detectCrossCityMention(text: string, destination: string): string | null {
  if (!text || text.length < 3) return null;
  const country = inferCountry(destination);
  if (!country) return null;
  const list = COUNTRY_CITY_TOKENS[country];
  const destToken = findDestinationToken(destination, country);
  if (!destToken) return null;
  // If the text mentions the destination city, allow it (even alongside others).
  if (destToken.re.test(text)) return null;
  for (const entry of list) {
    if (entry === destToken) continue;
    if (entry.re.test(text)) return entry.name;
  }
  return null;
}

/**
 * Inspect an activity's address-like fields and return the foreign-city name
 * if the activity is in the wrong city for the given destination.
 */
export function isCrossCityAddress(activity: any, destination: string): string | null {
  const fields: string[] = [];
  const rawAddr = activity?.address ?? activity?.location;
  if (typeof rawAddr === 'string') fields.push(rawAddr);
  if (rawAddr && typeof rawAddr === 'object') {
    if (typeof rawAddr.address === 'string') fields.push(rawAddr.address);
    if (typeof rawAddr.name === 'string') fields.push(rawAddr.name);
    if (typeof rawAddr.formattedAddress === 'string') fields.push(rawAddr.formattedAddress);
  }
  if (typeof activity?.location === 'object' && activity.location) {
    if (typeof activity.location.address === 'string') fields.push(activity.location.address);
    if (typeof activity.location.name === 'string') fields.push(activity.location.name);
  }
  if (typeof activity?.venue_name === 'string') fields.push(activity.venue_name);
  if (typeof activity?.venueName === 'string') fields.push(activity.venueName);

  for (const f of fields) {
    const hit = detectCrossCityMention(f, destination);
    if (hit) return hit;
  }
  return null;
}

/**
 * Extract a coarse city name from a Google Places formattedAddress
 * (e.g. "Piazza di Sant'Eustachio, 82, 00186 Roma RM, Italy" → "Roma").
 * Used purely for diagnostic logs.
 */
export function extractCityFromFormattedAddress(addr: string | null | undefined): string | null {
  if (!addr) return null;
  const parts = addr.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  // Second-to-last segment usually contains "<postcode> <city> <region>".
  const cand = parts[parts.length - 2];
  const m = cand.match(/(?:\d{4,6}\s+)?([A-Za-zÀ-ÿ' -]{2,})/);
  return m ? m[1].trim() : cand;
}
