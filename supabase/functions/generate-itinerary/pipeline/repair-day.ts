/**
 * Pipeline Repair — Deterministic repairs keyed to failure codes.
 *
 * Phase 3: Takes a generated day + ValidationResult[], applies repairs in order.
 * Returns mutated day + list of RepairAction records for logging.
 *
 * EXECUTION ORDER MATTERS:
 * 1. PHANTOM_HOTEL (strip fake hotels)
 * 2. CHAIN_RESTAURANT (strip chains)
 * 3. CHRONOLOGY (filter pre-arrival, sort)
 * 4. DUPLICATE_CONCEPT (strip trip-wide dupes, swap meals from pool)
 * 5. WEAK_PERSONALIZATION (strip avoid-list violations)
 * 5a. MEAL_ORDER (relabel or swap meals whose title/venue contradicts their time slot)
 * 5b. MEAL_DUPLICATE (relabel/swap/remove duplicate meals)
 * 6. LOGISTICS_SEQUENCE (departure day reorder — fires for isLastDay OR isLastDayInCity)
 * 7. CHECK-IN GUARANTEE (day 1 / transition day)
 * 8. CHECKOUT GUARANTEE (last day / last day in city)
 * 8b. DEPARTURE TRANSPORT GUARANTEE (inject airport/station transfer if missing)
 * 9. MISSING_SLOT (bookend: inject transits + hotel returns, with departure-day guards)
 * 10. TITLE_LABEL_LEAK (strip label leaks)
 * 11. DEPARTURE SEQUENCE FIX (swap checkout before transport — fires for all departure days)
 * 12. NON-FLIGHT DEPARTURE (strip airport refs)
 */

import { FAILURE_CODES, type ValidationResult, type RepairAction, type FailureCode } from './types.ts';
import type { StrictActivityMinimal, StrictDayMinimal } from '../day-validation.ts';
import { sanitizeTransitDestination } from '../sanitization.ts';
import {
  parseTimeToMinutes,
  minutesToHHMM,
  addMinutesToHHMM,
} from '../flight-hotel-context.ts';
import { extractRestaurantVenueName, haversineDistanceKm } from '../generation-utils.ts';

// =============================================================================
// INPUT TYPES
// =============================================================================

export interface RepairDayInput {
  day: StrictDayMinimal;
  validationResults: ValidationResult[];
  dayNumber: number;
  isFirstDay: boolean;
  isLastDay: boolean;

  // Flight context for pre-arrival filter and departure sequence
  arrivalTime24?: string;
  returnDepartureTime24?: string;
  departureAirport?: string;
  arrivalAirport?: string;
  airportTransferMinutes?: number;

  // Hotel context for bookend validator
  hotelName?: string;
  hotelAddress?: string;
  hasHotel: boolean;
  hotelCoordinates?: { lat: number; lng: number };

  // Multi-city / transition context (pre-resolved by orchestrator)
  isTransitionDay?: boolean;
  isMultiCity?: boolean;
  isLastDayInCity?: boolean;
  resolvedDestination?: string;
  nextLegTransport?: string;
  nextLegCity?: string;
  nextLegTransportDetails?: { stationName?: string; departureTime?: string; [key: string]: any };
  hotelOverride?: { name?: string; address?: string };

  // Split-stay context (same city, different hotel)
  isHotelChange?: boolean;
  previousHotelName?: string;
  previousHotelAddress?: string;

  // Dawn guard: earliest allowed activity time for this day (HH:MM 24h)
  earliestStart?: string;

  // Locked activities (never remove)
  lockedActivities: StrictActivityMinimal[];

  // Restaurant pool for meal-swap dedup
  restaurantPool?: Array<{ name: string; address?: string; neighborhood?: string; cuisine?: string; priceRange?: string; mealType: string }>;
  usedRestaurants?: string[];
}

// =============================================================================
// CITY-AWARE TRANSIT PRICING
// =============================================================================

interface CityTransitTier {
  taxiPerKm: number;
  transitFlat: number;
  taxiBase: number;
}

const TRANSIT_TIERS: Record<string, CityTransitTier> = {
  expensive: { taxiPerKm: 3.5, transitFlat: 3.5, taxiBase: 5.0 },
  moderate:  { taxiPerKm: 2.0, transitFlat: 2.0, taxiBase: 3.0 },
  budget:    { taxiPerKm: 0.8, transitFlat: 0.5, taxiBase: 1.5 },
  default:   { taxiPerKm: 2.0, transitFlat: 2.0, taxiBase: 3.0 },
};

const CITY_TO_TIER: Record<string, string> = {
  // Expensive
  'new york': 'expensive', 'nyc': 'expensive', 'manhattan': 'expensive',
  'london': 'expensive', 'tokyo': 'expensive', 'paris': 'expensive',
  'zurich': 'expensive', 'geneva': 'expensive', 'sydney': 'expensive',
  'melbourne': 'expensive', 'singapore': 'expensive', 'hong kong': 'expensive',
  'oslo': 'expensive', 'copenhagen': 'expensive', 'stockholm': 'expensive',
  'san francisco': 'expensive', 'los angeles': 'expensive', 'chicago': 'expensive',
  'dublin': 'expensive', 'amsterdam': 'expensive', 'helsinki': 'expensive',
  'reykjavik': 'expensive', 'monaco': 'expensive', 'doha': 'expensive',
  'dubai': 'expensive', 'abu dhabi': 'expensive',
  // Moderate
  'barcelona': 'moderate', 'madrid': 'moderate', 'rome': 'moderate',
  'milan': 'moderate', 'florence': 'moderate', 'venice': 'moderate',
  'berlin': 'moderate', 'munich': 'moderate', 'vienna': 'moderate',
  'prague': 'moderate', 'athens': 'moderate', 'seoul': 'moderate',
  'taipei': 'moderate', 'buenos aires': 'moderate', 'santiago': 'moderate',
  'cape town': 'moderate', 'toronto': 'moderate', 'montreal': 'moderate',
  'lisbon': 'moderate', 'porto': 'moderate', 'brussels': 'moderate',
  'warsaw': 'moderate', 'budapest': 'moderate', 'krakow': 'moderate',
  // Budget
  'bangkok': 'budget', 'chiang mai': 'budget', 'phuket': 'budget',
  'hanoi': 'budget', 'ho chi minh city': 'budget', 'saigon': 'budget',
  'bali': 'budget', 'jakarta': 'budget', 'kuala lumpur': 'budget',
  'istanbul': 'budget', 'cairo': 'budget', 'marrakech': 'budget',
  'mexico city': 'budget', 'bogota': 'budget', 'medellin': 'budget',
  'lima': 'budget', 'cusco': 'budget', 'delhi': 'budget',
  'mumbai': 'budget', 'goa': 'budget', 'kathmandu': 'budget',
  'phnom penh': 'budget', 'siem reap': 'budget', 'colombo': 'budget',
  'tbilisi': 'budget', 'tashkent': 'budget',
};

// =============================================================================
// FALLBACK RESTAURANTS — City-aware hardcoded venues for when pool is exhausted
// =============================================================================

interface FallbackVenue {
  name: string;
  neighborhood: string;
  address: string;
}

const FALLBACK_RESTAURANTS: Record<string, Record<string, FallbackVenue[]>> = {
  'lisbon': {
    breakfast: [
      { name: 'Heim Café', neighborhood: 'Chiado', address: 'R. de Santos-o-Velho 2, Lisbon' },
      { name: 'Copenhagen Coffee Lab', neighborhood: 'Chiado', address: 'R. Nova da Piedade 10, Lisbon' },
      { name: 'Hello Kristof', neighborhood: 'Príncipe Real', address: 'R. do Poço dos Negros 103, Lisbon' },
      { name: 'The Mill', neighborhood: 'Santos', address: 'R. do Poço dos Negros 1, Lisbon' },
      { name: 'Nicolau Lisboa', neighborhood: 'Rossio', address: 'R. de São Nicolau 17, Lisbon' },
    ],
    lunch: [
      { name: 'Cervejaria Ramiro', neighborhood: 'Intendente', address: 'Av. Almirante Reis 1H, Lisbon' },
      { name: 'Ponto Final', neighborhood: 'Cacilhas', address: 'R. do Ginjal 72, Almada' },
      { name: 'O Velho Eurico', neighborhood: 'Alfama', address: 'Largo de São Cristóvão 3, Lisbon' },
      { name: 'A Cevicheria', neighborhood: 'Príncipe Real', address: 'R. Dom Pedro V 129, Lisbon' },
      { name: 'Café de São Bento', neighborhood: 'São Bento', address: 'R. de São Bento 212, Lisbon' },
    ],
    dinner: [
      { name: 'Sacramento do Chiado', neighborhood: 'Chiado', address: 'R. do Sacramento 26, Lisbon' },
      { name: 'Solar dos Presuntos', neighborhood: 'Restauradores', address: 'R. das Portas de Santo Antão 150, Lisbon' },
      { name: 'Sea Me', neighborhood: 'Chiado', address: 'R. do Loreto 21, Lisbon' },
      { name: 'Mini Bar Teatro', neighborhood: 'Chiado', address: 'R. António Maria Cardoso 58, Lisbon' },
      { name: 'Pharmácia', neighborhood: 'Santa Catarina', address: 'R. Marechal Saldanha 1, Lisbon' },
    ],
  },
  'porto': {
    breakfast: [
      { name: 'Mesa 325', neighborhood: 'Ribeira', address: 'R. de Santa Catarina 325, Porto' },
      { name: 'Combi Coffee Roasters', neighborhood: 'Cedofeita', address: 'R. de Passos Manuel 27, Porto' },
    ],
    lunch: [
      { name: 'Cantinho do Avillez', neighborhood: 'Ribeira', address: 'R. de Mouzinho da Silveira 166, Porto' },
      { name: 'Café Santiago', neighborhood: 'Baixa', address: 'R. de Passos Manuel 226, Porto' },
    ],
    dinner: [
      { name: 'Pedro Lemos', neighborhood: 'Foz', address: 'R. do Padre Luís Cabral 974, Porto' },
      { name: 'Cafeína', neighborhood: 'Foz do Douro', address: 'R. do Padrão 100, Porto' },
    ],
  },
  'barcelona': {
    breakfast: [
      { name: 'Federal Café', neighborhood: 'Gòtic', address: 'Passatge de la Pau 11, Barcelona' },
      { name: 'Flax & Kale', neighborhood: 'Raval', address: 'C/ dels Tallers 74B, Barcelona' },
    ],
    lunch: [
      { name: 'Can Culleretes', neighborhood: 'Gòtic', address: "C/ d'en Quintana 5, Barcelona" },
      { name: 'La Pepita', neighborhood: 'Gràcia', address: 'C/ de Còrsega 343, Barcelona' },
    ],
    dinner: [
      { name: 'Tickets', neighborhood: 'Poble-sec', address: 'Av. del Paral·lel 164, Barcelona' },
      { name: 'Can Paixano', neighborhood: 'Barceloneta', address: 'C/ de la Reina Cristina 7, Barcelona' },
    ],
  },
};

export function getCityTier(city?: string): CityTransitTier {
  if (!city) return TRANSIT_TIERS.default;
  const lower = city.toLowerCase().trim();
  // Try exact match first
  const tierName = CITY_TO_TIER[lower];
  if (tierName) return TRANSIT_TIERS[tierName];
  // Try partial match (e.g. "New York City" → "new york")
  for (const [key, tier] of Object.entries(CITY_TO_TIER)) {
    if (lower.includes(key) || key.includes(lower)) return TRANSIT_TIERS[tier];
  }
  return TRANSIT_TIERS.default;
}

// =============================================================================
// HAVERSINE + TRANSIT ESTIMATION
// =============================================================================

function haversineDistanceMeters(
  lat1: number, lng1: number, lat2: number, lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface TransitEstimateResult {
  durationMinutes: number;
  method: string;
  costAmount: number;
  distanceMeters: number;
}

function estimateTransit(
  fromCoords: { lat: number; lng: number },
  toCoords: { lat: number; lng: number },
  city?: string,
): TransitEstimateResult {
  const dist = haversineDistanceMeters(fromCoords.lat, fromCoords.lng, toCoords.lat, toCoords.lng);
  const tier = getCityTier(city);

  if (dist <= 1200) {
    // Walking
    const dur = Math.max(3, Math.ceil(dist / 80)); // ~5 km/h
    return { durationMinutes: dur, method: 'walking', costAmount: 0, distanceMeters: dist };
  } else if (dist <= 8000) {
    // Transit
    const dur = Math.max(5, Math.ceil(dist / 500) + 5);
    return { durationMinutes: dur, method: 'transit', costAmount: Math.round(tier.transitFlat * 100) / 100, distanceMeters: dist };
  } else {
    // Taxi
    const dur = Math.max(5, Math.ceil(dist / 400) + 3);
    const cost = tier.taxiBase + (dist / 1000) * tier.taxiPerKm;
    return { durationMinutes: dur, method: 'taxi', costAmount: Math.round(cost * 100) / 100, distanceMeters: dist };
  }
}

/** Extract coordinates from an activity (if enriched) */
function getActivityCoords(act: any): { lat: number; lng: number } | null {
  const c = act?.location?.coordinates;
  if (c && typeof c.lat === 'number' && typeof c.lng === 'number') return c;
  return null;
}

export interface RepairDayResult {
  day: StrictDayMinimal;
  repairs: RepairAction[];
}

// =============================================================================
// MAIN REPAIR FUNCTION
// =============================================================================

export function repairDay(input: RepairDayInput): RepairDayResult {
  const repairs: RepairAction[] = [];
  const { validationResults, dayNumber, isFirstDay, isLastDay,
    arrivalTime24, returnDepartureTime24, departureAirport,
    hotelName, hotelAddress, hasHotel, hotelCoordinates,
    lockedActivities, restaurantPool, usedRestaurants,
    isTransitionDay, isMultiCity, isLastDayInCity,
    resolvedDestination, nextLegTransport, nextLegTransportDetails, hotelOverride,
    isHotelChange, previousHotelName } = input;

  // Clone activities array to mutate
  let activities: any[] = [...(input.day.activities || [])];
  const lockedIds = new Set(lockedActivities.map(l => l.id));

  // Group validations by code for efficient dispatch
  const byCode = new Map<FailureCode, ValidationResult[]>();
  for (const vr of validationResults) {
    const list = byCode.get(vr.code) || [];
    list.push(vr);
    byCode.set(vr.code, list);
  }

  // --- 1. PHANTOM_HOTEL ---
  if (byCode.has(FAILURE_CODES.PHANTOM_HOTEL)) {
    const indices = (byCode.get(FAILURE_CODES.PHANTOM_HOTEL) || [])
      .map(vr => vr.activityIndex)
      .filter((i): i is number => i !== undefined)
      .sort((a, b) => b - a); // reverse so splicing doesn't shift indices
    for (const idx of indices) {
      if (idx < activities.length && !lockedIds.has(activities[idx]?.id)) {
        const removed = activities[idx];
        activities.splice(idx, 1);
        repairs.push({
          code: FAILURE_CODES.PHANTOM_HOTEL,
          activityIndex: idx,
          action: 'stripped_phantom_hotel',
          before: removed?.title,
        });
      }
    }
  }

  // --- 2. CHAIN_RESTAURANT ---
  if (byCode.has(FAILURE_CODES.CHAIN_RESTAURANT)) {
    const indices = (byCode.get(FAILURE_CODES.CHAIN_RESTAURANT) || [])
      .map(vr => vr.activityIndex)
      .filter((i): i is number => i !== undefined)
      .sort((a, b) => b - a);
    for (const idx of indices) {
      if (idx < activities.length && !lockedIds.has(activities[idx]?.id)) {
        const removed = activities[idx];
        activities.splice(idx, 1);
        repairs.push({
          code: FAILURE_CODES.CHAIN_RESTAURANT,
          activityIndex: idx,
          action: 'removed_chain_restaurant',
          before: removed?.title,
        });
      }
    }
  }

  // --- 2b. GENERIC_VENUE: replace placeholder dining venues with real ones ---
  if (byCode.has(FAILURE_CODES.GENERIC_VENUE)) {
    const genericResults = byCode.get(FAILURE_CODES.GENERIC_VENUE) || [];
    const normalizeForDedup = extractRestaurantVenueName;
    const usedSet = new Set((usedRestaurants || []).map(n => normalizeForDedup(n)));
    // Also track current day dining venues
    for (const act of activities) {
      if ((act.category || '').toLowerCase() === 'dining') {
        const locName = act.location?.name || '';
        if (locName) usedSet.add(normalizeForDedup(locName));
        usedSet.add(normalizeForDedup(act.title || ''));
      }
    }

    for (const vr of genericResults) {
      if (vr.activityIndex === undefined) continue;
      const act = activities[vr.activityIndex];
      if (!act || lockedIds.has(act.id)) continue;

      const isDining = (act.category || '').toLowerCase().includes('dining') ||
        /\b(breakfast|brunch|lunch|dinner)\b/i.test(act.title || '');
      if (!isDining) continue;

      // Detect meal type from title or time
      const titleLower = (act.title || '').toLowerCase();
      const startHour = parseInt((act.startTime || '12:00').split(':')[0], 10);
      const mealType = titleLower.includes('breakfast') || titleLower.includes('brunch') ? 'breakfast'
        : titleLower.includes('lunch') ? 'lunch'
        : titleLower.includes('dinner') || titleLower.includes('supper') ? 'dinner'
        : startHour < 11 ? 'breakfast' : startHour < 15 ? 'lunch' : 'dinner';

      // Try to find a real replacement from the restaurant pool
      let replaced = false;
      if (restaurantPool && restaurantPool.length > 0) {
        const replacement = restaurantPool.find(r => {
          const rNameNorm = normalizeForDedup(r.name || '');
          if (usedSet.has(rNameNorm)) return false;
          return r.mealType === mealType || r.mealType === 'any';
        });

        if (replacement) {
          const before = act.title;
          const mealLabel = mealType.charAt(0).toUpperCase() + mealType.slice(1);
          act.title = `${mealLabel} at ${replacement.name}`;
          act.location = { name: replacement.name, address: replacement.address || '' };
          act.description = `${replacement.cuisine || 'Local cuisine'} in ${replacement.neighborhood || 'the city'}.`;
          act.source = 'generic-venue-repair';
          usedSet.add(normalizeForDedup(replacement.name));
          replaced = true;
          repairs.push({
            code: FAILURE_CODES.GENERIC_VENUE,
            activityIndex: vr.activityIndex,
            action: 'replaced_generic_with_pool_venue',
            before,
            after: act.title,
          });
          console.log(`[Repair] GENERIC_VENUE: Replaced "${before}" → "${act.title}"`);
        }
      }

      if (!replaced) {
        // Try city-aware fallback restaurants when pool is exhausted
        const cityKey = (resolvedDestination || '').toLowerCase().trim();
        const fallbackList = FALLBACK_RESTAURANTS[cityKey]?.[mealType] || FALLBACK_RESTAURANTS[cityKey]?.['any'] || [];
        const fallbackVenue = fallbackList.find((f: any) => !usedSet.has(normalizeForDedup(f.name)));

        if (fallbackVenue) {
          const before = act.title;
          const mealLabel = mealType.charAt(0).toUpperCase() + mealType.slice(1);
          act.title = `${mealLabel} at ${fallbackVenue.name}`;
          act.location = { name: fallbackVenue.name, address: fallbackVenue.address || '' };
          act.description = `Local dining in ${fallbackVenue.neighborhood || 'the city center'}.`;
          act.source = 'generic-venue-fallback';
          usedSet.add(normalizeForDedup(fallbackVenue.name));
          repairs.push({
            code: FAILURE_CODES.GENERIC_VENUE,
            activityIndex: vr.activityIndex,
            action: 'replaced_generic_with_fallback_venue',
            before,
            after: act.title,
          });
          console.log(`[Repair] GENERIC_VENUE: Fallback replaced "${before}" → "${act.title}"`);
        } else {
          // Last resort: clean up location and strip generic article from title
          const before = act.title;
          const locName = (act.location?.name || '').toLowerCase();
          if (locName === 'the destination' || locName === '' || locName === 'a restaurant' || locName === 'local restaurant') {
            act.location = { ...act.location, name: act.title || 'Restaurant' };
          }
          // Strip generic article pattern from title: "Lunch at a bistro" → "Lunch"
          act.title = (act.title || '').replace(/\s+at\s+(a|an|the)\s+.+$/i, '').trim();
          if (act.title !== before) {
            repairs.push({
              code: FAILURE_CODES.GENERIC_VENUE,
              activityIndex: vr.activityIndex,
              action: 'stripped_generic_article_from_title',
              before,
              after: act.title,
            });
          }
          console.warn(`[Repair] GENERIC_VENUE: No pool/fallback for "${before}" — stripped to "${act.title}"`);
        }
      }
    }
  }

  // --- 3. CHRONOLOGY: filter pre-arrival activities on first day ---
  if (isFirstDay && arrivalTime24) {
    const arrivalMins = parseTimeToMinutes(arrivalTime24);
    if (arrivalMins !== null) {
      const before = activities.length;
      activities = activities.filter((act: any) => {
        const actStart = parseTimeToMinutes(act.startTime || '00:00');
        if (actStart === null) return true;
        const isArrivalActivity = (act.category === 'transport' || act.category === 'logistics') &&
          ((act.title || '').toLowerCase().includes('arrival') || (act.title || '').toLowerCase().includes('airport'));
        if (actStart < arrivalMins && !isArrivalActivity && !lockedIds.has(act.id)) {
          repairs.push({
            code: FAILURE_CODES.CHRONOLOGY,
            action: 'filtered_pre_arrival',
            before: act.title,
          });
          return false;
        }
        return true;
      });
    }
  }

  // Sort by startTime to fix chronology issues
  if (byCode.has(FAILURE_CODES.CHRONOLOGY)) {
    activities.sort((a: any, b: any) => {
      const ta = parseTimeToMinutes(a.startTime || '') ?? 99999;
      const tb = parseTimeToMinutes(b.startTime || '') ?? 99999;
      return ta - tb;
    });
    repairs.push({ code: FAILURE_CODES.CHRONOLOGY, action: 'sorted_by_time' });
  }

  // --- DAWN GUARD: shift pre-6AM activities forward on non-arrival days ---
  {
    const DAWN_LIMIT = 6 * 60; // 06:00 = 360 minutes
    const earliestAllowed = input.earliestStart
      ? (parseTimeToMinutes(input.earliestStart) ?? 8 * 60)
      : 8 * 60; // default 08:00

    // Find the earliest non-flight/transport activity
    const preDawnActivities: number[] = [];
    for (let i = 0; i < activities.length; i++) {
      const act = activities[i];
      const mins = parseTimeToMinutes(act.startTime || '') ?? null;
      if (mins === null) continue;
      if (mins >= DAWN_LIMIT) continue;

      // Skip flight/arrival cards on first day — those are legitimate pre-dawn
      const cat = (act.category || '').toLowerCase();
      const title = (act.title || '').toLowerCase();
      const isFlightOrArrival = cat === 'flight' || (cat === 'transport' && title.includes('airport'));
      if (isFirstDay && isFlightOrArrival) continue;

      // Skip locked activities
      if (lockedIds.has(act.id)) continue;

      preDawnActivities.push(i);
    }

    if (preDawnActivities.length > 0) {
      // Find the earliest pre-dawn time to compute offset
      let earliestPreDawn = Infinity;
      for (const idx of preDawnActivities) {
        const mins = parseTimeToMinutes(activities[idx].startTime || '') ?? Infinity;
        if (mins < earliestPreDawn) earliestPreDawn = mins;
      }

      const shiftAmount = Math.max(0, earliestAllowed - earliestPreDawn);
      if (shiftAmount > 0) {
        console.log(`[Repair] DAWN_GUARD: ${preDawnActivities.length} activities before 6:00 AM — shifting ALL activities forward by ${shiftAmount} min (earliest was ${earliestPreDawn} min, target ${earliestAllowed} min)`);

        // Shift ALL activities forward by the same offset to preserve relative spacing
        for (const act of activities) {
          const startMins = parseTimeToMinutes(act.startTime || '') ?? null;
          const endMins = parseTimeToMinutes(act.endTime || '') ?? null;
          if (startMins !== null) {
            act.startTime = minutesToHHMM(startMins + shiftAmount);
          }
          if (endMins !== null) {
            act.endTime = minutesToHHMM(endMins + shiftAmount);
          }
        }

        repairs.push({
          code: FAILURE_CODES.CHRONOLOGY,
          action: `dawn_guard_shifted_${preDawnActivities.length}_activities_by_${shiftAmount}min`,
        });
      }
    }
  }

  // --- 3b. ARRIVAL FLIGHT + AIRPORT TRANSFER (Day 1 only) ---
  if (isFirstDay && arrivalTime24 && !isHotelChange) {
    const arrivalAirportName = input.arrivalAirport || 'the Airport';
    const transferMinutes = input.airportTransferMinutes || 45;

    const hasArrivalFlight = activities.some((a: any) => {
      const t = (a.title || '').toLowerCase();
      const cat = (a.category || '').toLowerCase();
      return (cat === 'flight' || cat === 'transport') && (
        t.includes('arrival flight') || t.includes('landing') ||
        (t.includes('arrive') && t.includes('flight'))
      );
    });

    if (!hasArrivalFlight) {
      const arrivalMins = parseTimeToMinutes(arrivalTime24);
      if (arrivalMins !== null) {
        const flightEndMins = arrivalMins;
        const flightStartMins = Math.max(0, arrivalMins - 120);
        const flightCard = {
          id: `day${dayNumber}-arrival-flight-${Date.now()}`,
          title: 'Arrival Flight',
          name: 'Arrival Flight',
          description: `Arrive at ${arrivalAirportName}.`,
          startTime: minutesToHHMM(flightStartMins),
          endTime: minutesToHHMM(flightEndMins),
          category: 'flight',
          type: 'flight',
          location: { name: arrivalAirportName, address: '' },
          cost: { amount: 0, currency: 'USD' },
          bookingRequired: false,
          isLocked: false,
          durationMinutes: 120,
          source: 'repair-arrival-flight',
        };

        const transferStartMins = flightEndMins + 30;
        const transferEndMins = transferStartMins + transferMinutes;
        const transferHotelName = hotelName || 'Your Hotel';
        const transferCard = {
          id: `day${dayNumber}-airport-transfer-${Date.now()}`,
          title: `Transfer to ${transferHotelName}`,
          name: `Transfer to ${transferHotelName}`,
          description: `Travel from ${arrivalAirportName} to ${transferHotelName}.`,
          startTime: minutesToHHMM(transferStartMins),
          endTime: minutesToHHMM(transferEndMins),
          category: 'transport',
          type: 'transport',
          location: { name: transferHotelName, address: hotelAddress || '' },
          fromLocation: { name: arrivalAirportName, address: '' },
          cost: { amount: 0, currency: 'USD' },
          bookingRequired: false,
          isLocked: false,
          durationMinutes: transferMinutes,
          source: 'repair-airport-transfer',
        };

        activities.unshift(transferCard);
        activities.unshift(flightCard);
        repairs.push({ code: FAILURE_CODES.MISSING_SLOT, action: 'injected_arrival_flight' });
        repairs.push({ code: FAILURE_CODES.MISSING_SLOT, action: 'injected_airport_transfer' });
        console.log(`[Repair] Injected arrival flight + airport transfer on Day 1`);
      }
    }
  }

  // --- 4. DUPLICATE_CONCEPT: strip trip-wide duplicates ---
  if (byCode.has(FAILURE_CODES.DUPLICATE_CONCEPT)) {
    const dupeResults = byCode.get(FAILURE_CODES.DUPLICATE_CONCEPT) || [];
    // Normalize used restaurant names for reliable matching
    const normalizeForDedup = extractRestaurantVenueName;
    const usedSet = new Set((usedRestaurants || []).map(n => normalizeForDedup(n)));
    // Track current day dining by location.name (canonical venue identity)
    for (const act of activities) {
      if ((act.category || '').toLowerCase() === 'dining') {
        const locationName = act.location?.name || '';
        if (locationName) usedSet.add(normalizeForDedup(locationName));
        usedSet.add(normalizeForDedup(act.title || ''));
      }
    }

    const indicesToRemove: number[] = [];
    for (const vr of dupeResults) {
      if (vr.activityIndex === undefined) continue;
      const act = activities[vr.activityIndex];
      if (!act || lockedIds.has(act.id)) continue;

      const isDining = (act.category || '').toLowerCase() === 'dining';

      // For dining dupes: try pool swap first
      if (isDining && restaurantPool && restaurantPool.length > 0) {
        const startHour = parseInt((act.startTime || '12:00').split(':')[0], 10);
        const mealType = startHour < 11 ? 'breakfast' : startHour < 15 ? 'lunch' : 'dinner';

        const replacement = restaurantPool.find(r => {
          const rNameNorm = normalizeForDedup(r.name || '');
          if (usedSet.has(rNameNorm)) return false;
          return r.mealType === mealType || r.mealType === 'any';
        });

        if (replacement) {
          const before = act.title;
          act.title = `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} at ${replacement.name}`;
          act.description = `${replacement.cuisine || 'Local cuisine'} in ${replacement.neighborhood || 'the city'}. ${replacement.priceRange || '$$'}.`;
          act.location = { name: replacement.name, address: replacement.address || '' };
          act.source = 'pool-dedup-swap';
          usedSet.add(normalizeForDedup(replacement.name));

          // Sync preceding transport card to reference the new restaurant
          const prevIdx = vr.activityIndex - 1;
          if (prevIdx >= 0) {
            const prev = activities[prevIdx];
            if ((prev.category || '').toLowerCase() === 'transport' &&
                !lockedIds.has(prev.id)) {
              const oldTitle = prev.title;
              prev.title = `Travel to ${replacement.name}`;
              prev.location = { name: replacement.name, address: replacement.address || '' };
              if (prev.description) {
                prev.description = prev.description.replace(/to\s+.+\.?$/, `to ${replacement.name}.`);
              }
              repairs.push({
                code: FAILURE_CODES.DUPLICATE_CONCEPT,
                activityIndex: prevIdx,
                action: 'synced_transit_after_swap',
                before: oldTitle,
                after: prev.title,
              });
            }
          }

          repairs.push({
            code: FAILURE_CODES.DUPLICATE_CONCEPT,
            activityIndex: vr.activityIndex,
            action: 'swapped_from_pool',
            before,
            after: act.title,
          });
          continue;
        }
      }

      // Non-dining or no pool replacement: mark for removal — BUT protect primary meals
      const isPrimaryMeal = /\b(?:breakfast|lunch|dinner|brunch)\b/i.test(act.title || '');
      if (isDining && isPrimaryMeal) {
        console.warn(`[Repair] Keeping duplicate primary meal "${act.title}" — no pool replacement, but meal > uniqueness`);
        continue;
      }
      indicesToRemove.push(vr.activityIndex);
    }

    // Remove in reverse order
    for (const idx of indicesToRemove.sort((a, b) => b - a)) {
      if (idx < activities.length && !lockedIds.has(activities[idx]?.id)) {
        const removed = activities[idx];
        activities.splice(idx, 1);
        repairs.push({
          code: FAILURE_CODES.DUPLICATE_CONCEPT,
          activityIndex: idx,
          action: 'removed_duplicate',
          before: removed?.title,
        });
      }
    }
  }

  // --- 5. WEAK_PERSONALIZATION: strip critical violations ---
  if (byCode.has(FAILURE_CODES.WEAK_PERSONALIZATION)) {
    const persResults = (byCode.get(FAILURE_CODES.WEAK_PERSONALIZATION) || [])
      .filter(vr => vr.severity === 'error')
      .map(vr => vr.activityIndex)
      .filter((i): i is number => i !== undefined)
      .sort((a, b) => b - a);
    for (const idx of persResults) {
      if (idx < activities.length && !lockedIds.has(activities[idx]?.id)) {
        const removed = activities[idx];
        activities.splice(idx, 1);
        repairs.push({
          code: FAILURE_CODES.WEAK_PERSONALIZATION,
          activityIndex: idx,
          action: 'removed_avoid_list_violation',
          before: removed?.title,
        });
      }
    }
  }

  // --- 5a. MEAL_ORDER: relabel meals whose title contradicts their time slot ---
  // Enhanced: check venue suitability before relabeling; swap from pool if incompatible
  if (byCode.has(FAILURE_CODES.MEAL_ORDER)) {
    const MEAL_KW_ORDER: Record<string, string[]> = {
      breakfast: ['breakfast', 'brunch'],
      lunch: ['lunch'],
      dinner: ['dinner', 'supper'],
    };

    // Venue keywords that signal incompatibility with a given meal type
    const VENUE_INCOMPATIBLE: Record<string, string[]> = {
      breakfast: ['nobu', 'steakhouse', 'izakaya', 'omakase', 'fine dining', 'cocktail', 'bar & grill', 'bar and grill', 'tapas', 'sushi', 'yakitori', 'robata', 'wagyu', 'kaiseki', 'tasting menu', 'wine bar', 'speakeasy', 'gastropub'],
      lunch: [], // most venues can serve lunch
      dinner: ['bakery', 'café', 'cafe', 'coffee', 'pancake', 'diner', 'bagel', 'doughnut', 'donut', 'juice bar', 'smoothie', 'açaí', 'acai', 'patisserie', 'pâtisserie', 'croissant'],
    };

    const normalizeForSwap = (name: string) => name.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const usedSetOrder = new Set((usedRestaurants || []).map(n => normalizeForSwap(n)));

    const orderResults = byCode.get(FAILURE_CODES.MEAL_ORDER) || [];
    for (const vr of orderResults) {
      if (vr.activityIndex === undefined) continue;
      const act = activities[vr.activityIndex];
      if (!act || lockedIds.has(act.id)) continue;

      const startMins = parseTimeToMinutes(act.startTime || '12:00');
      if (startMins === null) continue;

      // Determine correct meal for time slot
      let correctMeal: string | null = null;
      if (startMins >= 360 && startMins < 660) correctMeal = 'breakfast';
      else if (startMins >= 660 && startMins < 900) correctMeal = 'lunch';
      else if (startMins >= 1020 && startMins < 1380) correctMeal = 'dinner';
      if (!correctMeal) continue;

      // Find current meal label in title
      const title = (act.title || '');
      const titleLower = title.toLowerCase();
      let currentMealKey: string | null = null;
      let currentKeyword: string | null = null;
      for (const [meal, kws] of Object.entries(MEAL_KW_ORDER)) {
        for (const kw of kws) {
          if (titleLower.includes(kw)) {
            currentMealKey = meal;
            currentKeyword = kw;
            break;
          }
        }
        if (currentMealKey) break;
      }

      if (!currentMealKey || currentMealKey === correctMeal) continue;

      // Check venue compatibility with corrected meal type
      const venueText = [act.title, act.name, (act as any).description, (act as any).location?.name].filter(Boolean).join(' ').toLowerCase();
      const incompatibleKeywords = VENUE_INCOMPATIBLE[correctMeal] || [];
      const isVenueIncompatible = incompatibleKeywords.some(kw => venueText.includes(kw));

      if (isVenueIncompatible && restaurantPool && restaurantPool.length > 0) {
        // Try to swap with a suitable venue from the pool
        const replacement = restaurantPool.find(r => {
          if (usedSetOrder.has(normalizeForSwap(r.name))) return false;
          return r.mealType === correctMeal || r.mealType === 'any';
        });

        if (replacement) {
          const before = act.title;
          const correctLabel = correctMeal.charAt(0).toUpperCase() + correctMeal.slice(1);
          act.title = `${correctLabel} at ${replacement.name}`;
          if (act.name) act.name = replacement.name;
          if ((act as any).description) (act as any).description = `${correctLabel} at ${replacement.name}${replacement.cuisine ? ` — ${replacement.cuisine}` : ''}`;
          if ((act as any).location) {
            (act as any).location = {
              ...(act as any).location,
              name: replacement.name,
              ...(replacement.address ? { address: replacement.address } : {}),
              ...(replacement.neighborhood ? { neighborhood: replacement.neighborhood } : {}),
            };
          }
          usedSetOrder.add(normalizeForSwap(replacement.name));

          console.log(`[Repair] MEAL_ORDER+SWAP: "${before}" → "${act.title}" (venue incompatible with ${correctMeal}, swapped from pool)`);
          repairs.push({
            code: FAILURE_CODES.MEAL_ORDER,
            activityIndex: vr.activityIndex,
            action: 'swapped_incompatible_venue',
            before,
            after: act.title,
          });
          continue;
        }
        // No pool match — fall through to relabel-only
      }

      // Relabel: replace meal keyword in title (venue is compatible or no swap available)
      const correctLabel = correctMeal.charAt(0).toUpperCase() + correctMeal.slice(1);
      const before = act.title;
      const regex = new RegExp(`\\b${currentKeyword}\\b`, 'i');
      act.title = act.title.replace(regex, (match: string) =>
        match[0] === match[0].toUpperCase() ? correctLabel : correctLabel.toLowerCase()
      );
      if (act.name) act.name = act.title;

      console.log(`[Repair] MEAL_ORDER: "${before}" → "${act.title}" (time ${act.startTime})`);
      repairs.push({
        code: FAILURE_CODES.MEAL_ORDER,
        activityIndex: vr.activityIndex,
        action: 'relabeled_meal_for_time',
        before,
        after: act.title,
      });
    }
  }

  // --- 5b. MEAL_DUPLICATE: remove or relabel duplicate same-meal activities ---
  if (byCode.has(FAILURE_CODES.MEAL_DUPLICATE)) {
    const dupeResults = byCode.get(FAILURE_CODES.MEAL_DUPLICATE) || [];
    const MEAL_KW: Record<string, string[]> = {
      breakfast: ['breakfast', 'brunch'],
      lunch: ['lunch'],
      dinner: ['dinner', 'supper'],
    };

    // Determine which meal types are present and how many times
    const mealCounts: Record<string, number[]> = { breakfast: [], lunch: [], dinner: [] };
    for (let i = 0; i < activities.length; i++) {
      const title = (activities[i].title || '').toLowerCase();
      const cat = (activities[i].category || '').toLowerCase();
      if (!cat.includes('dining') && !cat.includes('food') && !cat.includes('restaurant')) continue;
      for (const [meal, kws] of Object.entries(MEAL_KW)) {
        if (kws.some(kw => title.includes(kw))) {
          mealCounts[meal].push(i);
        }
      }
    }

    // For each duplicate: try relabeling to the correct meal for its time slot, otherwise remove
    const indicesToRemove: number[] = [];
    for (const vr of dupeResults) {
      if (vr.activityIndex === undefined) continue;
      const act = activities[vr.activityIndex];
      if (!act || lockedIds.has(act.id)) continue;

      const startMins = parseTimeToMinutes(act.startTime || '12:00');
      if (startMins === null) { indicesToRemove.push(vr.activityIndex); continue; }

      // Determine what meal this time slot SHOULD be
      let correctMeal: string | null = null;
      if (startMins >= 360 && startMins < 660) correctMeal = 'breakfast';
      else if (startMins >= 660 && startMins < 900) correctMeal = 'lunch';
      else if (startMins >= 1020 && startMins < 1380) correctMeal = 'dinner';

      // Check current meal label
      const title = (act.title || '').toLowerCase();
      let currentMeal: string | null = null;
      for (const [meal, kws] of Object.entries(MEAL_KW)) {
        if (kws.some(kw => title.includes(kw))) { currentMeal = meal; break; }
      }

      if (correctMeal && correctMeal !== currentMeal && mealCounts[correctMeal].length === 0) {
        // Relabel: this is wrongly labeled for its time slot and the correct meal is missing
        const before = act.title;
        const correctLabel = correctMeal.charAt(0).toUpperCase() + correctMeal.slice(1);
        const currentLabel = currentMeal ? (currentMeal.charAt(0).toUpperCase() + currentMeal.slice(1)) : '';
        if (currentLabel && act.title) {
          act.title = act.title.replace(new RegExp(currentLabel, 'i'), correctLabel);
          if (act.name) act.name = act.title;
        }
        mealCounts[correctMeal].push(vr.activityIndex);
        repairs.push({
          code: FAILURE_CODES.MEAL_DUPLICATE,
          activityIndex: vr.activityIndex,
          action: 'relabeled_meal',
          before,
          after: act.title,
        });
      } else if (restaurantPool && restaurantPool.length > 0 && correctMeal && mealCounts[correctMeal].length === 0) {
        // Swap from pool for the correct meal type
        const normalizeForSwap = (name: string) => name.toLowerCase().replace(/[^\w\s]/g, '').trim();
        const usedSet = new Set((usedRestaurants || []).map(n => normalizeForSwap(n)));
        const replacement = restaurantPool.find(r => {
          if (usedSet.has(normalizeForSwap(r.name))) return false;
          return r.mealType === correctMeal || r.mealType === 'any';
        });
        if (replacement) {
          const before = act.title;
          const correctLabel = correctMeal.charAt(0).toUpperCase() + correctMeal.slice(1);
          act.title = `${correctLabel} at ${replacement.name}`;
          act.description = `${replacement.cuisine || 'Local cuisine'} in ${replacement.neighborhood || 'the city'}.`;
          act.location = { name: replacement.name, address: replacement.address || '' };
          if (act.name) act.name = act.title;
          usedSet.add(normalizeForSwap(replacement.name));
          mealCounts[correctMeal].push(vr.activityIndex);
          repairs.push({
            code: FAILURE_CODES.MEAL_DUPLICATE,
            activityIndex: vr.activityIndex,
            action: 'swapped_duplicate_meal_from_pool',
            before,
            after: act.title,
          });
          continue;
        }
        indicesToRemove.push(vr.activityIndex);
      } else {
        // Can't relabel or swap — remove the duplicate
        indicesToRemove.push(vr.activityIndex);
      }
    }

    // Remove duplicates in reverse order
    for (const idx of [...new Set(indicesToRemove)].sort((a, b) => b - a)) {
      if (idx < activities.length && !lockedIds.has(activities[idx]?.id)) {
        const removed = activities[idx];
        activities.splice(idx, 1);
        repairs.push({
          code: FAILURE_CODES.MEAL_DUPLICATE,
          activityIndex: idx,
          action: 'removed_duplicate_meal',
          before: removed?.title,
        });
      }
    }
  }

  // --- 6. LOGISTICS_SEQUENCE (departure day) ---
  const isDepartureDayForSequence = isLastDay || (isLastDayInCity && !isTransitionDay);
  if (isDepartureDayForSequence && byCode.has(FAILURE_CODES.LOGISTICS_SEQUENCE)) {
    const seqRepairs = repairDepartureSequence(activities, returnDepartureTime24, hotelName, lockedIds);
    repairs.push(...seqRepairs);
    // Re-sort after departure fixes
    activities.sort((a: any, b: any) => {
      const ta = parseTimeToMinutes(a.startTime || '') ?? 99999;
      const tb = parseTimeToMinutes(b.startTime || '') ?? 99999;
      return ta - tb;
    });
  }

  // --- 7/8 SPLIT-STAY REORDER: On hotel-change days, inject checkout FIRST, then check-in ---
  // For non-hotel-change days, the original order (7=check-in, 8=checkout) is fine.
  // Hotel name normalization helper for robust matching
  const normalizeHotelCore = (name: string): string => {
    return name.toLowerCase()
      .replace(/\b(hotel|resort|suites?|inn|lodge|palace|palácio|boutique|luxury|the|a)\b/gi, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ').trim();
  };

  const hotelCoreMatch = (title: string, hotelName: string): boolean => {
    if (!hotelName) return false;
    const titleNorm = normalizeHotelCore(title);
    const hotelNorm = normalizeHotelCore(hotelName);
    if (!hotelNorm || hotelNorm.length < 3) return false;
    // Check if hotel core name appears in the title, or vice versa
    return titleNorm.includes(hotelNorm) || hotelNorm.includes(titleNorm);
  };

  if (isHotelChange) {
    // --- 8-first. CHECKOUT from PREVIOUS hotel (morning) ---
    const prevHotelLower = (previousHotelName || '').toLowerCase();
    const newHotelLower = (hotelName || '').toLowerCase();

    const isCheckoutTitle = (t: string) =>
      t.includes('check-out') || t.includes('check out') || t.includes('checkout');
    const isCheckInTitle = (t: string) =>
      t.includes('check-in') || t.includes('check in') || t.includes('checkin') ||
      t.includes('settle in') || t.includes('luggage drop');

    const hasCorrectCheckout = activities.some((a: any) => {
      const t = (a.title || a.name || '').toLowerCase();
      const cat = (a.category || '').toLowerCase();
      return cat === 'accommodation' && isCheckoutTitle(t) &&
        (!prevHotelLower || t.includes(prevHotelLower) || hotelCoreMatch(t, previousHotelName || ''));
    });

    // Remove any wrongly-named checkout before injecting the correct one
    if (!hasCorrectCheckout) {
      const wrongCoIdx = activities.findIndex((a: any) => {
        const t = (a.title || a.name || '').toLowerCase();
        const cat = (a.category || '').toLowerCase();
        return cat === 'accommodation' && isCheckoutTitle(t) &&
          prevHotelLower && !t.includes(prevHotelLower) && !hotelCoreMatch(t, previousHotelName || '');
      });
      if (wrongCoIdx >= 0) {
        repairs.push({
          code: FAILURE_CODES.CHRONOLOGY, activityIndex: wrongCoIdx,
          action: 'removed_wrong_hotel_checkout',
          before: activities[wrongCoIdx].title,
          after: `Will inject correct checkout from ${previousHotelName || 'previous hotel'}`,
        });
        activities.splice(wrongCoIdx, 1);
      }

      const coHotelName = previousHotelName || 'Your Hotel';
      const coHotelAddress = input.previousHotelAddress || '';
      const checkoutStartMin = 11 * 60;
      const checkoutStart = minutesToHHMM(checkoutStartMin);
      const checkoutEnd = minutesToHHMM(checkoutStartMin + 30);
      const checkoutActivity = {
        id: `day${dayNumber}-checkout-repair-${Date.now()}`,
        title: `Checkout from ${coHotelName}`,
        name: `Checkout from ${coHotelName}`,
        description: `Check out from ${coHotelName}. Store luggage if needed before continuing your day.`,
        startTime: checkoutStart, endTime: checkoutEnd,
        category: 'accommodation', type: 'accommodation',
        location: { name: coHotelName, address: coHotelAddress },
        cost: { amount: 0, currency: 'USD' },
        bookingRequired: false, isLocked: false, durationMinutes: 30,
        source: 'repair-checkout-guarantee',
      };
      let insertIdx = activities.length;
      for (let i = 0; i < activities.length; i++) {
        const actStart = parseTimeToMinutes(activities[i].startTime || '') ?? 99999;
        if (checkoutStartMin <= actStart) { insertIdx = i; break; }
      }
      activities.splice(insertIdx, 0, checkoutActivity);
      repairs.push({ code: FAILURE_CODES.MISSING_SLOT, action: 'injected_checkout_guarantee_hotel_change' });
    }

    // --- 7-second. CHECK-IN at NEW hotel (afternoon, AFTER checkout) ---
    const hasCorrectCheckIn = activities.some((a: any) => {
      const t = (a.title || a.name || '').toLowerCase();
      const cat = (a.category || '').toLowerCase();
      return cat === 'accommodation' && isCheckInTitle(t) &&
        (!newHotelLower || t.includes(newHotelLower) || hotelCoreMatch(t, hotelName || ''));
    });

    // Remove any wrongly-named check-in before injecting the correct one
    if (!hasCorrectCheckIn) {
      const wrongCiIdx = activities.findIndex((a: any) => {
        const t = (a.title || a.name || '').toLowerCase();
        const cat = (a.category || '').toLowerCase();
        return cat === 'accommodation' && isCheckInTitle(t) &&
          newHotelLower && !t.includes(newHotelLower) && !hotelCoreMatch(t, hotelName || '');
      });
      if (wrongCiIdx >= 0) {
        repairs.push({
          code: FAILURE_CODES.CHRONOLOGY, activityIndex: wrongCiIdx,
          action: 'removed_wrong_hotel_checkin',
          before: activities[wrongCiIdx].title,
          after: `Will inject correct check-in at ${hotelName || 'new hotel'}`,
        });
        activities.splice(wrongCiIdx, 1);
      }

      const hn = hotelName || 'Your Hotel';
      const ha = hotelAddress || '';
      // Find the checkout activity to place check-in after it
      const checkoutAct = activities.find((a: any) => {
        const t = (a.title || '').toLowerCase();
        return t.includes('checkout') || t.includes('check-out') || t.includes('check out');
      });
      const checkoutEndMin = checkoutAct ? (parseTimeToMinutes(checkoutAct.endTime) ?? 11 * 60 + 30) : 11 * 60 + 30;

      // --- Inject transport card: Travel from Hotel A → Hotel B ---
      const transportDuration = 30; // default 30 min for inter-hotel travel
      const transportStartMin = checkoutEndMin;
      const transportEndMin = transportStartMin + transportDuration;
      const coHotelNameForTransport = previousHotelName || 'Your Hotel';
      const transportActivity = {
        id: `day${dayNumber}-hotel-transfer-${Date.now()}`,
        title: `Travel to ${hn}`,
        name: `Travel to ${hn}`,
        description: `Travel from ${coHotelNameForTransport} to ${hn} with your luggage.`,
        startTime: minutesToHHMM(transportStartMin),
        endTime: minutesToHHMM(transportEndMin),
        category: 'transport', type: 'transport',
        location: { name: hn, address: ha },
        fromLocation: { name: coHotelNameForTransport, address: '' },
        cost: { amount: 0, currency: 'USD' },
        bookingRequired: false, isLocked: false, durationMinutes: transportDuration,
        source: 'repair-hotel-transfer',
      };
      // Insert transport chronologically
      let transportIdx = activities.length;
      for (let i = 0; i < activities.length; i++) {
        const actStart = parseTimeToMinutes(activities[i].startTime || '') ?? 99999;
        if (transportStartMin <= actStart) { transportIdx = i; break; }
      }
      activities.splice(transportIdx, 0, transportActivity);
      repairs.push({ code: FAILURE_CODES.MISSING_SLOT, action: 'injected_hotel_transfer_transport' });

      // --- Check-in at NEW hotel: arrives right after transport + 15 min buffer ---
      const checkInStartMin = transportEndMin + 15;
      const checkInStart = minutesToHHMM(checkInStartMin);
      const checkInEnd = minutesToHHMM(checkInStartMin + 30);
      const checkInActivity = {
        id: `day${dayNumber}-checkin-repair-${Date.now() + 1}`,
        title: `Check-in at ${hn}`,
        name: `Check-in at ${hn}`,
        description: `Check in to ${hn}, freshen up after the hotel change.`,
        startTime: checkInStart, endTime: checkInEnd,
        category: 'accommodation', type: 'accommodation',
        location: { name: hn, address: ha },
        cost: { amount: 0, currency: 'USD' },
        bookingRequired: false, isLocked: false, durationMinutes: 30,
        source: 'repair-checkin-guarantee',
      };
      // Insert check-in chronologically (after transport)
      let insertIdx = activities.length;
      for (let i = 0; i < activities.length; i++) {
        const actStart = parseTimeToMinutes(activities[i].startTime || '') ?? 99999;
        if (checkInStartMin <= actStart) { insertIdx = i; break; }
      }
      activities.splice(insertIdx, 0, checkInActivity);
      repairs.push({ code: FAILURE_CODES.MISSING_SLOT, action: 'injected_checkin_guarantee_hotel_change' });
    }

    // --- 8b. SPLIT-STAY SEQUENCE ENFORCEMENT ---
    // Ensure checkout comes before check-in; if inverted, reorder and re-time
    {
      const coIdx = activities.findIndex((a: any) =>
        (a.category || '').toLowerCase() === 'accommodation' && isCheckoutTitle((a.title || a.name || '').toLowerCase()));
      const ciIdx = activities.findIndex((a: any) =>
        (a.category || '').toLowerCase() === 'accommodation' && isCheckInTitle((a.title || a.name || '').toLowerCase()));

      if (coIdx >= 0 && ciIdx >= 0 && coIdx > ciIdx) {
        // Checkout is after check-in — extract checkout, place it before check-in
        const [checkout] = activities.splice(coIdx, 1);
        // ciIdx may have shifted if coIdx was before it (but coIdx > ciIdx so no shift)
        activities.splice(ciIdx, 0, checkout);

        // Re-time the sequence: checkout 11:00, check-in recalculated
        checkout.startTime = '11:00';
        checkout.endTime = '11:30';

        // Find check-in (now at ciIdx + 1) and any transport between them
        const newCiIdx = ciIdx + 1;
        // Look for transport between checkout and check-in
        let transportBetween: any = null;
        for (let t = ciIdx + 1; t < activities.length; t++) {
          const cat = (activities[t].category || '').toLowerCase();
          if (cat === 'transport' || cat === 'transportation') {
            transportBetween = activities[t];
            break;
          }
          if ((activities[t].category || '').toLowerCase() === 'accommodation') break;
        }

        if (transportBetween) {
          transportBetween.startTime = '11:30';
          transportBetween.endTime = '12:00';
        }

        // Update check-in time
        const ciAct = activities.find((a: any, idx: number) =>
          idx > ciIdx && (a.category || '').toLowerCase() === 'accommodation' &&
          isCheckInTitle((a.title || a.name || '').toLowerCase()));
        if (ciAct) {
          ciAct.startTime = '12:15';
          ciAct.endTime = '12:45';
        }

        repairs.push({
          code: FAILURE_CODES.CHRONOLOGY,
          action: 'reordered_split_stay_sequence',
          before: 'Check-in was before checkout',
          after: 'Reordered: Checkout → Transport → Check-in',
        });
      }
    }
  }

  // --- 7. HOTEL CHECK-IN GUARANTEE (Day 1, transition day — NOT hotel change, handled above) ---
  const needsCheckIn = !isHotelChange && (dayNumber === 1 || isTransitionDay);
  if (needsCheckIn && activities.length > 0) {
    const hasCheckIn = activities.some((a: any) => {
      const t = (a.title || a.name || '').toLowerCase();
      const cat = (a.category || '').toLowerCase();
      return cat === 'accommodation' && (
        t.includes('check-in') || t.includes('check in') ||
        t.includes('checkin') || t.includes('settle in') ||
        t.includes('luggage drop')
      );
    });

    if (!hasCheckIn) {
      const hn = hotelName || 'Your Hotel';
      const ha = hotelAddress || '';
      const firstAct = activities[0];
      const firstStartMin = parseTimeToMinutes(firstAct?.startTime || '15:00') ?? (15 * 60);
      const checkInStartMin = Math.max(12 * 60, firstStartMin - 45);
      const checkInStart = minutesToHHMM(checkInStartMin);
      const checkInEnd = minutesToHHMM(checkInStartMin + 30);

      const checkInActivity = {
        id: `day${dayNumber}-checkin-repair-${Date.now()}`,
        title: `Check-in at ${hn}`,
        name: `Check-in at ${hn}`,
        description: dayNumber === 1
          ? 'Check in, freshen up, and get oriented to the area'
          : `Check in to hotel in ${resolvedDestination || 'destination'}, freshen up after travel`,
        startTime: checkInStart,
        endTime: checkInEnd,
        category: 'accommodation',
        type: 'accommodation',
        location: { name: hn, address: ha },
        cost: { amount: 0, currency: 'USD' },
        bookingRequired: false,
        isLocked: false,
        durationMinutes: 30,
        source: 'repair-checkin-guarantee',
      };

      activities.unshift(checkInActivity);
      repairs.push({ code: FAILURE_CODES.MISSING_SLOT, action: 'injected_checkin_guarantee' });

      // On arrival day, remove any accommodation activities scheduled BEFORE check-in
      if (dayNumber === 1) {
        const checkInMin = checkInStartMin;
        const preCheckInAccom = activities.filter((a: any) => {
          if (a.id === checkInActivity.id) return false;
          const cat = (a.category || '').toLowerCase();
          const t = (a.title || '').toLowerCase();
          if (cat !== 'accommodation') return false;
          const aMin = parseTimeToMinutes(a.startTime || '') ?? 99999;
          return aMin < checkInMin;
        });
        for (const toRemove of preCheckInAccom) {
          const idx = activities.indexOf(toRemove);
          if (idx >= 0) {
            activities.splice(idx, 1);
            repairs.push({ code: FAILURE_CODES.CHRONOLOGY, action: 'removed_pre_checkin_accommodation', before: toRemove.title });
          }
        }

        // Strip hotel references from meals scheduled before check-in
        for (const act of activities) {
          const t = (act.title || '').toLowerCase();
          const cat = (act.category || '').toLowerCase();
          const aMin = parseTimeToMinutes(act.startTime || '') ?? 99999;
          if (cat === 'dining' && aMin < checkInMin && (t.includes('hotel') || t.includes(hotelName.toLowerCase()))) {
            const oldTitle = act.title;
            act.title = act.title.replace(/\s*(at|@)\s*(the\s+)?hotel.*/i, '').replace(new RegExp(`\\s*(at|@)\\s*(the\\s+)?${hotelName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'), '');
            if (act.name) act.name = act.title;
            repairs.push({ code: FAILURE_CODES.CHRONOLOGY, action: 'stripped_hotel_from_pre_checkin_meal', before: oldTitle, after: act.title });
          }
        }
      }
    }
  }

  // --- 7b. POST-CHECK-IN DEDUP (relabel duplicate "check-in" titles to "Freshen Up") ---
  {
    const checkInRe = /\bcheck[\s-]?in\b/i;
    const firstCheckInIdx = activities.findIndex((a: any) => {
      const cat = (a.category || '').toLowerCase();
      return cat === 'accommodation' && checkInRe.test(a.title || a.name || '');
    });
    if (firstCheckInIdx >= 0) {
      const hn = hotelName || 'Your Hotel';
      for (let i = firstCheckInIdx + 1; i < activities.length; i++) {
        const a = activities[i];
        const t = (a.title || a.name || '');
        if (checkInRe.test(t)) {
          const oldTitle = t;
          a.title = `Freshen Up at ${hn}`;
          if (a.name) a.name = a.title;
          a.category = 'accommodation';
          repairs.push({ code: FAILURE_CODES.MEAL_DUPLICATE, action: 'relabeled_duplicate_checkin_to_freshen_up', before: oldTitle, after: a.title });
        }
      }
    }
  }

  // --- 8. HOTEL CHECKOUT GUARANTEE (last day, last day in city — NOT hotel change, handled above) ---
  const needsCheckout = !isHotelChange && (isLastDay || (isLastDayInCity && !isTransitionDay));
  if (needsCheckout && activities.length > 0) {
    const hasCheckout = activities.some((a: any) => {
      const t = (a.title || a.name || '').toLowerCase();
      const cat = (a.category || '').toLowerCase();
      return cat === 'accommodation' && (
        t.includes('check-out') || t.includes('check out') || t.includes('checkout')
      );
    });

    if (!hasCheckout) {
      const coHotelName = hotelOverride?.name || hotelName || 'Your Hotel';
      const coHotelAddr = hotelOverride?.address || hotelAddress || '';

      let checkoutStartMin: number;
      const depMins = returnDepartureTime24 ? (parseTimeToMinutes(returnDepartureTime24) ?? null) : null;
      if (isLastDay && depMins !== null) {
        checkoutStartMin = Math.max(7 * 60, depMins - 210);
      } else {
        checkoutStartMin = 11 * 60;
      }

      const checkoutStart = minutesToHHMM(checkoutStartMin);
      const checkoutEnd = minutesToHHMM(checkoutStartMin + 30);

      const checkoutActivity = {
        id: `day${dayNumber}-checkout-repair-${Date.now()}`,
        title: `Checkout from ${coHotelName}`,
        name: `Checkout from ${coHotelName}`,
        description: isLastDay
          ? 'Check out, collect luggage, and prepare for departure.'
          : `Check out from ${coHotelName}. Store luggage if needed before continuing your day.`,
        startTime: checkoutStart,
        endTime: checkoutEnd,
        category: 'accommodation',
        type: 'accommodation',
        location: { name: coHotelName, address: coHotelAddr },
        cost: { amount: 0, currency: 'USD' },
        bookingRequired: false,
        isLocked: false,
        durationMinutes: 30,
        source: 'repair-checkout-guarantee',
      };

      // Insert chronologically
      let insertIdx = activities.length;
      for (let i = 0; i < activities.length; i++) {
        const actStart = parseTimeToMinutes(activities[i].startTime || '') ?? 99999;
        if (checkoutStartMin <= actStart) { insertIdx = i; break; }
      }
      activities.splice(insertIdx, 0, checkoutActivity);
      repairs.push({ code: FAILURE_CODES.MISSING_SLOT, action: 'injected_checkout_guarantee' });
    }
  }

  // --- 8b. DEPARTURE TRANSPORT GUARANTEE ---
  // Ensure every departure day has a transport card to the airport/station.
  const isDepartureDay = isLastDay || (isLastDayInCity && !isTransitionDay);
  if (isDepartureDay && activities.length > 0) {
    const hasDepartureTransport = activities.some((a: any) => {
      const t = (a.title || '').toLowerCase();
      const cat = (a.category || '').toLowerCase();
      return (cat === 'transport' || cat === 'transit' || cat === 'logistics') && (
        t.includes('airport') || t.includes('transfer to') || t.includes('head to') ||
        t.includes('taxi to') || t.includes('station') || t.includes('departure transfer')
      );
    });

    if (!hasDepartureTransport) {
      let transportTitle: string;
      let transportDesc: string;
      let transportStartMin: number;
      let transportDur = 45;

      if (isLastDay && returnDepartureTime24) {
        // Flight departure: time backward from flight
        const depMins = parseTimeToMinutes(returnDepartureTime24);
        const airportName = departureAirport || 'the Airport';
        transportTitle = `Transfer to ${airportName}`;
        transportDesc = `Depart for ${airportName} ahead of your flight.`;
        transportStartMin = depMins !== null ? Math.max(depMins - 180, 7 * 60) : 12 * 60;
      } else if (isLastDayInCity && nextLegTransport && nextLegTransport !== 'flight') {
        // Non-flight inter-city departure (train/bus)
        const stationName = nextLegTransportDetails?.stationName || 'the Station';
        const legDepTime = nextLegTransportDetails?.departureTime;
        transportTitle = `Transfer to ${stationName}`;
        transportDesc = `Head to ${stationName} for your ${nextLegTransport} to the next city.`;
        transportDur = 30;
        if (legDepTime) {
          const legMins = parseTimeToMinutes(legDepTime);
          transportStartMin = legMins !== null ? Math.max(legMins - 60, 7 * 60) : 12 * 60;
        } else {
          transportStartMin = 12 * 60;
        }
      } else {
        // Last day, no flight data — use nextLegTransport if available for correct labeling
        const fallbackMode = nextLegTransport || 'transfer';
        const modeLabel = fallbackMode.charAt(0).toUpperCase() + fallbackMode.slice(1);
        const hubName = fallbackMode === 'flight'
          ? (nextLegTransportDetails?.departureAirport || nextLegTransportDetails?.stationName || 'the Airport')
          : fallbackMode === 'train'
          ? (nextLegTransportDetails?.departureStation || nextLegTransportDetails?.stationName || 'the Station')
          : fallbackMode === 'ferry'
          ? (nextLegTransportDetails?.departureStation || 'the Ferry Terminal')
          : fallbackMode === 'bus'
          ? (nextLegTransportDetails?.departureStation || 'the Bus Station')
          : 'the departure point';
        transportTitle = fallbackMode === 'transfer' ? 'Departure Transfer' : `Transfer to ${hubName}`;
        transportDesc = fallbackMode === 'transfer'
          ? 'Head to the departure point for your onward journey.'
          : `Head to ${hubName} for your ${modeLabel} home.`;
        // Place after checkout
        const checkoutAct = activities.find((a: any) => {
          const t = (a.title || '').toLowerCase();
          return t.includes('checkout') || t.includes('check-out') || t.includes('check out');
        });
        const checkoutEnd = checkoutAct ? (parseTimeToMinutes(checkoutAct.endTime) ?? 11 * 60 + 30) : 11 * 60 + 30;
        transportStartMin = checkoutEnd + 15;
      }

      const transportCard = {
        id: `day${dayNumber}-departure-transport-${Date.now()}`,
        title: transportTitle,
        name: transportTitle,
        description: transportDesc,
        startTime: minutesToHHMM(transportStartMin),
        endTime: minutesToHHMM(transportStartMin + transportDur),
        category: 'transport',
        type: 'transport',
        location: { name: transportTitle.replace('Transfer to ', ''), address: '' },
        cost: { amount: 0, currency: 'USD' },
        bookingRequired: false,
        isLocked: false,
        durationMinutes: transportDur,
        source: 'repair-departure-transport-guarantee',
      };

      // Insert chronologically
      let insertIdx = activities.length;
      for (let i = 0; i < activities.length; i++) {
        const actStart = parseTimeToMinutes(activities[i].startTime || '') ?? 99999;
        if (transportStartMin <= actStart) { insertIdx = i; break; }
      }
      activities.splice(insertIdx, 0, transportCard);
      repairs.push({ code: FAILURE_CODES.MISSING_SLOT, action: 'injected_departure_transport_guarantee', after: transportTitle });
    }

    // Also ensure a flight card exists on the last day — even without explicit flight time
    if (isLastDay) {
      const hasFlightCard = activities.some((a: any) => {
        const t = (a.title || '').toLowerCase();
        const cat = (a.category || '').toLowerCase();
        return cat === 'flight' || t.includes('flight departure') || t.includes('departure flight');
      });

      if (!hasFlightCard) {
        // Find an airport-bound transport card to confirm this is a flight departure
        const airportTransport = activities.find((a: any) => {
          const t = (a.title || '').toLowerCase();
          const cat = (a.category || '').toLowerCase();
          if (cat !== 'transport' && cat !== 'logistics') return false;
          return t.includes('airport') || t.includes('transfer to') && t.includes('airport');
        });

        if (airportTransport || returnDepartureTime24) {
          let depMins: number;
          if (returnDepartureTime24) {
            depMins = parseTimeToMinutes(returnDepartureTime24) ?? 15 * 60;
          } else {
            // Derive from airport transport end time + 2hr buffer for check-in/security
            const transportEnd = parseTimeToMinutes(airportTransport?.endTime || '') ?? null;
            depMins = transportEnd !== null ? transportEnd + 120 : 15 * 60;
          }

          const flightCard = {
            id: `day${dayNumber}-flight-departure-${Date.now()}`,
            title: 'Departure Flight',
            name: 'Departure Flight',
            description: 'Board your flight home.',
            startTime: minutesToHHMM(depMins),
            endTime: minutesToHHMM(depMins + 120),
            category: 'flight',
            type: 'flight',
            location: { name: departureAirport || 'Airport', address: '' },
            cost: { amount: 0, currency: 'USD' },
            bookingRequired: false,
            isLocked: false,
            durationMinutes: 120,
            source: 'repair-flight-guarantee',
          };
          activities.push(flightCard);
          activities.sort((a: any, b: any) => {
            const ta = parseTimeToMinutes(a.startTime || '') ?? 99999;
            const tb = parseTimeToMinutes(b.startTime || '') ?? 99999;
            return ta - tb;
          });
          repairs.push({ code: FAILURE_CODES.MISSING_SLOT, action: 'injected_departure_flight_guarantee' });
        }
      }
    }
  }

  // --- 8c. INTER-CITY JOURNEY CARD ---
  // On inter-city departure days (not last day of trip), inject the actual journey card
  // (e.g., "Flight to Rome", "Train to Kyoto") after the station/airport transfer.
  const nextLegCity = input.nextLegCity;
  if (isLastDayInCity && !isLastDay && nextLegTransport && nextLegCity) {
    const hasJourneyCard = activities.some((a: any) => {
      const t = (a.title || '').toLowerCase();
      const cat = (a.category || '').toLowerCase();
      const cityLower = nextLegCity.toLowerCase();
      return (cat === 'flight' || cat === 'transport' || cat === 'intercity_transport') && (
        t.includes(cityLower) || t.includes('journey to') || t.includes('flight to') || t.includes('train to')
      );
    });

    if (!hasJourneyCard) {
      const modeLabel = nextLegTransport.charAt(0).toUpperCase() + nextLegTransport.slice(1);
      const isFlightMode = nextLegTransport.toLowerCase().includes('flight') || nextLegTransport.toLowerCase().includes('fly');
      const journeyCategory = isFlightMode ? 'flight' : 'intercity_transport';

      // Determine timing
      const defaultDurations: Record<string, number> = { flight: 120, train: 180, bus: 240, ferry: 180 };
      const journeyDuration = nextLegTransportDetails?.duration
        ? parseInt(nextLegTransportDetails.duration, 10) || defaultDurations[nextLegTransport] || 120
        : defaultDurations[nextLegTransport] || 120;

      let journeyStartMins: number;
      if (nextLegTransportDetails?.departureTime) {
        journeyStartMins = parseTimeToMinutes(nextLegTransportDetails.departureTime) ?? 13 * 60;
      } else {
        // Place after the last transport/transfer card
        const lastTransfer = [...activities].reverse().find((a: any) => {
          const cat = (a.category || '').toLowerCase();
          const t = (a.title || '').toLowerCase();
          return (cat === 'transport' || cat === 'logistics') && (
            t.includes('transfer') || t.includes('station') || t.includes('airport')
          );
        });
        const transferEnd = lastTransfer ? (parseTimeToMinutes(lastTransfer.endTime || '') ?? 13 * 60) : 13 * 60;
        journeyStartMins = transferEnd + 30; // 30 min buffer for boarding
      }

      const journeyEndMins = journeyStartMins + journeyDuration;
      const hubName = isFlightMode
        ? (nextLegTransportDetails?.departureAirport || nextLegTransportDetails?.stationName || 'Airport')
        : (nextLegTransportDetails?.departureStation || nextLegTransportDetails?.stationName || 'Station');

      const journeyCard = {
        id: `day${dayNumber}-journey-${nextLegTransport}-${Date.now()}`,
        title: `${modeLabel} to ${nextLegCity}`,
        name: `${modeLabel} to ${nextLegCity}`,
        description: `${modeLabel} from ${hubName} to ${nextLegCity}.${nextLegTransportDetails?.carrier ? ` ${nextLegTransportDetails.carrier}` : ''}`,
        startTime: minutesToHHMM(journeyStartMins),
        endTime: minutesToHHMM(journeyEndMins),
        category: journeyCategory,
        type: journeyCategory,
        location: { name: hubName, address: '' },
        cost: { amount: 0, currency: 'USD' },
        bookingRequired: false,
        isLocked: false,
        durationMinutes: journeyDuration,
        source: 'repair-intercity-journey',
        travelMeta: {
          from: resolvedDestination || '',
          to: nextLegCity,
          transportName: modeLabel,
          hubLabel: hubName,
          carrier: nextLegTransportDetails?.carrier,
          depTime: minutesToHHMM(journeyStartMins),
          arrTime: minutesToHHMM(journeyEndMins),
          dur: `${Math.floor(journeyDuration / 60)}h${journeyDuration % 60 > 0 ? ` ${journeyDuration % 60}m` : ''}`,
        },
      };

      // Insert chronologically
      let insertIdx = activities.length;
      for (let i = 0; i < activities.length; i++) {
        const actStart = parseTimeToMinutes(activities[i].startTime || '') ?? 99999;
        if (journeyStartMins <= actStart) { insertIdx = i; break; }
      }
      activities.splice(insertIdx, 0, journeyCard);
      repairs.push({ code: FAILURE_CODES.MISSING_SLOT, action: 'injected_intercity_journey', after: journeyCard.title });
      console.log(`[Repair] Injected inter-city journey: "${journeyCard.title}" (${journeyCard.startTime}-${journeyCard.endTime})`);
    }
  }

  // --- 9. MISSING_SLOT: bookend validator (with departure-day guards) ---
  // Always inject hotel bookends — use placeholder if no hotel selected yet.
  // "Your Hotel" placeholders get patched with real names via patchItineraryWithHotel.
  if (activities.length > 0) {
    const effectiveHotelName = hotelName || 'Your Hotel';
    const bookendRepairs = repairBookends(activities, effectiveHotelName, dayNumber, isDepartureDay, isFirstDay, isHotelChange, hotelCoordinates, resolvedDestination);
    activities = bookendRepairs.activities;
    repairs.push(...bookendRepairs.repairs);
  }

  // --- 9b. ACCOMMODATION TITLE NORMALIZATION ---
  // Standardize all accommodation activity titles to canonical format after all sources
  // (AI, repair step 7/8, bookends) have contributed.
  // On hotel-change days, activities BEFORE the checkout use previousHotelName,
  // activities AFTER use hotelName (the new hotel).
  {
    const hn = hotelName || 'Your Hotel';
    const prevHn = previousHotelName || 'Your Hotel';

    // Find checkout index to determine pre/post boundary on hotel-change days
    const checkoutIdx = isHotelChange
      ? activities.findIndex((a: any) => {
          const t = (a.title || a.name || '').toLowerCase();
          const cat = (a.category || '').toLowerCase();
          return cat === 'accommodation' &&
            (t.includes('checkout') || t.includes('check-out') || t.includes('check out'));
        })
      : -1;

    for (let i = 0; i < activities.length; i++) {
      const act = activities[i];
      const cat = (act.category || '').toLowerCase();
      if (cat !== 'accommodation') continue;

      // Resolve which hotel name to use based on position relative to checkout
      const resolvedHn = (isHotelChange && checkoutIdx >= 0 && i < checkoutIdx)
        ? prevHn
        : hn;

      const t = (act.title || act.name || '').toLowerCase();
      let canonical: string | null = null;

      if (t.includes('checkout') || t.includes('check-out') || t.includes('check out')) {
        // Checkout always uses previous hotel name on hotel-change days
        if (isHotelChange && previousHotelName) {
          canonical = `Checkout from ${previousHotelName}`;
        } else {
          canonical = `Checkout from ${hn}`;
        }
      } else if (t.includes('freshen up') || t.includes('freshen-up')) {
        canonical = `Freshen Up at ${resolvedHn}`;
      } else if (t.includes('return to') || t.includes('back to')) {
        canonical = `Return to ${resolvedHn}`;
      } else if (t.includes('luggage drop') || t.includes('drop bags')) {
        canonical = `Luggage Drop at ${resolvedHn}`;
      } else if (t.includes('check-in') || t.includes('check in') || t.includes('checkin') || t.includes('settle in') || t.includes('hotel')) {
        canonical = `Check-in at ${resolvedHn}`;
      }

      if (canonical) {
        const before = act.title;
        const titleChanged = act.title !== canonical;
        if (titleChanged) {
          act.title = canonical;
          act.name = canonical;
        }

        // Resolve the correct address for this accommodation card
        const resolvedAddr = (isHotelChange && checkoutIdx >= 0 && i <= checkoutIdx)
          ? (input.previousHotelAddress || '')
          : (hotelAddress || '');

        // Always ensure location references the resolved hotel name and address
        const locNeedsUpdate = !act.location?.name || act.location.name === 'Your Hotel' ||
          (resolvedAddr && act.location?.address !== resolvedAddr);
        if (locNeedsUpdate) {
          const oldAddr = act.location?.address || '';
          act.location = { name: resolvedHn, address: resolvedAddr || act.location?.address || '' };
          if (resolvedAddr && oldAddr !== resolvedAddr) {
            console.log(`[Repair] HOTEL ADDRESS NORM: "${canonical}" address "${oldAddr}" → "${resolvedAddr}"`);
          }
        }

        if (titleChanged || locNeedsUpdate) {
          repairs.push({
            code: FAILURE_CODES.MISSING_SLOT,
            action: 'normalized_accommodation_title',
            before,
            after: canonical,
          });
        }
      }
    }
  }

  // --- 9b-ii. DINING HOTEL REFERENCE on hotel-change days ---
  // Breakfast (and other dining) before checkout should reference the previous hotel,
  // not the new hotel the traveler hasn't arrived at yet.
  const diningCheckoutIdx = isHotelChange
    ? activities.findIndex((a: any) => {
        const t = (a.title || a.name || '').toLowerCase();
        const c = (a.category || '').toLowerCase();
        return c === 'accommodation' &&
          (t.includes('checkout') || t.includes('check-out') || t.includes('check out'));
      })
    : -1;
  if (isHotelChange && diningCheckoutIdx >= 0 && previousHotelName) {
    const newHotelLower = (hotelName || '').toLowerCase();
    const newHotelCore = normalizeHotelCore(hotelName || '');
    const newHotelAddrLower = (hotelAddress || '').toLowerCase();
    const prevHotelAddr = input.previousHotelAddress || '';

    // Helper to escape special regex characters
    const escRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    for (let i = 0; i < diningCheckoutIdx; i++) {
      const act = activities[i];
      const cat = (act.category || '').toLowerCase();
      const titleForMealCheck = (act.title || act.name || '').toLowerCase();
      // Expanded detection: catch dining/restaurant/food/meal categories AND title-based meal detection
      const isDiningActivity = cat === 'dining' || cat === 'restaurant' || cat === 'food' || cat === 'meal'
        || /\b(?:breakfast|brunch)\b/i.test(titleForMealCheck);
      if (!isDiningActivity) continue;

      const title = act.title || act.name || '';
      const titleLower = title.toLowerCase();

      // Check if this dining activity references the NEW hotel (wrong)
      const refsNewHotel = (newHotelLower && titleLower.includes(newHotelLower)) ||
        (newHotelCore && newHotelCore.length >= 3 && titleLower.includes(newHotelCore));
      // Or references any generic hotel
      const refsGenericHotel = titleLower.includes('your hotel') ||
        titleLower.includes('the hotel');
      // Check location name/address for new hotel references
      const locName = (act.location?.name || '').toLowerCase();
      const locAddr = (act.location?.address || '').toLowerCase();
      const locRefsNewHotel = (newHotelLower && (locName.includes(newHotelLower) || locAddr.includes(newHotelLower))) ||
        (newHotelCore && newHotelCore.length >= 3 && (locName.includes(newHotelCore) || locAddr.includes(newHotelCore))) ||
        (newHotelAddrLower && newHotelAddrLower.length > 5 && locAddr === newHotelAddrLower);

      if (refsNewHotel || refsGenericHotel || locRefsNewHotel) {
        let newTitle = title;
        if (refsNewHotel && hotelName) {
          newTitle = title.replace(new RegExp(escRegExp(hotelName), 'gi'), previousHotelName);
        } else if (refsGenericHotel) {
          newTitle = title.replace(/your hotel|the hotel/gi, previousHotelName);
        }
        act.title = newTitle;
        act.name = newTitle;

        // Fix location — use actual previous hotel address when available
        if (act.location?.name) {
          const ln = act.location.name.toLowerCase();
          if ((newHotelLower && ln.includes(newHotelLower)) ||
              (newHotelCore && newHotelCore.length >= 3 && ln.includes(newHotelCore)) ||
              ln === 'your hotel' || ln === 'the hotel') {
            act.location.name = previousHotelName;
          }
        }
        // Use real previous hotel address instead of falling back to name
        if (act.location?.address) {
          const addrLower = (act.location.address || '').toLowerCase();
          if ((newHotelAddrLower && addrLower === newHotelAddrLower) ||
              (newHotelLower && addrLower.includes(newHotelLower))) {
            act.location.address = prevHotelAddr || previousHotelName;
          }
        } else if (prevHotelAddr) {
          // No address set — fill with previous hotel address
          if (!act.location) act.location = { name: previousHotelName, address: prevHotelAddr };
          else act.location.address = prevHotelAddr;
        }

        repairs.push({
          code: FAILURE_CODES.MISSING_SLOT,
          action: 'fixed_pre_checkout_dining_hotel_ref',
          before: title,
          after: newTitle,
        });
      }
    }
  }

  // --- 9c. BACK-TO-BACK ACCOMMODATION DEDUP ---
  // After bookends + normalization, scan for consecutive accommodation cards
  // (ignoring transport between them). If two non-check-in/checkout accom cards
  // are back-to-back, keep the last one (typically "Return to Hotel") and remove
  // the earlier one plus its preceding transport.
  // Also: remove "Freshen Up" if the next real activity is at the same hotel/location
  // (e.g., hotel spa) — the freshen-up is redundant when you're staying on-site.
  {
    const isNonStructuralAccom = (act: any): boolean => {
      const cat = (act.category || '').toLowerCase();
      if (cat !== 'accommodation') return false;
      const t = (act.title || '').toLowerCase();
      // Keep check-in and checkout — those are structural
      if (t.includes('check-in') || t.includes('checkin') || t.includes('check in')) return false;
      if (t.includes('checkout') || t.includes('check-out') || t.includes('check out')) return false;
      if (t.includes('luggage drop') || t.includes('drop bags')) return false;
      return true;
    };

    const isFreshenUp = (act: any): boolean => {
      const t = (act.title || '').toLowerCase();
      return t.includes('freshen up') || t.includes('freshen-up');
    };

    const getLocationName = (act: any): string => {
      const loc = act.location;
      const name = (loc?.name || loc?.address || '').toLowerCase().trim();
      return name;
    };

    const isTransportCat = (act: any): boolean => {
      const cat = (act.category || '').toLowerCase();
      return cat === 'transport' || cat === 'transportation';
    };

    const indicesToRemove = new Set<number>();

    // Part A: Back-to-back accommodation dedup (original logic)
    const accomIndices: number[] = [];
    for (let i = 0; i < activities.length; i++) {
      if (isNonStructuralAccom(activities[i])) accomIndices.push(i);
    }

    for (let k = 0; k < accomIndices.length - 1; k++) {
      const idxA = accomIndices[k];
      const idxB = accomIndices[k + 1];
      let onlyTransportBetween = true;
      for (let m = idxA + 1; m < idxB; m++) {
        if (!isTransportCat(activities[m])) {
          onlyTransportBetween = false;
          break;
        }
      }
      if (!onlyTransportBetween) continue;

      indicesToRemove.add(idxA);
      if (idxA > 0 && isTransportCat(activities[idxA - 1])) {
        indicesToRemove.add(idxA - 1);
      }
      for (let m = idxA + 1; m < idxB; m++) {
        indicesToRemove.add(m);
      }

      repairs.push({
        code: FAILURE_CODES.MISSING_SLOT,
        action: 'dedup_back_to_back_accommodation',
        before: activities[idxA].title,
        after: activities[idxB].title,
      });
    }

    // Part B: "Freshen Up" before same-location activity is redundant
    // e.g., "Freshen Up at Four Seasons" → "Wellness at Four Seasons Spa"
    for (let i = 0; i < activities.length; i++) {
      if (indicesToRemove.has(i)) continue;
      if (!isNonStructuralAccom(activities[i]) || !isFreshenUp(activities[i])) continue;

      // Find next real (non-transport) activity
      let nextRealIdx = -1;
      for (let j = i + 1; j < activities.length; j++) {
        if (indicesToRemove.has(j)) continue;
        if (!isTransportCat(activities[j])) {
          nextRealIdx = j;
          break;
        }
      }
      if (nextRealIdx < 0) continue;

      const nextAct = activities[nextRealIdx];
      // Skip if next activity is also accommodation (handled by Part A)
      if (isNonStructuralAccom(nextAct)) continue;

      // Check if both are at the same hotel/location
      const freshenLoc = getLocationName(activities[i]);
      const nextLoc = getLocationName(nextAct);
      const freshenTitle = (activities[i].title || '').toLowerCase();
      const nextTitle = (nextAct.title || '').toLowerCase();

      // Extract hotel name from freshen-up title (e.g., "Freshen Up at Four Seasons Ritz")
      const hotelNameMatch = freshenTitle.match(/freshen\s*up\s+(?:at\s+)?(.+)/i);
      const hotelName = hotelNameMatch ? hotelNameMatch[1].trim().toLowerCase() : '';

      let sameLocation = false;
      if (freshenLoc && nextLoc && (freshenLoc.includes(nextLoc) || nextLoc.includes(freshenLoc))) {
        sameLocation = true;
      }
      // Also check if the next activity title/location references the same hotel
      if (hotelName && (nextTitle.includes(hotelName) || nextLoc.includes(hotelName))) {
        sameLocation = true;
      }
      // Check if next activity location contains the hotel name from freshen-up location
      if (freshenLoc && nextLoc) {
        // Extract meaningful words (3+ chars) from hotel location
        const hotelWords = freshenLoc.split(/\s+/).filter(w => w.length >= 3);
        const matchCount = hotelWords.filter(w => nextLoc.includes(w) || nextTitle.includes(w)).length;
        if (hotelWords.length > 0 && matchCount >= Math.ceil(hotelWords.length * 0.5)) {
          sameLocation = true;
        }
      }

      if (sameLocation) {
        indicesToRemove.add(i);
        // Remove transport leading to the freshen-up
        if (i > 0 && isTransportCat(activities[i - 1]) && !indicesToRemove.has(i - 1)) {
          indicesToRemove.add(i - 1);
        }
        // Remove transport between freshen-up and next activity (they're at same place)
        for (let m = i + 1; m < nextRealIdx; m++) {
          if (isTransportCat(activities[m])) {
            indicesToRemove.add(m);
          }
        }
        repairs.push({
          code: FAILURE_CODES.MISSING_SLOT,
          action: 'dedup_freshen_up_before_same_location',
          before: activities[i].title,
          after: nextAct.title,
        });
      }
    }

    if (indicesToRemove.size > 0) {
      activities = activities.filter((_, i) => !indicesToRemove.has(i));

      // --- 9d. POST-DEDUP TRANSIT GAP PASS ---
      // After accommodation dedup removed cards + their adjacent transports,
      // scan for adjacent non-transport activities at different locations and
      // inject a lightweight transport card to prevent "teleportation".
      const isTransportCat2 = (a: any) => (a.category || '').toLowerCase() === 'transport';
      const postDedup: any[] = [];
      for (let i = 0; i < activities.length; i++) {
        postDedup.push(activities[i]);
        if (i >= activities.length - 1) continue;
        const curr = activities[i], next = activities[i + 1];
        if (isTransportCat2(curr) || isTransportCat2(next)) continue;
        const cLoc = (curr.location?.name || '').toLowerCase();
        const nLoc = (next.location?.name || '').toLowerCase();
        if (!cLoc || !nLoc) continue;
        if (isSameOrContainedLocation(cLoc, nLoc, hotelName)) continue;
        // Inject a simple transport card
        const st = curr.endTime || next.startTime || '12:00';
        const fromCoords = curr.coordinates || curr.location?.coordinates || null;
        const toCoords = next.coordinates || next.location?.coordinates || null;
        let dur = 15, costAmt = 5, method = 'taxi';
        if (fromCoords?.lat && toCoords?.lat) {
          const dist = haversineDistanceKm(fromCoords.lat, fromCoords.lng, toCoords.lat, toCoords.lng);
          dur = Math.max(10, Math.min(45, Math.round(dist * 3)));
          costAmt = Math.round(dist * 2);
        }
        const endMin = (parseInt(st.split(':')[0]) || 0) * 60 + (parseInt(st.split(':')[1]) || 0) + dur;
        const et = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
        postDedup.push({
          id: `transport-postdedup-${i}-${Date.now()}`,
          title: `Travel to ${next.location?.name || sanitizeTransitDestination(next.title || '') || 'next venue'}`,
          description: `From ${curr.location?.name || curr.title || 'previous venue'} to ${next.location?.name || sanitizeTransitDestination(next.title || '') || 'next venue'}`,
          category: 'transport',
          startTime: st,
          endTime: et,
          durationMinutes: dur,
          location: { name: next.location?.name || sanitizeTransitDestination(next.title || '') || 'destination', address: next.location?.address || '' },
          fromLocation: { name: curr.location?.name || curr.title || 'origin', address: curr.location?.address || '' },
          cost: { amount: costAmt, currency: 'USD' },
          transportation: { method, duration: `${dur} min` },
        });
        repairs.push({ code: FAILURE_CODES.MISSING_SLOT, action: 'injected_post_dedup_transit_gap' });
      }
      activities = postDedup;
    }
  }

  // --- 10. TITLE_LABEL_LEAK ---
  if (byCode.has(FAILURE_CODES.TITLE_LABEL_LEAK)) {
    for (const vr of byCode.get(FAILURE_CODES.TITLE_LABEL_LEAK) || []) {
      if (vr.activityIndex === undefined) continue;
      const act = activities[vr.activityIndex];
      if (!act) continue;
      const before = act.title;
      act.title = act.title
        .replace(/\s*[-–—]?\s*(voyance pick|staff pick|editor'?s? pick|ai pick|top pick|our pick)\s*/gi, '')
        .trim();
      if (act.title !== before) {
        repairs.push({
          code: FAILURE_CODES.TITLE_LABEL_LEAK,
          activityIndex: vr.activityIndex,
          action: 'stripped_label_leak',
          before,
          after: act.title,
        });
      }
    }
  }

  // --- 11. DEPARTURE SEQUENCE FIX (checkout after airport/station swap) ---
  if (isDepartureDay && activities.length > 1) {
    const checkoutIdx = activities.findIndex((a: any) => {
      const t = (a.title || '').toLowerCase();
      return t.includes('checkout') || t.includes('check-out') || t.includes('check out');
    });
    const transportIdx = activities.findIndex((a: any) => {
      const t = (a.title || '').toLowerCase();
      return (t.includes('airport') || t.includes('departure transfer') || t.includes('transfer to') || t.includes('station')) &&
             ((a.category || '').toLowerCase() === 'transport' || t.includes('transfer'));
    });

    if (checkoutIdx !== -1 && transportIdx !== -1 && checkoutIdx > transportIdx) {
      const checkoutAct = activities[checkoutIdx];
      const transportAct = activities[transportIdx];

      const checkoutDur = Math.max(5, ((parseTimeToMinutes(checkoutAct.endTime) ?? 0) - (parseTimeToMinutes(checkoutAct.startTime) ?? 0))) || 15;
      const transferDur = Math.max(10, ((parseTimeToMinutes(transportAct.endTime) ?? 0) - (parseTimeToMinutes(transportAct.startTime) ?? 0))) || 60;

      checkoutAct.startTime = transportAct.startTime;
      checkoutAct.endTime = addMinutesToHHMM(checkoutAct.startTime, checkoutDur);
      transportAct.startTime = checkoutAct.endTime;
      transportAct.endTime = addMinutesToHHMM(transportAct.startTime, transferDur);

      activities[transportIdx] = checkoutAct;
      activities[checkoutIdx] = transportAct;
      activities.sort((a: any, b: any) => {
        const ta = parseTimeToMinutes(a.startTime || '') ?? 99999;
        const tb = parseTimeToMinutes(b.startTime || '') ?? 99999;
        return ta - tb;
      });
      repairs.push({ code: FAILURE_CODES.LOGISTICS_SEQUENCE, action: 'swapped_checkout_before_departure_transport' });
    }
  }


  // --- 12. NON-FLIGHT DEPARTURE: strip airport activities ---
  if (isLastDayInCity && !isLastDay && nextLegTransport && nextLegTransport !== 'flight') {
    const beforeCount = activities.length;
    activities = activities.filter((a: any) => {
      const t = (a.title || '').toLowerCase();
      const isAirportRef =
        t.includes('airport') || t.includes('taxi to airport') ||
        t.includes('transfer to airport') || t.includes('departure transfer to airport') ||
        t.includes('flight departure') || t.includes('head to airport');
      return !isAirportRef || lockedIds.has(a.id);
    });
    const removed = beforeCount - activities.length;
    if (removed > 0) {
      repairs.push({ code: FAILURE_CODES.LOGISTICS_SEQUENCE, action: `stripped_${removed}_airport_refs_non_flight_leg` });
    }
  }

  // --- 13. TIME_OVERLAP CASCADE (final pass — catches overlaps from all prior injections) ---
  {
    activities.sort((a: any, b: any) => {
      const ta = parseTimeToMinutes(a.startTime || '') ?? 99999;
      const tb = parseTimeToMinutes(b.startTime || '') ?? 99999;
      return ta - tb;
    });

    const STRUCTURAL_CATS = ['accommodation', 'transport', 'logistics'];
    const STRUCTURAL_KW = ['checkout', 'check-out', 'check out', 'departure', 'airport', 'flight'];

    const isStructural = (act: any) => {
      const cat = (act.category || '').toLowerCase();
      const title = (act.title || '').toLowerCase();
      return STRUCTURAL_CATS.includes(cat) ||
        STRUCTURAL_KW.some(kw => title.includes(kw)) ||
        lockedIds.has(act.id);
    };

    for (let i = 0; i < activities.length - 1; i++) {
      const prev = activities[i];
      const curr = activities[i + 1];
      const prevEnd = parseTimeToMinutes(prev.endTime || '');
      const currStart = parseTimeToMinutes(curr.startTime || '');
      if (prevEnd === null || currStart === null || currStart >= prevEnd) continue;

      const overlapMins = prevEnd - currStart;

      if (isStructural(curr)) {
        // Truncate prev to end before structural activity — but enforce minimum duration
        const oldEnd = prev.endTime;
        const prevStartMins = parseTimeToMinutes(prev.startTime || '');
        const newEndMins = currStart;
        const newDuration = prevStartMins !== null ? newEndMins - prevStartMins : 999;

        // Category-based minimum durations (minutes)
        const prevCat = (prev.category || '').toLowerCase();
        const minDur = prevCat === 'dining' || prevCat === 'food' || prevCat === 'restaurant' ? 60
          : ['activity', 'sightseeing', 'cultural', 'entertainment'].includes(prevCat) ? 30
          : 15;

        if (newDuration < minDur && prevStartMins !== null) {
          // Try shifting prev earlier to preserve minimum duration
          const idealStart = newEndMins - minDur;
          const prevPrev = i > 0 ? activities[i - 1] : null;
          const prevPrevEnd = prevPrev ? parseTimeToMinutes(prevPrev.endTime || '') : null;
          const floor = prevPrevEnd !== null ? prevPrevEnd : 0;

          if (idealStart >= floor) {
            // Shift activity start earlier to preserve minimum duration
            prev.startTime = minutesToHHMM(idealStart);
            prev.endTime = minutesToHHMM(newEndMins);
            repairs.push({
              code: FAILURE_CODES.TIME_OVERLAP,
              activityIndex: i,
              action: 'shifted_earlier_for_min_duration',
              before: `${prev.title} ${minutesToHHMM(prevStartMins)}-${oldEnd} (would be ${newDuration}min)`,
              after: `${prev.title} ${prev.startTime}-${prev.endTime} (preserved ${minDur}min min)`,
            });
          } else {
            // Can't shift earlier — push structural card (and all subsequent) forward
            const shiftAmount = minDur - newDuration;
            for (let j = i + 1; j < activities.length; j++) {
              const s = parseTimeToMinutes(activities[j].startTime || '');
              const e = parseTimeToMinutes(activities[j].endTime || '');
              if (s !== null) activities[j].startTime = minutesToHHMM(s + shiftAmount);
              if (e !== null) activities[j].endTime = minutesToHHMM(e + shiftAmount);
            }
            prev.endTime = minutesToHHMM(prevStartMins + minDur);
            repairs.push({
              code: FAILURE_CODES.TIME_OVERLAP,
              activityIndex: i,
              action: 'shifted_structural_for_min_duration',
              before: `${prev.title} would be ${newDuration}min, structural ${curr.title} at ${minutesToHHMM(currStart)}`,
              after: `${prev.title} ${prev.startTime}-${prev.endTime}, structural shifted +${shiftAmount}min`,
            });
          }
        } else {
          // Duration is acceptable — simple truncation
          prev.endTime = minutesToHHMM(currStart);
          repairs.push({
            code: FAILURE_CODES.TIME_OVERLAP,
            activityIndex: i,
            action: 'truncated_before_structural',
            before: `${prev.title} end ${oldEnd}`,
            after: `${prev.title} end ${prev.endTime}`,
          });
        }
      } else {
        // Shift curr (and all subsequent) forward
        for (let j = i + 1; j < activities.length; j++) {
          const s = parseTimeToMinutes(activities[j].startTime || '');
          const e = parseTimeToMinutes(activities[j].endTime || '');
          if (s !== null) activities[j].startTime = minutesToHHMM(s + overlapMins);
          if (e !== null) activities[j].endTime = minutesToHHMM(e + overlapMins);
        }
        repairs.push({
          code: FAILURE_CODES.TIME_OVERLAP,
          activityIndex: i + 1,
          action: 'shifted_forward',
          before: `${curr.title} start ${minutesToHHMM(currStart)}`,
          after: `${curr.title} start ${minutesToHHMM(currStart + overlapMins)}`,
        });
      }
    }

    // Drop activities pushed past 23:30
    const cutoff = 23 * 60 + 30;
    activities = activities.filter((act: any) => {
      const s = parseTimeToMinutes(act.startTime || '');
      if (s !== null && s > cutoff) {
        const cat = (act.category || '').toLowerCase();
        const title = (act.title || '').toLowerCase();
        // Exempt end-of-day structural bookend cards (hotel returns)
        if (cat === 'accommodation' && (title.includes('return to') || title.includes('freshen up') || title.includes('check-in') || title.includes('check in'))) {
          return true;
        }
        if ((cat === 'transport' || cat === 'transportation') && (title.includes('hotel') || (act.location?.name || '').toLowerCase().includes('hotel'))) {
          return true;
        }
        repairs.push({
          code: FAILURE_CODES.TIME_OVERLAP,
          action: 'dropped_past_midnight',
          before: act.title,
        });
        return false;
      }
      return true;
    });
  }

  // --- 13b. MINIMUM DURATION ENFORCEMENT ---
  // Ensure dining activities are ≥60min, activities/sightseeing ≥30min, others ≥15min
  for (let i = 0; i < activities.length; i++) {
    const act = activities[i];
    const cat = (act.category || '').toLowerCase();
    const startMins = parseTimeToMinutes(act.startTime || '');
    const endMins = parseTimeToMinutes(act.endTime || '');
    if (startMins === null || endMins === null) continue;
    const duration = endMins - startMins;
    if (duration <= 0) continue;

    const minDur = (cat === 'dining' || cat === 'food' || cat === 'restaurant') ? 60
      : ['activity', 'sightseeing', 'cultural', 'entertainment'].includes(cat) ? 30
      : 0;

    if (minDur > 0 && duration < minDur && !lockedIds.has(act.id)) {
      act.endTime = minutesToHHMM(startMins + minDur);
      act.durationMinutes = minDur;
      repairs.push({
        code: FAILURE_CODES.TIME_OVERLAP,
        activityIndex: i,
        action: 'enforced_minimum_duration',
        before: `${act.title} was ${duration}min`,
        after: `${act.title} now ${minDur}min`,
      });
    }
  }

  // Re-run overlap cascade after duration extensions
  for (let i = 0; i < activities.length - 1; i++) {
    const curr = activities[i];
    const next = activities[i + 1];
    const currEnd = parseTimeToMinutes(curr.endTime || '');
    const nextStart = parseTimeToMinutes(next.startTime || '');
    if (currEnd === null || nextStart === null) continue;
    if (currEnd > nextStart && !lockedIds.has(next.id)) {
      const overlapMins = currEnd - nextStart;
      for (let j = i + 1; j < activities.length; j++) {
        if (lockedIds.has(activities[j].id)) continue;
        const s = parseTimeToMinutes(activities[j].startTime || '');
        const e = parseTimeToMinutes(activities[j].endTime || '');
        if (s !== null) activities[j].startTime = minutesToHHMM(s + overlapMins);
        if (e !== null) activities[j].endTime = minutesToHHMM(e + overlapMins);
      }
    }
  }

  // Drop activities pushed past 23:30 after duration enforcement
  {
    const cutoff2 = 23 * 60 + 30;
    activities = activities.filter((act: any) => {
      const s = parseTimeToMinutes(act.startTime || '');
      if (s !== null && s > cutoff2) {
        const cat = (act.category || '').toLowerCase();
        const title = (act.title || '').toLowerCase();
        // Exempt end-of-day structural bookend cards (hotel returns)
        if (cat === 'accommodation' && (title.includes('return to') || title.includes('freshen up') || title.includes('check-in') || title.includes('check in'))) {
          return true;
        }
        if ((cat === 'transport' || cat === 'transportation') && (title.includes('hotel') || (act.location?.name || '').toLowerCase().includes('hotel'))) {
          return true;
        }
        repairs.push({ code: FAILURE_CODES.TIME_OVERLAP, action: 'dropped_past_midnight_post_duration', before: act.title });
        return false;
      }
      return true;
    });
  }

  // --- 13c. GAP CLOSURE ---
  // Detect and close large unexplained gaps between consecutive activities.
  // Shifts later activities earlier so no gap exceeds the threshold.
  {
    for (let i = 0; i < activities.length - 1; i++) {
      const curr = activities[i];
      const next = activities[i + 1];

      // Skip transport cards — they're connectors, not real gaps
      const currCat = (curr.category || '').toLowerCase();
      const nextCat = (next.category || '').toLowerCase();
      if (currCat === 'transport' || currCat === 'transit' || currCat === 'logistics') continue;
      if (nextCat === 'transport' || nextCat === 'transit' || nextCat === 'logistics') continue;

      // Don't shift locked activities
      if (lockedIds.has(next.id)) continue;

      const currEnd = parseTimeToMinutes(curr.endTime || '');
      const nextStart = parseTimeToMinutes(next.startTime || '');
      if (!currEnd || !nextStart) continue;

      const gap = nextStart - currEnd;

      // Max acceptable gap based on context
      const maxGap = currCat === 'accommodation' ? 45 : 60;

      if (gap > maxGap) {
        const shift = gap - maxGap;
        // Shift next and all subsequent activities earlier
        for (let j = i + 1; j < activities.length; j++) {
          const s = parseTimeToMinutes(activities[j].startTime || '');
          const e = parseTimeToMinutes(activities[j].endTime || '');
          if (s) activities[j].startTime = minutesToHHMM(s - shift);
          if (e) activities[j].endTime = minutesToHHMM(e - shift);
        }
        repairs.push({
          code: FAILURE_CODES.TIME_OVERLAP,
          activityIndex: i + 1,
          action: 'closed_excessive_gap',
          before: `${gap}min gap between "${curr.title}" and "${next.title}"`,
          after: `Closed to ${maxGap}min, shifted ${next.title} and subsequent -${shift}min`,
        });
      }
    }
  }

  // --- 14. DEPARTURE DAY: prune activities after the last departure card ---
  // The flight/departure-transport card must be the final item on departure days.
  if (isDepartureDay && activities.length > 1) {
    const DEPARTURE_ROLES = new Set(['flight', 'airport-transport', 'airport-security']);
    const classifyDep = (a: any): string => {
      const t = (a.title || '').toLowerCase();
      const cat = (a.category || '').toLowerCase();
      if (cat === 'flight' || t.includes('flight departure') || t.includes('departure flight')) return 'flight';
      if (t.includes('airport departure') || t.includes('airport security') || t.includes('security and boarding') ||
          t.includes('departure and security')) return 'airport-security';
      if ((cat === 'transport' || cat === 'transit' || cat === 'logistics') &&
          (t.includes('airport') || t.includes('transfer to the airport') || t.includes('departure transfer') ||
           t.includes('head to airport') || t.includes('taxi to airport') ||
           t.includes('transfer to') && (t.includes('airport') || t.includes('station') || t.includes('terminal')))) return 'airport-transport';
      // Also catch generic departure cards on last day
      if ((cat === 'transport' || cat === 'transit') &&
          (t.includes('departure') || t.includes('heading home'))) return 'airport-transport';
      return 'other';
    };

    // Find the index of the last departure-related card
    let lastDepartureIdx = -1;
    for (let i = activities.length - 1; i >= 0; i--) {
      if (DEPARTURE_ROLES.has(classifyDep(activities[i]))) {
        lastDepartureIdx = i;
        break;
      }
    }

    if (lastDepartureIdx !== -1 && lastDepartureIdx < activities.length - 1) {
      // There are activities after the last departure card — remove them
      const trailing = activities.slice(lastDepartureIdx + 1);
      const toRemove = trailing.filter(a => {
        const role = classifyDep(a);
        return !DEPARTURE_ROLES.has(role) && !lockedIds.has(a.id);
      });

      for (const act of toRemove) {
        const idx = activities.indexOf(act);
        if (idx !== -1) {
          activities.splice(idx, 1);
          repairs.push({
            code: FAILURE_CODES.LOGISTICS_SEQUENCE,
            action: 'pruned_after_departure_card',
            before: act.title,
          });
        }
      }
    }
  }

  return {
    day: { ...input.day, activities },
    repairs,
  };
}

// =============================================================================
// DEPARTURE SEQUENCE REPAIR
// =============================================================================

function repairDepartureSequence(
  activities: any[],
  depFlight24: string | undefined,
  hotelName: string | undefined,
  lockedIds: Set<string>
): RepairAction[] {
  const repairs: RepairAction[] = [];

  type DvRole = 'breakfast' | 'checkout' | 'airport-transport' | 'airport-security' | 'flight' | 'other';
  const classify = (a: any): DvRole => {
    const t = (a.title || '').toLowerCase();
    const cat = (a.category || '').toLowerCase();

    if (cat === 'flight' || t.includes('flight departure') || t.includes('departure flight')) return 'flight';
    if (t.includes('airport departure') || t.includes('airport security') || t.includes('security and boarding') ||
        t.includes('check-in at airport') || t.includes('departure and security')) return 'airport-security';
    if ((cat === 'transport' || cat === 'transit') &&
        (t.includes('airport') || t.includes('head to airport') || t.includes('taxi to airport'))) return 'airport-transport';
    if (t.includes('checkout') || t.includes('check-out') || t.includes('check out')) return 'checkout';
    if ((cat === 'dining' || cat === 'restaurant' || cat === 'food') &&
        (t.includes('breakfast') || t.includes('morning meal'))) return 'breakfast';
    return 'other';
  };

  const breakfastItems = activities.filter(a => classify(a) === 'breakfast');
  const checkoutItems = activities.filter(a => classify(a) === 'checkout');
  const flightItems = activities.filter(a => classify(a) === 'flight');
  const securityItems = activities.filter(a => classify(a) === 'airport-security');

  // R1: Move breakfast before checkout
  if (breakfastItems.length > 0 && checkoutItems.length > 0) {
    const bIdx = activities.indexOf(breakfastItems[0]);
    const cIdx = activities.indexOf(checkoutItems[0]);
    if (bIdx > cIdx) {
      const [breakfast] = activities.splice(bIdx, 1);
      const newCIdx = activities.indexOf(checkoutItems[0]);
      activities.splice(newCIdx, 0, breakfast);

      const checkoutStart = parseTimeToMinutes(checkoutItems[0].startTime) ?? 480;
      const breakfastStart = checkoutStart - 60;
      breakfast.startTime = minutesToHHMM(Math.max(breakfastStart, 360));
      breakfast.endTime = minutesToHHMM(Math.max(breakfastStart, 360) + 45);
      checkoutItems[0].startTime = breakfast.endTime;
      checkoutItems[0].endTime = addMinutesToHHMM(breakfast.endTime, 15);

      repairs.push({ code: FAILURE_CODES.LOGISTICS_SEQUENCE, action: 'moved_breakfast_before_checkout' });
    }
  }

  // R4: Remove duplicate airport transports
  const airportTransports = activities.filter(a => classify(a) === 'airport-transport');
  if (airportTransports.length > 1) {
    const toKeep = airportTransports[airportTransports.length - 1];
    for (const item of airportTransports) {
      if (item !== toKeep && !lockedIds.has(item.id)) {
        const idx = activities.indexOf(item);
        if (idx !== -1) {
          activities.splice(idx, 1);
          repairs.push({ code: FAILURE_CODES.LOGISTICS_SEQUENCE, action: 'removed_duplicate_airport_transport', before: item.title });
        }
      }
    }
  }

  // Remove nonsensical walk-to-airport
  for (let i = activities.length - 1; i >= 0; i--) {
    const a = activities[i];
    const t = (a.title || '').toLowerCase();
    const cat = (a.category || '').toLowerCase();
    if ((cat === 'transport' || cat === 'transit') && t.includes('walk') &&
        (t.includes('airport') || (a.location?.name || '').toLowerCase().includes('airport'))) {
      const dur = a.durationMinutes || 0;
      if ((dur <= 15 || t.includes('walk to')) && !lockedIds.has(a.id)) {
        activities.splice(i, 1);
        repairs.push({ code: FAILURE_CODES.LOGISTICS_SEQUENCE, action: 'removed_walk_to_airport', before: a.title });
      }
    }
  }

  // R2: Move security before flight
  if (securityItems.length > 0 && flightItems.length > 0) {
    const secAct = securityItems[0];
    const flightAct = flightItems[0];
    const secIdx = activities.indexOf(secAct);
    const flightIdx = activities.indexOf(flightAct);
    if (secIdx !== -1 && flightIdx !== -1 && secIdx !== flightIdx - 1) {
      activities.splice(secIdx, 1);
      const newFlightIdx = activities.indexOf(flightAct);
      activities.splice(newFlightIdx, 0, secAct);
      repairs.push({ code: FAILURE_CODES.LOGISTICS_SEQUENCE, action: 'moved_security_before_flight' });
    }
  }

  // R3: Move activities after security to before airport transport
  if (securityItems.length > 0) {
    const secAct = securityItems[0];
    const secIdx = activities.indexOf(secAct);
    if (secIdx !== -1) {
      const afterSecurity = activities.slice(secIdx + 1);
      const misplaced = afterSecurity.filter(a => {
        const role = classify(a);
        return role !== 'flight' && role !== 'airport-transport' && role !== 'airport-security';
      });
      for (const mis of misplaced) {
        if (lockedIds.has(mis.id)) continue;
        const misIdx = activities.indexOf(mis);
        if (misIdx !== -1) {
          activities.splice(misIdx, 1);
          const atIdx = activities.findIndex(a => classify(a) === 'airport-transport');
          const insertAt = atIdx !== -1 ? atIdx : Math.max(0, activities.indexOf(checkoutItems[0]) || 0);
          activities.splice(insertAt, 0, mis);
          repairs.push({ code: FAILURE_CODES.LOGISTICS_SEQUENCE, action: 'moved_before_airport_transport', before: mis.title });
        }
      }
    }
  }

  // R5: Time window enforcement
  if (depFlight24 && checkoutItems.length > 0) {
    const depMins = parseTimeToMinutes(depFlight24);
    if (depMins !== null) {
      const airportBuffer = 180;
      const arriveAirportBy = depMins - airportBuffer;
      const transportCard = activities.find(a => classify(a) === 'airport-transport');
      const transportDuration = transportCard?.durationMinutes || 45;
      const latestCheckoutMins = arriveAirportBy - transportDuration - 30;

      // Re-anchor checkout if too late
      const checkoutMins = parseTimeToMinutes(checkoutItems[0].startTime) ?? 0;
      if (checkoutMins > latestCheckoutMins) {
        const before = checkoutItems[0].startTime;
        checkoutItems[0].startTime = minutesToHHMM(Math.max(latestCheckoutMins, 360));
        checkoutItems[0].endTime = addMinutesToHHMM(checkoutItems[0].startTime, 15);
        repairs.push({ code: FAILURE_CODES.LOGISTICS_SEQUENCE, action: 're_anchored_checkout', before, after: checkoutItems[0].startTime });

        if (breakfastItems.length > 0) {
          const newCkMins = parseTimeToMinutes(checkoutItems[0].startTime) ?? 480;
          breakfastItems[0].startTime = minutesToHHMM(Math.max(newCkMins - 60, 360));
          breakfastItems[0].endTime = minutesToHHMM(Math.max(newCkMins - 15, 405));
          repairs.push({ code: FAILURE_CODES.LOGISTICS_SEQUENCE, action: 're_anchored_breakfast' });
        }
      }

      // Remove activities that don't fit
      const cIdx = activities.indexOf(checkoutItems[0]);
      const tIdx = transportCard ? activities.indexOf(transportCard) : -1;
      if (cIdx !== -1 && tIdx !== -1 && tIdx > cIdx + 1) {
        const between = activities.slice(cIdx + 1, tIdx);
        let currentTime = parseTimeToMinutes(checkoutItems[0].endTime) ?? latestCheckoutMins;
        for (let j = between.length - 1; j >= 0; j--) {
          const act = between[j];
          const actDur = act.durationMinutes || 60;
          if (currentTime + actDur > arriveAirportBy - transportDuration) {
            const idx = activities.indexOf(act);
            if (idx !== -1 && !lockedIds.has(act.id)) {
              activities.splice(idx, 1);
              repairs.push({ code: FAILURE_CODES.LOGISTICS_SEQUENCE, action: 'removed_doesnt_fit_departure_window', before: act.title });
            }
          } else {
            currentTime += actDur + 15;
          }
        }
      }
    }
  }

  // R6: Breakfast location — override if not near hotel
  if (breakfastItems.length > 0 && hotelName) {
    const bAct = breakfastItems[0];
    const bLoc = (bAct.location?.name || '').toLowerCase();
    const hotelLower = hotelName.toLowerCase();
    const isNearHotel = bLoc.includes(hotelLower) || bLoc.includes('hotel') || bLoc.includes('lobby') || hotelLower.includes(bLoc);
    if (!isNearHotel && bLoc.length > 0) {
      const before = bAct.location?.name;
      bAct.location = { name: `Near ${hotelName}`, address: bAct.location?.address || '' };
      repairs.push({ code: FAILURE_CODES.LOGISTICS_SEQUENCE, action: 'override_breakfast_location', before, after: bAct.location.name });
    }
  }

  return repairs;
}

// =============================================================================
// FUZZY LOCATION MATCHING — prevents transit between same/contained venues
// =============================================================================

function isSameOrContainedLocation(aLoc: string, bLoc: string, hotel?: string): boolean {
  if (!aLoc || !bLoc) return false;
  if (aLoc === bLoc) return true;
  // Substring match — but require the shorter string to be at least 60% of the
  // longer string's length to avoid false positives like "spa" matching
  // "spa resort dinner cruise" or "The Grand" matching "The Grand Bazaar Restaurant".
  if (aLoc.length >= 4 && bLoc.length >= 4) {
    const ratio = Math.min(aLoc.length, bLoc.length) / Math.max(aLoc.length, bLoc.length);
    if ((aLoc.includes(bLoc) || bLoc.includes(aLoc)) && ratio >= 0.6) return true;
  }
  // Both reference the hotel
  if (hotel) {
    const h = hotel.toLowerCase();
    if (h.length >= 4 && aLoc.includes(h) && bLoc.includes(h)) return true;
    
  }
  return false;
}

// =============================================================================
// BOOKEND REPAIR (transport gaps + hotel returns)
// =============================================================================

function repairBookends(
  activities: any[],
  hotelName: string,
  dayNumber: number,
  isDepartureDay: boolean,
  isFirstDay: boolean = false,
  isHotelChange: boolean = false,
  hotelCoordinates?: { lat: number; lng: number },
  resolvedDestination?: string,
): { activities: any[]; repairs: RepairAction[] } {
  const repairs: RepairAction[] = [];

  const isTransport = (a: any) => (a.category || '').toLowerCase() === 'transport';
  const isAccom = (a: any) => (a.category || '').toLowerCase() === 'accommodation';
  const isHotelRelated = (a: any) => {
    const t = (a.title || '').toLowerCase();
    const l = (a.location?.name || '').toLowerCase();
    const hn = hotelName.toLowerCase();
    return t.includes(hn) || l.includes(hn) || t.includes('hotel') || t.includes('return to') || t.includes('freshen up');
  };
  const isCheckinOrCheckout = (a: any) => {
    const t = (a.title || '').toLowerCase();
    return t.includes('check-in') || t.includes('check in') || t.includes('checkin')
      || t.includes('checkout') || t.includes('check-out') || t.includes('check out');
  };

  const offset = (ts: string, min: number): string => {
    if (!ts) return '';
    const p = ts.split(':');
    if (p.length < 2) return ts;
    const tot = parseInt(p[0], 10) * 60 + parseInt(p[1], 10) + min;
    return `${String(Math.floor(tot / 60) % 24).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`;
  };

  const makeAccomCard = (label: string, st: string, dur: number) => ({
    id: `bookend-${label.replace(/\s/g, '-').toLowerCase()}-${dayNumber}-${Date.now()}`,
    title: `${label} ${hotelName}`,
    category: 'accommodation',
    description: `Time at ${hotelName} to rest and refresh.`,
    startTime: st, endTime: offset(st, dur), durationMinutes: dur,
    location: { name: hotelName, address: '' },
    cost: { amount: 0, currency: 'USD' }, isLocked: false,
    tags: ['hotel', 'rest'], source: 'bookend-validator',
  });

  /** Coordinate-aware transit card builder */
  const makeTransCard = (from: string, to: string, st: string, fromAct?: any, toAct?: any) => {
    const fromCoords = fromAct ? getActivityCoords(fromAct) : null;
    const toCoords = toAct ? getActivityCoords(toAct) : null;
    // Use hotel coords as fallback when going to/from hotel
    const resolvedFrom = fromCoords || (hotelCoordinates && to.toLowerCase().includes(hotelName.toLowerCase()) ? null : hotelCoordinates) || null;
    const resolvedTo = toCoords || (hotelCoordinates && (to.toLowerCase().includes(hotelName.toLowerCase()) || to.toLowerCase().includes('hotel')) ? hotelCoordinates : null);

    let dur = 15;
    let method = 'walking';
    let costAmount = 0;

    if (resolvedFrom && resolvedTo) {
      const est = estimateTransit(resolvedFrom, resolvedTo, resolvedDestination);
      dur = est.durationMinutes;
      method = est.method;
      costAmount = est.costAmount;
    }

    return {
      id: `transport-gap-${dayNumber}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: `Travel to ${to}`, category: 'transport',
      description: `Transit from ${from} to ${to}.`,
      startTime: st, endTime: offset(st, dur), durationMinutes: dur,
      location: { name: to, address: '' },
      fromLocation: { name: from, address: '' },
      cost: { amount: costAmount, currency: 'USD' }, isLocked: false,
      tags: ['transport'], transportation: { method, duration: `${dur} min` },
      source: 'bookend-validator',
    };
  };

  // 0. MORNING PHANTOM STRIP — On Day 2+ (non-first, non-departure), remove
  // accommodation cards at the start of the day that aren't check-in/checkout.
  // The traveler woke up at the hotel; "Return to Hotel" / "Freshen Up" as the
  // first activity is nonsensical.
  if (!isDepartureDay) {
    // On Day 1, find the check-in index so we only strip phantoms BEFORE check-in
    const day1CheckInIdx = isFirstDay
      ? activities.findIndex((a: any) => {
          const t = (a.title || '').toLowerCase();
          return isAccom(a) && (t.includes('check-in') || t.includes('check in') || t.includes('checkin'));
        })
      : -1;
    let stripped = true;
    while (stripped) {
      stripped = false;
      // Find first non-transport activity
      const firstRealIdx = activities.findIndex(a => !isTransport(a));
      if (firstRealIdx >= 0) {
        const first = activities[firstRealIdx];
        if (isAccom(first) && isHotelRelated(first) && !isCheckinOrCheckout(first) &&
            // On Day 1, only strip phantoms that appear before check-in
            (!isFirstDay || (day1CheckInIdx >= 0 && firstRealIdx < day1CheckInIdx))) {
          // On hotel-change days, only strip pre-dawn phantoms (before 06:00)
          // to preserve legitimate mid-day check-in/checkout activities
          if (isHotelChange) {
            const startMins = parseTimeToMinutes(first.startTime || '08:00');
            if (startMins !== null && startMins >= 360) break; // 06:00+ — likely legitimate, stop stripping
          }
          // Also remove any transport card immediately before it that goes TO the hotel
          if (firstRealIdx > 0 && isTransport(activities[firstRealIdx - 1])) {
            const transportTitle = (activities[firstRealIdx - 1].title || '').toLowerCase();
            const transportDest = (activities[firstRealIdx - 1].location?.name || '').toLowerCase();
            if (transportTitle.includes(hotelName.toLowerCase()) || transportDest.includes(hotelName.toLowerCase())
                || transportTitle.includes('hotel') || transportDest.includes('hotel')) {
              activities.splice(firstRealIdx - 1, 2);
            } else {
              activities.splice(firstRealIdx, 1);
            }
          } else {
            activities.splice(firstRealIdx, 1);
          }
          repairs.push({ code: FAILURE_CODES.MISSING_SLOT, action: 'stripped_morning_hotel_phantom' });
          stripped = true; // Check again in case there are consecutive phantoms
        }
      }
    }
  }

  // 1. Mid-day hotel transports without accommodation card
  // On hotel-change days, skip freshen-up injection between checkout and check-in (no hotel available)
  for (let i = 0; i < activities.length - 1; i++) {
    if (isTransport(activities[i]) && isHotelRelated(activities[i]) && !isAccom(activities[i + 1])) {
      // Skip if departure day and checkout already exists (traveler has left the hotel)
      if (isDepartureDay) {
        const hasCheckout = activities.some((a: any) => (a.title || '').toLowerCase().includes('checkout') || (a.title || '').toLowerCase().includes('check-out'));
        const checkoutIdx = activities.findIndex((a: any) => (a.title || '').toLowerCase().includes('checkout') || (a.title || '').toLowerCase().includes('check-out'));
        if (hasCheckout && i >= checkoutIdx) continue;
      }
      // On hotel-change days, suppress freshen-up between checkout and check-in
      if (isHotelChange) {
        const checkoutIdx = activities.findIndex((a: any) => {
          const t = (a.title || '').toLowerCase();
          return (t.includes('checkout') || t.includes('check-out') || t.includes('check out'));
        });
        const checkInIdx = activities.findIndex((a: any) => {
          const t = (a.title || '').toLowerCase();
          return (t.includes('check-in') || t.includes('check in') || t.includes('checkin'));
        });
        if (checkoutIdx >= 0 && checkInIdx > checkoutIdx && i >= checkoutIdx && i < checkInIdx) continue;
      }
      // On Day 1, suppress freshen-up injection before check-in
      if (isFirstDay) {
        const day1CiIdx = activities.findIndex((a: any) => {
          const t = (a.title || '').toLowerCase();
          return isAccom(a) && (t.includes('check-in') || t.includes('check in') || t.includes('checkin'));
        });
        if (day1CiIdx >= 0 && i < day1CiIdx) continue;
        if (day1CiIdx < 0) continue; // No check-in found at all on Day 1 — skip all freshen-ups
      }
      const card = makeAccomCard('Freshen up at', activities[i].endTime || offset(activities[i].startTime || '14:00', 15), 30);
      activities.splice(i + 1, 0, card);
      repairs.push({ code: FAILURE_CODES.MISSING_SLOT, action: 'injected_hotel_freshen_up' });
    }
  }

  // 1b. Mid-day hotel return guarantee — SKIP on departure days, first day before check-in, AND hotel-change days between checkout/check-in
  if (!isDepartureDay) {
    // On hotel-change days, find checkout/check-in window to suppress mid-day returns
    let hotelChangeCheckoutMin = -1;
    let hotelChangeCheckInMin = 99999;
    if (isHotelChange) {
      const coIdx = activities.findIndex((a: any) => {
        const t = (a.title || '').toLowerCase();
        return (t.includes('checkout') || t.includes('check-out') || t.includes('check out'));
      });
      const ciIdx = activities.findIndex((a: any) => {
        const t = (a.title || '').toLowerCase();
        return (t.includes('check-in') || t.includes('check in') || t.includes('checkin'));
      });
      if (coIdx >= 0) hotelChangeCheckoutMin = parseTimeToMinutes(activities[coIdx].startTime || '') ?? -1;
      if (ciIdx >= 0) hotelChangeCheckInMin = parseTimeToMinutes(activities[ciIdx].startTime || '') ?? 99999;
    }

    // On first day, find the check-in activity to ensure mid-day return only happens AFTER check-in
    const checkInIdx = isFirstDay
      ? activities.findIndex((a: any) => {
          const t = (a.title || '').toLowerCase();
          return isAccom(a) && (t.includes('check-in') || t.includes('check in') || t.includes('checkin'));
        })
      : -1;

    const lunchIdx = activities.findIndex(a => (a.category === 'dining') && /\b(lunch|midday meal)\b/i.test(a.title || ''));
    const dinnerIdx = activities.findIndex(a => (a.category === 'dining') && /\b(dinner|evening meal)\b/i.test(a.title || ''));
    if (lunchIdx >= 0 && dinnerIdx > lunchIdx) {
      // On first day, skip mid-day hotel return if lunch is before check-in
      // On first day, skip mid-day hotel return if lunch is before check-in OR if no check-in exists at all
      const skipBecausePreCheckIn = isFirstDay && (checkInIdx < 0 || lunchIdx < checkInIdx);
      // On hotel-change days, skip if the mid-day return would fall between checkout and check-in
      const lunchMin = parseTimeToMinutes(activities[lunchIdx]?.startTime || '') ?? 0;
      const skipBecauseHotelChange = isHotelChange && lunchMin >= hotelChangeCheckoutMin && lunchMin < hotelChangeCheckInMin;
      if (!skipBecausePreCheckIn && !skipBecauseHotelChange) {
        const hasMidDayAccom = activities.slice(lunchIdx + 1, dinnerIdx).some(a => isAccom(a));
        if (!hasMidDayAccom) {
          let insertIdx = dinnerIdx;
          for (let j = dinnerIdx - 1; j > lunchIdx; j--) {
            if (!isTransport(activities[j])) { insertIdx = j + 1; break; }
          }
          const prevEnd = activities[insertIdx - 1]?.endTime || '16:00';
          const transportCard = makeTransCard(activities[insertIdx - 1]?.location?.name || 'venue', hotelName, prevEnd, activities[insertIdx - 1], null);
          const accomCard = makeAccomCard('Freshen up at', offset(prevEnd, 15), 30);
          activities.splice(insertIdx, 0, transportCard, accomCard);
          repairs.push({ code: FAILURE_CODES.MISSING_SLOT, action: 'injected_midday_hotel_return' });
        }
      }
    }
  }

  // 2. End-of-day hotel return — SKIP on departure days (traveler is at the airport/departed)
  if (!isDepartureDay) {
    // On first day, only inject "Return to Hotel" if check-in has already happened
    const hasCheckedIn = !isFirstDay || activities.some((a: any) => {
      const t = (a.title || '').toLowerCase();
      return isAccom(a) && (t.includes('check-in') || t.includes('check in') || t.includes('checkin'));
    });

    // Check if ANY "Return to Hotel" / "Freshen Up" accommodation card already exists
    // ANYWHERE in the activities (not just at the end). The AI may have generated one
    // that sorted to a different position due to time-format issues.
    const hasExistingReturn = activities.some((a: any) => {
      if (!isAccom(a)) return false;
      const t = (a.title || '').toLowerCase();
      return (t.includes('return to') || t.includes('freshen up') || t.includes('freshen-up'))
        && !t.includes('check-in') && !t.includes('checkin') && !t.includes('check in')
        && !t.includes('checkout') && !t.includes('check-out') && !t.includes('check out');
    });

    if (hasCheckedIn && !hasExistingReturn) {
      const visible = activities.filter(a => !isTransport(a));
      const last = visible[visible.length - 1];
      // Harden: only treat as "already has return" if it's BOTH accommodation category
      // AND its title actually indicates a hotel return (not a mislabeled dinner etc.)
      const isProperReturn = last && isAccom(last) && isHotelRelated(last);
      if (last && !isProperReturn) {
        // If last activity is mislabeled accommodation (wrong category), fix its category
        if (last && isAccom(last) && !isHotelRelated(last)) {
          last.category = 'sightseeing';
          repairs.push({ code: FAILURE_CODES.MISSING_SLOT, action: 'recategorized_mislabeled_accommodation' });
        }
        const et = last.endTime || '22:00';
        activities.push(makeTransCard(last.location?.name || last.title || 'venue', hotelName, et, last, null));
        activities.push(makeAccomCard('Return to', offset(et, 20), 15));
        repairs.push({ code: FAILURE_CODES.MISSING_SLOT, action: 'injected_hotel_return' });
      }
    }
  }

  // 2.5. TRANSPORT VALIDATION — Validate existing AI-generated transport cards
  // Ensure each transport correctly bridges the preceding → following non-transport activities
  for (let i = 0; i < activities.length; i++) {
    if (!isTransport(activities[i])) continue;
    const transport = activities[i];

    // Find preceding non-transport activity
    let prevNonTransport: any = null;
    for (let j = i - 1; j >= 0; j--) {
      if (!isTransport(activities[j])) { prevNonTransport = activities[j]; break; }
    }
    // Find following non-transport activity
    let nextNonTransport: any = null;
    for (let j = i + 1; j < activities.length; j++) {
      if (!isTransport(activities[j])) { nextNonTransport = activities[j]; break; }
    }

    if (!nextNonTransport) continue; // trailing transport — handled by bookend guards

    const transportDest = (transport.location?.name || '').toLowerCase();
    const nextLoc = (nextNonTransport.location?.name || nextNonTransport.title || '').toLowerCase();

    // Check if transport destination matches the next non-transport activity
    const destMatchesNext = transportDest && nextLoc && isSameOrContainedLocation(transportDest, nextLoc, hotelName);

    if (!destMatchesNext && nextLoc) {
      // Rewrite transport to correctly bridge prev → next
      const fromName = prevNonTransport?.location?.name || prevNonTransport?.title || 'previous location';
      const toName = nextNonTransport.location?.name || sanitizeTransitDestination(nextNonTransport.title || '');
      const oldTitle = transport.title;

      transport.title = `Travel to ${toName}`;
      transport.description = `Transit from ${fromName} to ${toName}.`;
      transport.location = { name: toName, address: '' };
      transport.fromLocation = { name: fromName, address: '' };

      // Re-estimate duration if coordinates available
      const fromCoords = prevNonTransport ? getActivityCoords(prevNonTransport) : hotelCoordinates || null;
      const toCoords = getActivityCoords(nextNonTransport) || null;
      if (fromCoords && toCoords) {
        const est = estimateTransit(fromCoords, toCoords, resolvedDestination);
        transport.durationMinutes = est.durationMinutes;
        transport.endTime = offset(transport.startTime || '', est.durationMinutes);
        transport.cost = { amount: est.costAmount, currency: 'USD' };
        if (transport.transportation) {
          transport.transportation = { method: est.method, duration: `${est.durationMinutes} min` };
        }
      }

      repairs.push({
        code: FAILURE_CODES.LOGISTICS_SEQUENCE,
        action: 'rewritten_transport_to_match_neighbors',
        before: oldTitle,
        after: transport.title,
      });
    }

    // Also fix the "from" in description if it doesn't match preceding activity
    if (prevNonTransport) {
      const fromName = prevNonTransport.location?.name || prevNonTransport.title || '';
      if (fromName && !transport.fromLocation) {
        transport.fromLocation = { name: fromName, address: '' };
      }
    }
  }

  // 3. Transit gaps between non-adjacent visible activities (with guards)
  const rebuilt: any[] = [];
  for (let i = 0; i < activities.length; i++) {
    rebuilt.push(activities[i]);
    if (i < activities.length - 1) {
      const curr = activities[i], next = activities[i + 1];
      if (isTransport(curr) || isTransport(next)) continue;
      const cLoc = (curr.location?.name || curr.title || '').toLowerCase();
      const nLoc = (next.location?.name || sanitizeTransitDestination(next.title || '') || '').toLowerCase();
      // Guard: skip if same or contained location (fuzzy match)
      if (!cLoc || !nLoc || isSameOrContainedLocation(cLoc, nLoc, hotelName)) continue;
      // Guard: skip if current is accommodation and next venue is inside the hotel
      if (isAccom(curr) && hotelName && nLoc.includes(hotelName.toLowerCase())) continue;
      // Guard: skip if a transport to nLoc already exists in previous 2 positions
      const recentTransport = rebuilt.slice(-2).some(
        a => isTransport(a) && isSameOrContainedLocation((a.location?.name || '').toLowerCase(), nLoc, hotelName)
      );
      if (recentTransport) continue;
      rebuilt.push(makeTransCard(curr.location?.name || curr.title, next.location?.name || sanitizeTransitDestination(next.title || ''), curr.endTime || '', curr, next));
      repairs.push({ code: FAILURE_CODES.MISSING_SLOT, action: 'injected_transit_gap' });
    }
  }

  // 4. Final consolidation — collapse consecutive transports from ALL sources
  //    Preserves A→B semantics: from = preceding activity, to = last transport's destination
  {
    const consolidated: any[] = [];
    for (let i = 0; i < rebuilt.length; i++) {
      if (isTransport(rebuilt[i])) {
        let j = i;
        while (j + 1 < rebuilt.length && isTransport(rebuilt[j + 1])) j++;
        if (j > i) {
          const first = rebuilt[i];
          const last = rebuilt[j];
          // Determine real "from" — the preceding non-transport activity
          const prevNonTransport = [...consolidated].reverse().find(a => !isTransport(a));
          const fromName = prevNonTransport?.location?.name || first.fromLocation?.name || 'previous location';
          const toName = last.location?.name || sanitizeTransitDestination(last.title?.replace('Travel to ', '') || '') || 'destination';

          // Re-estimate using real endpoints if coordinates available
          const fromCoords = prevNonTransport ? getActivityCoords(prevNonTransport) : hotelCoordinates || null;
          const toCoords = getActivityCoords(last) || null;
          let mergedDur = last.durationMinutes || 15;
          let mergedCost = last.cost?.amount || 0;
          let mergedMethod = last.transportation?.method || 'transit';
          if (fromCoords && toCoords) {
            const est = estimateTransit(fromCoords, toCoords, resolvedDestination);
            mergedDur = est.durationMinutes;
            mergedCost = est.costAmount;
            mergedMethod = est.method;
          }

          const merged = {
            ...last,
            startTime: first.startTime || last.startTime,
            endTime: offset(first.startTime || last.startTime, mergedDur),
            durationMinutes: mergedDur,
            title: `Travel to ${toName}`,
            description: `Transit from ${fromName} to ${toName}.`,
            location: { name: toName, address: '' },
            fromLocation: { name: fromName, address: '' },
            cost: { amount: mergedCost, currency: 'USD' },
            transportation: { method: mergedMethod, duration: `${mergedDur} min` },
          };
          consolidated.push(merged);
          repairs.push({
            code: FAILURE_CODES.LOGISTICS_SEQUENCE,
            action: 'collapsed_consecutive_transport',
            before: `${j - i + 1} transport cards`,
            after: `${merged.title} (from ${fromName})`,
          });
          i = j;
        } else {
          consolidated.push(rebuilt[i]);
        }
      } else {
        consolidated.push(rebuilt[i]);
      }
    }

    // 4b. Remove orphaned transports where destination matches the immediately next activity's location
    const deduped: any[] = [];
    for (let i = 0; i < consolidated.length; i++) {
      if (isTransport(consolidated[i]) && i + 1 < consolidated.length) {
        const transportDest = (consolidated[i].location?.name || '').toLowerCase();
        const nextLoc = (consolidated[i + 1]?.location?.name || '').toLowerCase();
        // If previous non-transport activity is at the same location as transport destination, skip
        if (transportDest && nextLoc && deduped.length > 0) {
          const prevNonTransport = [...deduped].reverse().find(a => !isTransport(a));
          const prevLoc = (prevNonTransport?.location?.name || '').toLowerCase();
          if (prevNonTransport && isSameOrContainedLocation(prevLoc, transportDest, hotelName)) {
            repairs.push({
              code: FAILURE_CODES.LOGISTICS_SEQUENCE,
              action: 'removed_orphaned_transport',
              before: consolidated[i].title,
              after: 'removed (same location)',
            });
            continue;
          }
        }
      }
      deduped.push(consolidated[i]);
    }

    // 4c. POST-CONSOLIDATION BACK-TO-BACK GUARD — Safety net for any remaining adjacent transports
    {
      let merged = true;
      while (merged) {
        merged = false;
        for (let i = 0; i < deduped.length - 1; i++) {
          if (isTransport(deduped[i]) && isTransport(deduped[i + 1])) {
            const first = deduped[i];
            const second = deduped[i + 1];
            // Find preceding non-transport
            const prevNonTransport = deduped.slice(0, i).reverse().find(a => !isTransport(a));
            const fromName = prevNonTransport?.location?.name || first.fromLocation?.name || 'previous location';
            const toName = second.location?.name || sanitizeTransitDestination(second.title?.replace('Travel to ', '') || '') || 'destination';

            const fromCoords = prevNonTransport ? getActivityCoords(prevNonTransport) : hotelCoordinates || null;
            const toCoords = getActivityCoords(second) || null;
            let dur = second.durationMinutes || 15;
            let cost = second.cost?.amount || 0;
            let method = second.transportation?.method || 'transit';
            if (fromCoords && toCoords) {
              const est = estimateTransit(fromCoords, toCoords, resolvedDestination);
              dur = est.durationMinutes;
              cost = est.costAmount;
              method = est.method;
            }

            const mergedCard = {
              ...second,
              startTime: first.startTime || second.startTime,
              endTime: offset(first.startTime || second.startTime, dur),
              durationMinutes: dur,
              title: `Travel to ${toName}`,
              description: `Transit from ${fromName} to ${toName}.`,
              location: { name: toName, address: '' },
              fromLocation: { name: fromName, address: '' },
              cost: { amount: cost, currency: 'USD' },
              transportation: { method, duration: `${dur} min` },
            };
            deduped.splice(i, 2, mergedCard);
            repairs.push({
              code: FAILURE_CODES.LOGISTICS_SEQUENCE,
              action: 'merged_back_to_back_transport',
              before: `${first.title} + ${second.title}`,
              after: mergedCard.title,
            });
            merged = true;
            break; // restart scan
          }
        }
      }
    }

    // =========================================================================
    // 5. FINAL BOOKEND GUARDS — Days must never start or end on transit
    // =========================================================================

    // 5a. Strip leading transport cards (traveler wakes up at hotel, not mid-transit)
    if (!isDepartureDay) {
      while (deduped.length > 0 && isTransport(deduped[0])) {
        repairs.push({
          code: FAILURE_CODES.LOGISTICS_SEQUENCE,
          action: 'stripped_leading_transport',
          before: deduped[0].title,
          after: 'removed (day cannot start on transit)',
        });
        deduped.shift();
      }
    }

    // 5b. Strip or cap trailing transport cards (day must end at hotel, not mid-transit)
    if (!isDepartureDay) {
      while (deduped.length > 0 && isTransport(deduped[deduped.length - 1])) {
        const last = deduped[deduped.length - 1];
        const lastTitle = (last.title || '').toLowerCase();
        const lastDest = (last.location?.name || '').toLowerCase();
        const isHotelBound = lastTitle.includes(hotelName.toLowerCase()) || lastDest.includes(hotelName.toLowerCase())
          || lastTitle.includes('hotel') || lastDest.includes('hotel');

        if (isHotelBound) {
          // Transport to hotel — append a "Return to Hotel" accommodation card
          const arrivalTime = last.endTime || offset(last.startTime || '21:00', 15);
          const returnCard = makeAccomCard('Return to', arrivalTime, 30);
          deduped.push(returnCard);
          repairs.push({
            code: FAILURE_CODES.MISSING_SLOT,
            action: 'appended_return_to_hotel_after_trailing_transport',
            before: last.title,
            after: returnCard.title,
          });
          break; // Day now ends on accommodation
        } else {
          // Transport to a venue — nonsensical, remove it
          repairs.push({
            code: FAILURE_CODES.LOGISTICS_SEQUENCE,
            action: 'stripped_trailing_transport',
            before: last.title,
            after: 'removed (day cannot end on transit to venue)',
          });
          deduped.pop();
        }
      }
    }

    return { activities: deduped, repairs };
  }
}
