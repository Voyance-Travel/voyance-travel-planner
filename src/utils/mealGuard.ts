/**
 * Client-side meal compliance guard
 * Lightweight version of the backend enforceRequiredMealsFinalGuard.
 * Ensures every full exploration day has breakfast, lunch, and dinner
 * before any frontend code saves itinerary data directly.
 */

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

function detectMeals(activities: ActivityMinimal[]): MealType[] {
  const detected = new Set<MealType>();
  for (const act of activities) {
    const title = (act.title || act.name || '').toLowerCase();
    const category = (act.category || '').toLowerCase();
    if (!category.includes('dining') && !['dining', 'food', 'restaurant'].some(k => category.includes(k))) {
      // Also check title for meal keywords even if category isn't dining
      const hasMealInTitle = Object.values(MEAL_KEYWORDS).flat().some(kw => title.includes(kw));
      if (!hasMealInTitle) continue;
    }
    for (const mealType of Object.keys(MEAL_KEYWORDS) as MealType[]) {
      if (MEAL_KEYWORDS[mealType].some(kw => title.includes(kw) || category.includes(kw))) {
        detected.add(mealType);
      }
    }
  }
  return (['breakfast', 'lunch', 'dinner'] as MealType[]).filter(m => detected.has(m));
}

function isFullExplorationDay(day: DayMinimal, totalDays: number): boolean {
  // First and last days are not full exploration days
  if (day.dayNumber === 1 || day.dayNumber === totalDays) return false;
  // Days with fewer than 3 activities are likely constrained
  if (day.activities.length < 3) return false;
  return true;
}

const FALLBACK_MEALS: Record<MealType, { start: string; end: string; cost: number }> = {
  breakfast: { start: '08:30', end: '09:15', cost: 12 },
  lunch: { start: '12:30', end: '13:30', cost: 18 },
  dinner: { start: '19:00', end: '20:15', cost: 30 },
};

// Destination-aware fallback hints (mirrors backend)
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

/**
 * Ensure a day's activities include required meals.
 * Injects fallback dining entries for any missing meals on full exploration days.
 * Returns the activities array (possibly with injected meals) and a list of what was injected.
 */
function ensureDayMeals(
  activities: ActivityMinimal[],
  requiredMeals: MealType[],
  dayNumber: number,
  destination?: string,
): { activities: ActivityMinimal[]; injected: MealType[] } {
  if (requiredMeals.length === 0) {
    return { activities, injected: [] };
  }

  const detected = detectMeals(activities);
  const missing = requiredMeals.filter(m => !detected.includes(m));

  if (missing.length === 0) {
    return { activities, injected: [] };
  }

  console.warn(
    `[MealGuard-Client] Day ${dayNumber}: required=[${requiredMeals.join(',')}], ` +
    `detected=[${detected.join(',')}], MISSING=[${missing.join(',')}] — injecting`
  );

  const result = [...activities];
  for (const mealType of missing) {
    const slot = FALLBACK_MEALS[mealType];
    const label = mealType.charAt(0).toUpperCase() + mealType.slice(1);
    const hint = getClientMealHint(destination || '', mealType);
    result.push({
      id: crypto.randomUUID(),
      title: `${label} at a ${hint.venueSuffix}`,
      startTime: slot.start,
      endTime: slot.end,
      category: 'dining',
      location: { name: `${label} spot nearby`, address: '' },
      cost: { amount: slot.cost, currency: 'USD', source: 'meal_guard_client' },
      description: hint.description,
      tags: ['dining', mealType, 'meal-guard', 'needs-refinement'],
      bookingRequired: false,
      tips: `This is a placeholder — tap to get a specific restaurant recommendation for this ${mealType}.`,
      needsRefinement: true,
    });
  }

  // Sort by startTime
  result.sort((a, b) => {
    const parseMin = (t?: string) => {
      if (!t) return 0;
      const m = t.match(/(\d{1,2}):(\d{2})/);
      return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 0;
    };
    return parseMin(a.startTime || a.time) - parseMin(b.startTime || b.time);
  });

  return { activities: result, injected: missing };
}

/**
 * Run meal compliance across all days of an itinerary before saving.
 * Mutates in-place and returns a summary of injections.
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

    // Determine required meals based on day type
    const requiredMeals: MealType[] = isFullExplorationDay(day, totalDays)
      ? ['breakfast', 'lunch', 'dinner']
      : []; // First/last days have dynamic requirements — only enforce on full days client-side

    if (requiredMeals.length === 0) continue;

    // Use per-day city if available, fall back to trip destination
    const dayDestination = (day as any).city || destination || '';
    const result = ensureDayMeals(day.activities, requiredMeals, day.dayNumber, dayDestination);
    if (result.injected.length > 0) {
      day.activities = result.activities;
      details.push({ dayNumber: day.dayNumber, injected: result.injected });
      totalInjected += result.injected.length;
    }
  }

  if (totalInjected > 0) {
    console.warn(`[MealGuard-Client] Injected ${totalInjected} meals across ${details.length} days`);
  }

  return { totalInjected, details };
}
