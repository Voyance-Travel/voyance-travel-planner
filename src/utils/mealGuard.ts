/**
 * Client-side meal compliance guard
 * Lightweight version of the backend enforceRequiredMealsFinalGuard.
 * Ensures every full exploration day has breakfast, lunch, and dinner
 * before any frontend code saves itinerary data directly.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveAnyMealFallback } from '@/lib/fallbackRestaurants';

type MealType = 'breakfast' | 'lunch' | 'dinner';

interface ActivityMinimal {
  id?: string;
  title?: string;
  name?: string;
  category?: string;
  startTime?: string;
  endTime?: string;
  time?: string;
  [key: string]: unknown;
}

interface DayMinimal {
  dayNumber: number;
  date?: string;
  activities: ActivityMinimal[];
  [key: string]: unknown;
}

const MEAL_KEYWORDS: Record<MealType, string[]> = {
  breakfast: ['breakfast', 'brunch'],
  lunch: ['lunch'],
  dinner: ['dinner', 'supper', 'evening meal'],
};

const DINING_CATEGORIES = ['dining', 'restaurant', 'food', 'cafe', 'meal'];

function detectMeals(activities: ActivityMinimal[]): MealType[] {
  const detected = new Set<MealType>();
  for (const act of activities) {
    const title = (act.title || act.name || '').toLowerCase();
    const category = (act.category || '').toLowerCase();
    const isDining = DINING_CATEGORIES.some(c => category.includes(c));

    for (const mealType of Object.keys(MEAL_KEYWORDS) as MealType[]) {
      if (MEAL_KEYWORDS[mealType].some(kw => title.includes(kw))) {
        detected.add(mealType);
      } else if (isDining && MEAL_KEYWORDS[mealType].some(kw => category.includes(kw))) {
        detected.add(mealType);
      }
    }
  }
  return (['breakfast', 'lunch', 'dinner'] as MealType[]).filter(m => detected.has(m));
}

function isFullExplorationDay(day: DayMinimal, totalDays: number): boolean {
  if (day.dayNumber === 1 || day.dayNumber === totalDays) return false;
  if (day.activities.length < 3) return false;
  return true;
}

const FALLBACK_MEALS: Record<MealType, { start: string; end: string; cost: number }> = {
  breakfast: { start: '08:30', end: '09:15', cost: 12 },
  lunch: { start: '12:30', end: '13:30', cost: 18 },
  dinner: { start: '19:00', end: '20:15', cost: 30 },
};

const DESTINATION_MEAL_HINTS: Record<string, Record<MealType, { venueSuffix: string; description: string }>> = {
  tokyo: {
    breakfast: { venueSuffix: 'kissaten (traditional coffee house)', description: 'Traditional Japanese morning set at a neighborhood kissaten' },
    lunch: { venueSuffix: 'ramen shop', description: 'Steaming bowl of ramen or a teishoku set meal' },
    dinner: { venueSuffix: 'izakaya', description: 'Grilled skewers and small plates at a lively izakaya' },
  },
  paris: {
    breakfast: { venueSuffix: 'boulangerie-café', description: 'Fresh croissant and café crème at a neighborhood boulangerie' },
    lunch: { venueSuffix: 'bistro', description: 'Plat du jour at a classic Parisian bistro' },
    dinner: { venueSuffix: 'brasserie', description: 'French brasserie dinner — steak frites, wine, and atmosphere' },
  },
  rome: {
    breakfast: { venueSuffix: 'bar-pasticceria', description: 'Cornetto and cappuccino standing at the bar' },
    lunch: { venueSuffix: 'trattoria', description: 'Fresh pasta and house wine at a neighborhood trattoria' },
    dinner: { venueSuffix: 'ristorante', description: 'Roman classics — cacio e pepe, supplì, and local wine' },
  },
  london: {
    breakfast: { venueSuffix: 'café', description: 'Full English or avocado toast at a neighborhood café' },
    lunch: { venueSuffix: 'gastropub', description: 'Pub lunch with craft beer at a local gastropub' },
    dinner: { venueSuffix: 'restaurant', description: 'Dinner at a well-reviewed neighborhood restaurant' },
  },
  bangkok: {
    breakfast: { venueSuffix: 'street stall', description: 'Jok (rice porridge) or pa-tong-ko at a morning street stall' },
    lunch: { venueSuffix: 'shophouse restaurant', description: 'Pad kra pao or som tum at a bustling shophouse' },
    dinner: { venueSuffix: 'riverside restaurant', description: 'Thai seafood dinner with river views' },
  },
};

function getClientMealHint(destination: string, mealType: MealType): { venueSuffix: string; description: string } {
  const destLower = (destination || '').toLowerCase();
  for (const [key, hints] of Object.entries(DESTINATION_MEAL_HINTS)) {
    if (destLower.includes(key)) return hints[mealType];
  }
  return {
    breakfast: { venueSuffix: 'café near your hotel', description: 'Morning coffee and a local breakfast — ask your hotel for their favorite nearby spot' },
    lunch: { venueSuffix: 'neighborhood restaurant', description: 'Midday meal at a well-reviewed local spot near your activities' },
    dinner: { venueSuffix: 'restaurant', description: 'Evening dinner at a popular local restaurant' },
  }[mealType];
}

// ─── Venue resolution ───────────────────────────────────────────────────

interface VerifiedVenue {
  name: string;
  address?: string;
  rating?: number;
  category?: string;
}

/**
 * Query verified_venues for real restaurant names matching a destination and dining category.
 * Returns a map of meal types to venue names, using category heuristics.
 */
async function fetchRealVenues(
  supabaseClient: SupabaseClient,
  destination: string,
  needed: MealType[],
): Promise<Record<MealType, VerifiedVenue | null>> {
  const result: Record<MealType, VerifiedVenue | null> = {
    breakfast: null,
    lunch: null,
    dinner: null,
  };

  if (!destination || needed.length === 0) return result;

  try {
    // Query dining venues for this destination, ordered by rating
    const { data: venues } = await supabaseClient
      .from('verified_venues')
      .select('name, address, rating, category')
      .ilike('destination', `%${destination}%`)
      .in('category', ['restaurant', 'dining', 'cafe', 'food', 'bakery', 'bar'])
      .order('rating', { ascending: false, nullsFirst: false })
      .limit(30);

    if (!venues || venues.length === 0) return result;

    // Assign venues to meal slots based on category/name heuristics
    const used = new Set<string>();

    for (const mealType of needed) {
      const venue = pickVenueForMeal(venues as VerifiedVenue[], mealType, used);
      if (venue) {
        result[mealType] = venue;
        used.add(venue.name);
      }
    }
  } catch (e) {
    console.warn('[MealGuard] Failed to fetch verified venues:', e);
  }

  return result;
}

const BREAKFAST_HINTS = ['cafe', 'bakery', 'breakfast', 'coffee', 'brunch', 'pastry'];
const LUNCH_HINTS = ['bistro', 'trattoria', 'deli', 'lunch', 'noodle', 'ramen', 'sandwich'];
const DINNER_HINTS = ['restaurant', 'ristorante', 'brasserie', 'steakhouse', 'izakaya', 'dinner', 'grill'];

function pickVenueForMeal(
  venues: VerifiedVenue[],
  mealType: MealType,
  used: Set<string>,
): VerifiedVenue | null {
  const hints = mealType === 'breakfast' ? BREAKFAST_HINTS
    : mealType === 'lunch' ? LUNCH_HINTS
    : DINNER_HINTS;

  // First pass: find a venue whose name/category matches the meal type hints
  for (const v of venues) {
    if (used.has(v.name)) continue;
    const combined = `${v.name} ${v.category || ''}`.toLowerCase();
    if (hints.some(h => combined.includes(h))) return v;
  }

  // Second pass: just pick the highest-rated unused venue
  for (const v of venues) {
    if (used.has(v.name)) continue;
    return v;
  }

  return null;
}

// ─── Core injection logic ───────────────────────────────────────────────

function buildFallbackActivity(
  mealType: MealType,
  venueName: string,
  venueAddress: string,
  description: string,
  isGeneric: boolean,
  cost: number,
): ActivityMinimal {
  const slot = FALLBACK_MEALS[mealType];
  return {
    id: crypto.randomUUID(),
    title: venueName,
    startTime: slot.start,
    endTime: slot.end,
    category: 'dining',
    location: { name: venueName, address: venueAddress },
    cost: { amount: cost, currency: 'USD', source: isGeneric ? 'meal_guard_client' : 'meal_guard_venue' },
    description,
    tags: ['dining', mealType, 'meal-guard', ...(isGeneric ? ['needs-refinement'] : [])],
    bookingRequired: false,
    tips: isGeneric
      ? `Explore local options — check recent reviews or ask your accommodation for recommendations.`
      : `Added from verified venues — feel free to swap if you prefer somewhere else.`,
    needsRefinement: isGeneric,
  };
}

function sortByTime(activities: ActivityMinimal[]): ActivityMinimal[] {
  return [...activities].sort((a, b) => {
    const parseMin = (t?: string) => {
      if (!t) return 0;
      const m = t.match(/(\d{1,2}):(\d{2})/);
      return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 0;
    };
    return parseMin(a.startTime || a.time) - parseMin(b.startTime || b.time);
  });
}

/**
 * Synchronous meal compliance — uses generic fallbacks only.
 * Kept for backward compatibility but prefer the async variant.
 */
export function enforceItineraryMealCompliance(
  days: DayMinimal[],
  destination?: string,
): { totalInjected: number; details: Array<{ dayNumber: number; injected: MealType[] }> } {
  const totalDays = days.length;
  const details: Array<{ dayNumber: number; injected: MealType[] }> = [];
  let totalInjected = 0;

  for (const day of days) {
    if (!day.activities || !Array.isArray(day.activities)) continue;

    const requiredMeals: MealType[] = isFullExplorationDay(day, totalDays)
      ? ['breakfast', 'lunch', 'dinner']
      : [];

    if (requiredMeals.length === 0) continue;

    const detected = detectMeals(day.activities);
    const missing = requiredMeals.filter(m => !detected.includes(m));
    if (missing.length === 0) continue;

    const dayDestination = (day as any).city || destination || '';

    console.warn(
      `[MealGuard-Client] Day ${day.dayNumber}: required=[${requiredMeals.join(',')}], ` +
      `detected=[${detected.join(',')}], MISSING=[${missing.join(',')}] — injecting generic`
    );

    for (const mealType of missing) {
      const hint = getClientMealHint(dayDestination, mealType);
      const label = mealType.charAt(0).toUpperCase() + mealType.slice(1);
      day.activities.push(
        buildFallbackActivity(
          mealType,
          `${label} at a ${hint.venueSuffix}`,
          '',
          hint.description,
          true,
          FALLBACK_MEALS[mealType].cost,
        )
      );
    }

    day.activities = sortByTime(day.activities);
    details.push({ dayNumber: day.dayNumber, injected: missing });
    totalInjected += missing.length;
  }

  if (totalInjected > 0) {
    console.warn(`[MealGuard-Client] Injected ${totalInjected} generic meals across ${details.length} days`);
  }

  return { totalInjected, details };
}

/**
 * Async meal compliance — queries verified_venues for real restaurant names
 * before falling back to generic placeholders.
 */
export async function enforceItineraryMealComplianceAsync(
  days: DayMinimal[],
  supabaseClient: SupabaseClient,
  destination?: string,
): Promise<{ totalInjected: number; details: Array<{ dayNumber: number; injected: MealType[] }> }> {
  const totalDays = days.length;
  const details: Array<{ dayNumber: number; injected: MealType[] }> = [];
  let totalInjected = 0;

  for (const day of days) {
    if (!day.activities || !Array.isArray(day.activities)) continue;

    const requiredMeals: MealType[] = isFullExplorationDay(day, totalDays)
      ? ['breakfast', 'lunch', 'dinner']
      : [];

    if (requiredMeals.length === 0) continue;

    const detected = detectMeals(day.activities);
    const missing = requiredMeals.filter(m => !detected.includes(m));
    if (missing.length === 0) continue;

    const dayDestination = (day as any).city || destination || '';

    console.warn(
      `[MealGuard-Client] Day ${day.dayNumber}: required=[${requiredMeals.join(',')}], ` +
      `detected=[${detected.join(',')}], MISSING=[${missing.join(',')}] — resolving venues`
    );

    // Try to get real venue names from verified_venues
    const realVenues = await fetchRealVenues(supabaseClient, dayDestination, missing);

    for (const mealType of missing) {
      const venue = realVenues[mealType];
      if (venue) {
        // Use real venue name
        day.activities.push(
          buildFallbackActivity(
            mealType,
            venue.name,
            venue.address || '',
            `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} at ${venue.name}${venue.rating ? ` (★ ${venue.rating})` : ''}`,
            false,
            FALLBACK_MEALS[mealType].cost,
          )
        );
      } else {
        // Fall back to generic
        const hint = getClientMealHint(dayDestination, mealType);
        const label = mealType.charAt(0).toUpperCase() + mealType.slice(1);
        day.activities.push(
          buildFallbackActivity(
            mealType,
            `${label} at a ${hint.venueSuffix}`,
            '',
            hint.description,
            true,
            FALLBACK_MEALS[mealType].cost,
          )
        );
      }
    }

    day.activities = sortByTime(day.activities);
    details.push({ dayNumber: day.dayNumber, injected: missing });
    totalInjected += missing.length;
  }

  if (totalInjected > 0) {
    console.warn(`[MealGuard-Client] Injected ${totalInjected} meals across ${details.length} days (with venue resolution)`);
  }

  return { totalInjected, details };
}
