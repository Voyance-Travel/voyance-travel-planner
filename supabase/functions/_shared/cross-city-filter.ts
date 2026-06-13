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
  morocco: [
    { re: /\bcasablanca\b/i, name: 'Casablanca' },
    { re: /\b(marrakech|marrakesh)\b/i, name: 'Marrakech' },
    { re: /\b(fez|fes|fès)\b/i, name: 'Fez' },
    { re: /\brabat\b/i, name: 'Rabat' },
    { re: /\b(tangier|tanger)\b/i, name: 'Tangier' },
    { re: /\bchefchaouen\b/i, name: 'Chefchaouen' },
    { re: /\bessaouira\b/i, name: 'Essaouira' },
    { re: /\bagadir\b/i, name: 'Agadir' },
    { re: /\b(meknes|meknès)\b/i, name: 'Meknes' },
  ],
  turkey: [
    { re: /\bistanbul\b/i, name: 'Istanbul' },
    { re: /\bankara\b/i, name: 'Ankara' },
    { re: /\b(izmir|i̇zmir)\b/i, name: 'Izmir' },
    { re: /\bantalya\b/i, name: 'Antalya' },
    { re: /\bcappadocia\b/i, name: 'Cappadocia' },
  ],
  india: [
    { re: /\b(delhi|new delhi)\b/i, name: 'Delhi' },
    { re: /\b(mumbai|bombay)\b/i, name: 'Mumbai' },
    { re: /\bjaipur\b/i, name: 'Jaipur' },
    { re: /\bagra\b/i, name: 'Agra' },
    { re: /\bgoa\b/i, name: 'Goa' },
    { re: /\b(bengaluru|bangalore)\b/i, name: 'Bengaluru' },
    { re: /\b(kolkata|calcutta)\b/i, name: 'Kolkata' },
    { re: /\b(chennai|madras)\b/i, name: 'Chennai' },
  ],
  thailand: [
    { re: /\bbangkok\b/i, name: 'Bangkok' },
    { re: /\bchiang mai\b/i, name: 'Chiang Mai' },
    { re: /\bphuket\b/i, name: 'Phuket' },
    { re: /\bkrabi\b/i, name: 'Krabi' },
  ],
  vietnam: [
    { re: /\bhanoi\b/i, name: 'Hanoi' },
    { re: /\b(ho chi minh|saigon)\b/i, name: 'Ho Chi Minh City' },
    { re: /\bhoi an\b/i, name: 'Hoi An' },
    { re: /\b(da nang|danang)\b/i, name: 'Da Nang' },
  ],
  brazil: [
    { re: /\b(rio de janeiro|rio)\b/i, name: 'Rio de Janeiro' },
    { re: /\b(são paulo|sao paulo)\b/i, name: 'São Paulo' },
    { re: /\bsalvador\b/i, name: 'Salvador' },
    { re: /\b(brasília|brasilia)\b/i, name: 'Brasília' },
  ],
  argentina: [
    { re: /\bbuenos aires\b/i, name: 'Buenos Aires' },
    { re: /\bmendoza\b/i, name: 'Mendoza' },
    { re: /\bbariloche\b/i, name: 'Bariloche' },
  ],
  mexico: [
    { re: /\b(mexico city|cdmx|ciudad de méxico|ciudad de mexico)\b/i, name: 'Mexico City' },
    { re: /\bcancun\b/i, name: 'Cancun' },
    { re: /\btulum\b/i, name: 'Tulum' },
    { re: /\boaxaca\b/i, name: 'Oaxaca' },
    { re: /\bguadalajara\b/i, name: 'Guadalajara' },
    { re: /\b(mérida|merida)\b/i, name: 'Mérida' },
  ],
  portugal: [
    // Hub tokens fold in their own day-trip suburbs so a legitimate
    // greater-metro venue (e.g. a Vila Nova de Gaia port cellar on a Porto
    // day, or Sintra on a Lisbon day) is NOT flagged as cross-city — only a
    // venue from a genuinely different trip city is. (bug: Gaia venue on a
    // Lisbon day)
    { re: /\b(lisbon|lisboa|sintra|cascais|bel[ée]m|estoril)\b/i, name: 'Lisbon' },
    { re: /\b(porto|oporto|vila nova de gaia|gaia)\b/i, name: 'Porto' },
    { re: /\b(faro|algarve|lagos|albufeira)\b/i, name: 'Faro' },
    { re: /\bcoimbra\b/i, name: 'Coimbra' },
    { re: /\bbraga\b/i, name: 'Braga' },
    { re: /\baveiro\b/i, name: 'Aveiro' },
    { re: /\bfunchal\b/i, name: 'Funchal' },
    { re: /\b[ée]vora\b/i, name: 'Évora' },
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
  if (/\bmorocco\b/.test(d) ||
      /\b(casablanca|marrakech|marrakesh|fez|fes|fès|rabat|tangier|tanger|chefchaouen|essaouira|agadir|meknes|meknès)\b/.test(d))
    return 'morocco';
  if (/\b(turkey|türkiye)\b/.test(d) ||
      /\b(istanbul|ankara|izmir|antalya|cappadocia)\b/.test(d))
    return 'turkey';
  if (/\bindia\b/.test(d) ||
      /\b(delhi|mumbai|bombay|jaipur|agra|goa|bengaluru|bangalore|kolkata|calcutta|chennai|madras)\b/.test(d))
    return 'india';
  if (/\bthailand\b/.test(d) ||
      /\b(bangkok|chiang mai|phuket|krabi)\b/.test(d))
    return 'thailand';
  if (/\bvietnam\b/.test(d) ||
      /\b(hanoi|ho chi minh|saigon|hoi an|da nang|danang)\b/.test(d))
    return 'vietnam';
  if (/\bbrazil\b/.test(d) ||
      /\b(rio de janeiro|são paulo|sao paulo|salvador|brasília|brasilia)\b/.test(d))
    return 'brazil';
  if (/\bargentina\b/.test(d) ||
      /\b(buenos aires|mendoza|bariloche)\b/.test(d))
    return 'argentina';
  if (/\bmexico\b/.test(d) ||
      /\b(mexico city|cdmx|ciudad de méxico|ciudad de mexico|cancun|tulum|oaxaca|guadalajara|mérida|merida)\b/.test(d))
    return 'mexico';
  if (/\bportugal\b/.test(d) ||
      /\b(lisbon|lisboa|porto|oporto|vila nova de gaia|sintra|cascais|faro|algarve|coimbra|braga|aveiro|funchal|[ée]vora)\b/.test(d))
    return 'portugal';
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
  // The venue's city often lives ONLY in the title/name (e.g. "Wine Cellars
  // of Vila Nova de Gaia" on a Lisbon day, with no address). Scan those too —
  // detectCrossCityMention still allows the destination's own city when it is
  // named in the same string, so a legitimate "... in Lisbon" never trips.
  if (typeof activity?.title === 'string') fields.push(activity.title);
  if (typeof activity?.name === 'string') fields.push(activity.name);

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
