/**
 * Client mirror of supabase/functions/generate-itinerary/cross-city-filter.ts.
 * Detects "wrong-city famous venue" addresses (e.g. Le Comptoir du Relais →
 * Paris, on a Venice itinerary) so we can refuse to ship them.
 */

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
  ],
  france: [
    { re: /\bparis\b/i, name: 'Paris' },
    { re: /\b(marseille|marseilles)\b/i, name: 'Marseille' },
    { re: /\blyon\b/i, name: 'Lyon' },
    { re: /\bbordeaux\b/i, name: 'Bordeaux' },
    { re: /\bnice\b/i, name: 'Nice' },
    { re: /\btoulouse\b/i, name: 'Toulouse' },
    { re: /\bstrasbourg\b/i, name: 'Strasbourg' },
  ],
  spain: [
    { re: /\bmadrid\b/i, name: 'Madrid' },
    { re: /\bbarcelona\b/i, name: 'Barcelona' },
    { re: /\b(sevilla|seville)\b/i, name: 'Seville' },
    { re: /\bvalencia\b/i, name: 'Valencia' },
    { re: /\bgranada\b/i, name: 'Granada' },
    { re: /\bbilbao\b/i, name: 'Bilbao' },
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
    { re: /\bliverpool\b/i, name: 'Liverpool' },
  ],
  portugal: [
    { re: /\blisbon|lisboa\b/i, name: 'Lisbon' },
    { re: /\bporto\b/i, name: 'Porto' },
  ],
  japan: [
    { re: /\b(tokyo|tōkyō)\b/i, name: 'Tokyo' },
    { re: /\b(kyoto|kyōto)\b/i, name: 'Kyoto' },
    { re: /\b(osaka|ōsaka)\b/i, name: 'Osaka' },
    { re: /\bhiroshima\b/i, name: 'Hiroshima' },
  ],
  usa: [
    { re: /\b(new york|nyc|manhattan|brooklyn)\b/i, name: 'New York' },
    { re: /\b(san francisco|sf)\b/i, name: 'San Francisco' },
    { re: /\blos angeles|l\.?a\.?\b/i, name: 'Los Angeles' },
    { re: /\bchicago\b/i, name: 'Chicago' },
    { re: /\bmiami\b/i, name: 'Miami' },
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
};

function inferCountry(destination: string): string | null {
  const d = (destination || '').toLowerCase();
  if (/\bital(y|ia)\b/.test(d) || /\b(rome|roma|venice|venezia|florence|firenze|milan|milano|naples|napoli|verona|bologna|turin|torino|genoa|palermo)\b/.test(d)) return 'italy';
  if (/\bfrance\b/.test(d) || /\b(paris|marseille|lyon|bordeaux|nice|toulouse|nantes|strasbourg)\b/.test(d)) return 'france';
  if (/\bspain\b/.test(d) || /\b(madrid|barcelona|seville|sevilla|valencia|granada|bilbao|malaga)\b/.test(d)) return 'spain';
  if (/\bgermany\b/.test(d) || /\b(berlin|munich|münchen|hamburg|cologne|köln|frankfurt)\b/.test(d)) return 'germany';
  if (/\b(uk|united kingdom|england|scotland|wales)\b/.test(d) || /\b(london|edinburgh|glasgow|manchester|liverpool)\b/.test(d)) return 'uk';
  if (/\bportugal\b/.test(d) || /\b(lisbon|lisboa|porto)\b/.test(d)) return 'portugal';
  if (/\bjapan\b/.test(d) || /\b(tokyo|kyoto|osaka|hiroshima)\b/.test(d)) return 'japan';
  if (/\b(usa|united states|u\.s\.?a?\.?)\b/.test(d) || /\b(new york|nyc|san francisco|los angeles|chicago|miami)\b/.test(d)) return 'usa';
  if (/\bmorocco\b/.test(d) || /\b(casablanca|marrakech|marrakesh|fez|fes|fès|rabat|tangier|tanger|chefchaouen|essaouira|agadir|meknes|meknès)\b/.test(d)) return 'morocco';
  if (/\b(turkey|türkiye)\b/.test(d) || /\b(istanbul|ankara|izmir|antalya|cappadocia)\b/.test(d)) return 'turkey';
  if (/\bindia\b/.test(d) || /\b(delhi|mumbai|bombay|jaipur|agra|goa|bengaluru|bangalore|kolkata|calcutta|chennai|madras)\b/.test(d)) return 'india';
  if (/\bthailand\b/.test(d) || /\b(bangkok|chiang mai|phuket|krabi)\b/.test(d)) return 'thailand';
  if (/\bvietnam\b/.test(d) || /\b(hanoi|ho chi minh|saigon|hoi an|da nang|danang)\b/.test(d)) return 'vietnam';
  if (/\bbrazil\b/.test(d) || /\b(rio de janeiro|são paulo|sao paulo|salvador|brasília|brasilia)\b/.test(d)) return 'brazil';
  if (/\bargentina\b/.test(d) || /\b(buenos aires|mendoza|bariloche)\b/.test(d)) return 'argentina';
  if (/\bmexico\b/.test(d) || /\b(mexico city|cdmx|ciudad de méxico|ciudad de mexico|cancun|tulum|oaxaca|guadalajara|mérida|merida)\b/.test(d)) return 'mexico';
  return null;
}

function findDestinationToken(destination: string, country: string): { re: RegExp; name: string } | null {
  const list = COUNTRY_CITY_TOKENS[country];
  if (!list) return null;
  return list.find(c => c.re.test(destination)) || null;
}

/**
 * If `text` mentions a well-known city in the destination's country *other
 * than* the destination, returns that other-city display name. Otherwise null.
 * Cross-country leaks (e.g. SF in Venice) are detected too because the SF
 * token exists in COUNTRY_CITY_TOKENS.usa and we scan all tokens when no
 * destination country is inferred.
 */
export function detectCrossCityMention(text: string, destination: string): string | null {
  if (!text || text.length < 3) return null;
  const country = inferCountry(destination);

  // First: same-country wrong-city scan (preferred — destination token is known)
  if (country) {
    const list = COUNTRY_CITY_TOKENS[country];
    const destToken = findDestinationToken(destination, country);
    if (destToken) {
      if (destToken.re.test(text)) return null; // mentions destination, allow
      for (const entry of list) {
        if (entry === destToken) continue;
        if (entry.re.test(text)) return entry.name;
      }
    }
  }

  // Second: cross-country scan — block any other-country famous city if
  // destination country is known and the text mentions a city from a
  // different country.
  if (country) {
    for (const [c, list] of Object.entries(COUNTRY_CITY_TOKENS)) {
      if (c === country) continue;
      for (const entry of list) {
        if (entry.re.test(text)) return entry.name;
      }
    }
  }

  return null;
}
