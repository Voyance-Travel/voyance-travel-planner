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
