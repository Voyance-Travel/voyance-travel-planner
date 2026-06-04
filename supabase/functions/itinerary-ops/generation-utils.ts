/**
 * Pure utility functions shared across the generate-itinerary pipeline.
 *
 * These have ZERO side effects and ZERO external dependencies — safe to
 * extract and import anywhere.
 */

import type { AirportTransferFare } from './flight-hotel-context.ts';

// =============================================================================
// DATE / TIME UTILITIES
// =============================================================================

export function calculateDays(startDate: string, endDate: string): number {
  // Timezone-safe: parse as local dates to avoid UTC off-by-one
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  // Inclusive end-date: last day IS an activity day (March 7-9 = 3 days)
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export function formatDate(startDate: string, dayOffset: number): string {
  const [y, m, d] = startDate.split('-').map(Number);
  const date = new Date(y, m - 1, d + dayOffset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function calculateDuration(start: string, end: string): number {
  return timeToMinutes(end) - timeToMinutes(start);
}

// =============================================================================
// CATEGORY ICON MAPPING
// =============================================================================

export function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    sightseeing: 'map-pin',
    dining: 'utensils',
    cultural: 'landmark',
    shopping: 'shopping-bag',
    relaxation: 'spa',
    transport: 'car',
    accommodation: 'bed',
    activity: 'activity',
  };
  return icons[category] || 'star';
}

// =============================================================================
// VENUE NAME NORMALIZATION
// =============================================================================

export function normalizeVenueName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics (é→e, ã→a, ü→u)
    .toLowerCase()
    .replace(/[''`´]/g, "'")
    .replace(/[^\w\s'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// =============================================================================
// RESTAURANT VENUE NAME EXTRACTION
// =============================================================================

/**
 * Extract the canonical venue name from an activity title by stripping
 * meal prefixes. This ensures consistent identity tracking across:
 *   - used_restaurants storage (action-generate-trip-day.ts)
 *   - pool filtering (compile-prompt.ts)
 *   - dedup swap (repair-day.ts)
 *   - meal guard fallback (action-generate-trip-day.ts)
 *
 * Examples:
 *   "Breakfast at Café Florian"  → "café florian"
 *   "Lunch: Tonkatsu Maisen"     → "tonkatsu maisen"
 *   "Dinner - Le Comptoir"       → "le comptoir"
 *   "Café Florian"               → "café florian"
 */
export function extractRestaurantVenueName(title: string): string {
  let name = title
    // "Breakfast at X", "Lunch at X", "Dinner at X"
    .replace(/^(breakfast|brunch|lunch|dinner|supper)\s+at\s+/i, '')
    // "Breakfast: X", "Lunch: X", "Dinner: X"
    .replace(/^(breakfast|brunch|lunch|dinner|supper)\s*[:–—-]\s*/i, '')
    // Strip parentheticals like "(2 Michelin Stars)", "(Kreuzberg)"
    .replace(/\s*\(.*?\)\s*/g, ' ')
    // Strip trailing venue-type suffixes
    .replace(/\s+(?:restaurant|ristorante|trattoria|osteria|brasserie|bistro|café|cafe|bar(?:\s*&\s*grill)?|gastropub|pub|eatery|kitchen|diner|grill|steakhouse|pizzeria|bakery|patisserie|konditorei)$/i, '')
    .trim();

  return normalizeVenueName(name);
}

// =============================================================================
// HAVERSINE DISTANCE (km)
// =============================================================================

// =============================================================================
// VENUE ALIAS MAP — bilingual / variant canonical resolution
// =============================================================================

const VENUE_ALIASES: Record<string, string> = {
  'tuileries garden': 'tuileries',
  'jardin des tuileries': 'tuileries',
  'tuileries': 'tuileries',
  'champs elysees': 'champs-elysees',
  'avenue des champs elysees': 'champs-elysees',
  'champs-elysees': 'champs-elysees',
  'sacre coeur': 'sacre-coeur',
  'sacre-coeur basilica': 'sacre-coeur',
  'basilique du sacre coeur': 'sacre-coeur',
  'eiffel tower': 'eiffel-tower',
  'tour eiffel': 'eiffel-tower',
  'notre dame': 'notre-dame',
  'notre-dame cathedral': 'notre-dame',
  'cathedrale notre-dame': 'notre-dame',
  'arc de triomphe': 'arc-de-triomphe',
  "arc de triomphe de l'etoile": 'arc-de-triomphe',
  'luxembourg garden': 'luxembourg',
  'jardin du luxembourg': 'luxembourg',
  'luxembourg gardens': 'luxembourg',
  'palais royal': 'palais-royal',
  'palais-royal gardens': 'palais-royal',
  'jardin du palais royal': 'palais-royal',
  'champ de mars': 'champ-de-mars',
  'parc du champ de mars': 'champ-de-mars',
  "musee d'orsay": 'orsay',
  'orsay museum': 'orsay',
  'musee du louvre': 'louvre',
  'louvre museum': 'louvre',
  'the louvre': 'louvre',
  'palace of versailles': 'versailles',
  'chateau de versailles': 'versailles',
  'versailles palace': 'versailles',
  'place de la concorde': 'concorde',
  'pont alexandre iii': 'pont-alexandre-iii',
  'pont alexandre': 'pont-alexandre-iii',
  'ile saint louis': 'ile-saint-louis',
  'ile saint-louis': 'ile-saint-louis',
  'ile de la cite': 'ile-de-la-cite',
  'montmartre': 'montmartre',
  'place du tertre': 'place-du-tertre',

  // --- ROME ---
  'colosseum': 'colosseum',
  'colosseo': 'colosseum',
  'roman colosseum': 'colosseum',
  'roman forum': 'roman-forum',
  'foro romano': 'roman-forum',
  'vatican museums': 'vatican-museums',
  'musei vaticani': 'vatican-museums',
  'sistine chapel': 'sistine-chapel',
  'cappella sistina': 'sistine-chapel',
  'st peters basilica': 'st-peters',
  "saint peter's basilica": 'st-peters',
  'basilica di san pietro': 'st-peters',
  'trevi fountain': 'trevi',
  'fontana di trevi': 'trevi',
  'pantheon': 'pantheon',
  'spanish steps': 'spanish-steps',
  'piazza di spagna': 'spanish-steps',
  'scalinata di trinita dei monti': 'spanish-steps',
  'piazza navona': 'piazza-navona',
  'borghese gallery': 'borghese',
  'galleria borghese': 'borghese',
  'villa borghese': 'villa-borghese',
  'villa borghese gardens': 'villa-borghese',
  "castel sant'angelo": 'castel-santangelo',
  'castel santangelo': 'castel-santangelo',
  'trastevere': 'trastevere',

  // --- LONDON ---
  'tower of london': 'tower-of-london',
  'the tower of london': 'tower-of-london',
  'buckingham palace': 'buckingham',
  'big ben': 'big-ben',
  'elizabeth tower': 'big-ben',
  'houses of parliament': 'parliament',
  'palace of westminster': 'parliament',
  'westminster abbey': 'westminster-abbey',
  'british museum': 'british-museum',
  'the british museum': 'british-museum',
  'tower bridge': 'tower-bridge',
  'london bridge': 'london-bridge',
  'hyde park': 'hyde-park',
  'national gallery': 'national-gallery',
  'the national gallery': 'national-gallery',
  'tate modern': 'tate-modern',
  'st pauls cathedral': 'st-pauls',
  "saint paul's cathedral": 'st-pauls',
  'covent garden': 'covent-garden',
  'borough market': 'borough-market',
  'kensington palace': 'kensington-palace',
  'kensington gardens': 'kensington-gardens',
  'trafalgar square': 'trafalgar-square',
  'piccadilly circus': 'piccadilly-circus',

  // --- BARCELONA ---
  'sagrada familia': 'sagrada-familia',
  'la sagrada familia': 'sagrada-familia',
  'basilica de la sagrada familia': 'sagrada-familia',
  'park guell': 'park-guell',
  'parc guell': 'park-guell',
  'casa batllo': 'casa-batllo',
  'casa mila': 'casa-mila',
  'la pedrera': 'casa-mila',
  'la rambla': 'la-rambla',
  'las ramblas': 'la-rambla',
  'la boqueria': 'boqueria',
  'mercat de la boqueria': 'boqueria',
  'boqueria market': 'boqueria',
  'gothic quarter': 'gothic-quarter',
  'barri gotic': 'gothic-quarter',
  'camp nou': 'camp-nou',
  'barceloneta': 'barceloneta',
  'barceloneta beach': 'barceloneta',
  'montjuic': 'montjuic',
  'montjuic castle': 'montjuic',

  // --- TOKYO ---
  'senso-ji': 'sensoji',
  'sensoji': 'sensoji',
  'sensoji temple': 'sensoji',
  'asakusa temple': 'sensoji',
  'meiji shrine': 'meiji-shrine',
  'meiji jingu': 'meiji-shrine',
  'shibuya crossing': 'shibuya-crossing',
  'shibuya scramble': 'shibuya-crossing',
  'tokyo tower': 'tokyo-tower',
  'tokyo skytree': 'tokyo-skytree',
  'skytree': 'tokyo-skytree',
  'tsukiji market': 'tsukiji',
  'tsukiji outer market': 'tsukiji',
  'imperial palace': 'imperial-palace-tokyo',
  'tokyo imperial palace': 'imperial-palace-tokyo',
  'shinjuku gyoen': 'shinjuku-gyoen',
  'shinjuku garden': 'shinjuku-gyoen',
  'harajuku': 'harajuku',
  'takeshita street': 'harajuku',
  'akihabara': 'akihabara',

  // --- NEW YORK ---
  'statue of liberty': 'statue-of-liberty',
  'lady liberty': 'statue-of-liberty',
  'central park': 'central-park',
  'times square': 'times-square',
  'empire state building': 'empire-state',
  'empire state': 'empire-state',
  'brooklyn bridge': 'brooklyn-bridge',
  'metropolitan museum': 'met',
  'the met': 'met',
  'met museum': 'met',
  'metropolitan museum of art': 'met',
  'museum of modern art': 'moma',
  'moma': 'moma',
  'high line': 'high-line',
  'the high line': 'high-line',
  'grand central': 'grand-central',
  'grand central terminal': 'grand-central',
  'one world trade center': 'one-wtc',
  'one world observatory': 'one-wtc',
  'freedom tower': 'one-wtc',
  '9/11 memorial': '9-11-memorial',
  'world trade center memorial': '9-11-memorial',
  'top of the rock': 'top-of-the-rock',
  'rockefeller center': 'rockefeller',

  // --- BERLIN ---
  'brandenburg gate': 'brandenburg-gate',
  'brandenburger tor': 'brandenburg-gate',
  'berlin wall memorial': 'berlin-wall',
  'east side gallery': 'east-side-gallery',
  'reichstag': 'reichstag',
  'reichstag building': 'reichstag',
  'museum island': 'museum-island',
  'museumsinsel': 'museum-island',
  'checkpoint charlie': 'checkpoint-charlie',
  'alexanderplatz': 'alexanderplatz',
  'berlin cathedral': 'berlin-cathedral',
  'berliner dom': 'berlin-cathedral',
  'tiergarten': 'tiergarten',

  // --- LISBON ---
  'belem tower': 'belem-tower',
  'torre de belem': 'belem-tower',
  'jeronimos monastery': 'jeronimos',
  'mosteiro dos jeronimos': 'jeronimos',
  'alfama': 'alfama',
  'alfama district': 'alfama',
  'praca do comercio': 'praca-comercio',
  'commerce square': 'praca-comercio',
  'time out market': 'time-out-market',
  'mercado da ribeira': 'time-out-market',
  'tram 28': 'tram-28',
  'electrico 28': 'tram-28',

  // --- AMSTERDAM ---
  'anne frank house': 'anne-frank',
  'anne frank huis': 'anne-frank',
  'rijksmuseum': 'rijksmuseum',
  'the rijksmuseum': 'rijksmuseum',
  'van gogh museum': 'van-gogh-museum',
  'vondelpark': 'vondelpark',
  'dam square': 'dam-square',
  'royal palace amsterdam': 'royal-palace-amsterdam',
  'koninklijk paleis': 'royal-palace-amsterdam',
  'jordaan': 'jordaan',
  'the jordaan': 'jordaan',

  // --- ISTANBUL ---
  'hagia sophia': 'hagia-sophia',
  'ayasofya': 'hagia-sophia',
  'blue mosque': 'blue-mosque',
  'sultan ahmed mosque': 'blue-mosque',
  'sultanahmet mosque': 'blue-mosque',
  'topkapi palace': 'topkapi',
  'topkapi sarayi': 'topkapi',
  'grand bazaar': 'grand-bazaar',
  'kapali carsi': 'grand-bazaar',
  'basilica cistern': 'basilica-cistern',
  'yerebatan sarnici': 'basilica-cistern',
  'galata tower': 'galata-tower',
  'spice bazaar': 'spice-bazaar',
  'misir carsisi': 'spice-bazaar',
};

/**
 * Resolve a normalized venue name to its canonical alias key.
 * Checks exact match first, then substring containment against alias keys.
 */
export function resolveVenueAlias(name: string): string | null {
  if (!name) return null;
  // Exact match
  if (VENUE_ALIASES[name]) return VENUE_ALIASES[name];
  // Substring: if the name contains an alias key (or vice versa)
  for (const [key, canonical] of Object.entries(VENUE_ALIASES)) {
    if (name.includes(key) || key.includes(name)) return canonical;
  }
  return null;
}

// =============================================================================
// FUZZY VENUE NAME MATCHING
// =============================================================================

/**
 * Check whether two normalized venue names refer to the same place.
 * Returns true if:
 *  - exact match, OR
 *  - both resolve to the same canonical alias, OR
 *  - one name contains the other, OR
 *  - word-overlap ≥ threshold (50% for ≤2-word names, 80% for longer)
 *
 * Both inputs MUST already be normalizeVenueName'd / extractRestaurantVenueName'd.
 */
export function venueNamesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  // Alias resolution — catches bilingual name pairs
  const aliasA = resolveVenueAlias(a);
  const aliasB = resolveVenueAlias(b);
  if (aliasA && aliasB && aliasA === aliasB) return true;
  // Substring containment — handles city-suffix variants
  if (a.includes(b) || b.includes(a)) return true;
  // Word-overlap with adaptive threshold
  const wordsA = new Set(a.split(/\s+/));
  const wordsB = new Set(b.split(/\s+/));
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  const smaller = Math.min(wordsA.size, wordsB.size);
  const threshold = smaller <= 2 ? 0.5 : 0.8;
  return smaller > 0 && intersection / smaller >= threshold;
}

/**
 * Check if `venue` fuzzy-matches ANY entry in a Set of normalized venue names.
 */
export function venueMatchesAny(venue: string, usedSet: Set<string>): boolean {
  if (!venue) return false;
  for (const used of usedSet) {
    if (venueNamesMatch(venue, used)) return true;
  }
  return false;
}

// =============================================================================
// CROSS-DAY ACTIVITY VENUE CANONICALIZATION
// =============================================================================
//
// Strips activity-style verbs/qualifiers ("Exploration", "Priority Visit",
// "Skip the Line Tour", "Morning at …", "Visit to …") so that two activities
// pointing at the same venue collapse to the same canonical key. Used by the
// cross-day venue dedup filter and by ledger-check to detect "same product on
// consecutive days" regressions (Louvre case).

const ACTIVITY_QUALIFIER_RE = /\s+(?:exploration|exploring|experience|priority\s+visit|skip[-\s]the[-\s]line|guided\s+tour|guided\s+visit|private\s+tour|tour|visit|stroll|walk|wander|tasting|workshop|class)$/i;
const ACTIVITY_PREFIX_RE = /^(?:morning|afternoon|evening|final|early|late|leisurely|scenic|guided|private|exclusive)\s+(?:at|in|visit\s+to|stroll\s+(?:at|in|through)|walk\s+(?:at|in|through|around))\s+/i;
const ACTIVITY_VERB_PREFIX_RE = /^(?:visit(?:\s+to)?|explore|exploring|discover|stroll(?:\s+through)?|walk(?:\s+through)?|wander|tour(?:\s+of)?|enjoy|see)\s+(?:at|in|through|around|along|the)?\s*/i;

/**
 * Canonicalize an activity title to its underlying venue identity.
 * "Louvre Museum Exploration" / "Morning at Louvre Museum" / "Skip-the-Line
 * Louvre Tour" → all collapse to the same normalized form.
 */
export function canonicalActivityVenueName(s: string): string {
  if (!s) return '';
  let v = String(s).trim()
    .replace(ACTIVITY_PREFIX_RE, '')
    .replace(ACTIVITY_VERB_PREFIX_RE, '');
  let prev = '';
  while (prev !== v) {
    prev = v;
    v = v.replace(ACTIVITY_QUALIFIER_RE, '').trim();
  }
  return normalizeVenueName(v);
}

export interface CrossDayDuplicateResult {
  isDuplicate: boolean;
  matchedCandidate?: string;
  matchedPrev?: string;
}

/**
 * Returns whether any of the activity's candidate strings (title, venue_name,
 * location.name) is a cross-day duplicate of any prior-day venue. Caller is
 * responsible for excluding categories where recurrence is allowed (dining,
 * accommodation, transport, hotel anchors).
 */
export function crossDayVenueDuplicate(
  activityCandidates: string[],
  priorVenues: string[],
): CrossDayDuplicateResult {
  const cands = activityCandidates
    .map(canonicalActivityVenueName)
    .filter((s) => s && s.length > 3);
  const prevs = priorVenues
    .map(canonicalActivityVenueName)
    .filter((s) => s && s.length > 3 && !/your hotel/i.test(s));
  for (const cand of cands) {
    for (const prev of prevs) {
      if (venueNamesMatch(cand, prev)) {
        return { isDuplicate: true, matchedCandidate: cand, matchedPrev: prev };
      }
    }
  }
  return { isDuplicate: false };
}

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// =============================================================================
// DATABASE LOOKUP HELPERS
// =============================================================================

/**
 * Resolve city name to destination UUID for dynamic feature matching.
 */
export async function getDestinationId(supabase: any, destination: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('destinations')
      .select('id')
      .or(`city.ilike.%${destination}%,country.ilike.%${destination}%`)
      .limit(1);

    if (error) {
      console.warn(`[getDestinationId] Query failed:`, error.message);
      return null;
    }

    const id = data?.[0]?.id || null;
    console.log(`[getDestinationId] ${destination} → ${id || 'not found'}`);
    return id;
  } catch (e) {
    console.warn(`[getDestinationId] Exception:`, e);
    return null;
  }
}

/**
 * Fetch airport transfer time from destinations table.
 * Returns destination-specific transfer time, or default 45 minutes.
 */
export async function getAirportTransferMinutes(
  supabase: any,
  destination: string,
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('destinations')
      .select('airport_transfer_minutes, city')
      .or(
        `city.ilike.%${destination}%,country.ilike.%${destination}%`,
      )
      .limit(1);

    if (error || !data?.length) {
      console.log(
        `[AirportTransfer] No destination found for "${destination}", using default 45 min`,
      );
      return 45;
    }

    const transferTime = data[0].airport_transfer_minutes || 45;
    console.log(
      `[AirportTransfer] Found ${data[0].city}: ${transferTime} minutes`,
    );
    return transferTime;
  } catch (e) {
    console.error('[AirportTransfer] Error fetching transfer time:', e);
    return 45;
  }
}

/**
 * Fetch airport transfer fare from database to sync with Airport Game Plan.
 * Falls back to null if no data found.
 */
export async function getAirportTransferFare(
  supabase: any,
  city: string,
  airportCode?: string,
): Promise<AirportTransferFare | null> {
  try {
    let query = supabase
      .from('airport_transfer_fares')
      .select('taxi_cost_min, taxi_cost_max, train_cost, bus_cost, currency, currency_symbol, taxi_is_fixed_price')
      .ilike('city', city);

    if (airportCode) {
      query = query.eq('airport_code', airportCode.toUpperCase());
    }

    const { data, error } = await query.limit(1);

    if (error || !data?.length) {
      console.log(`[AirportFare] No fare found for ${city}${airportCode ? ` (${airportCode})` : ''}`);
      return null;
    }

    const fare = data[0];
    console.log(`[AirportFare] Found fare for ${city}: taxi €${fare.taxi_cost_min}-${fare.taxi_cost_max}, train €${fare.train_cost}`);

    return {
      taxiCostMin: fare.taxi_cost_min,
      taxiCostMax: fare.taxi_cost_max,
      trainCost: fare.train_cost,
      busCost: fare.bus_cost,
      currency: fare.currency || 'EUR',
      currencySymbol: fare.currency_symbol || '€',
      taxiIsFixedPrice: fare.taxi_is_fixed_price || false,
    };
  } catch (e) {
    console.error('[AirportFare] Error fetching fare:', e);
    return null;
  }
}
