/**
 * Daily Estimates Module
 * 
 * Calculates per-day budget and walking distance estimates
 * for enhanced itinerary output.
 */

export interface DailyEstimates {
  dayNumber: number;
  budgetEstimate: {
    min: number;
    max: number;
    currency: string;
    formatted: string;
    breakdown?: {
      activities: number;
      meals: number;
      transport: number;
    };
  };
  walkingEstimate: {
    distanceKm: number;
    distanceMiles: number;
    formatted: string;
    intensity: 'light' | 'moderate' | 'active' | 'very_active';
  };
  intensityRating: '😌 Rest day' | '🚶 Light' | '🏃 Moderate' | '🔥 Full day' | '🔥🔥 Intense';
}

export interface Activity {
  cost?: { amount: number; currency?: string };
  durationMinutes?: number;
  category?: string;
  location?: { coordinates?: { lat: number; lng: number } };
}

// Average meal costs by budget tier (USD)
const MEAL_COSTS: Record<string, { breakfast: number; lunch: number; dinner: number }> = {
  budget: { breakfast: 5, lunch: 12, dinner: 20 },
  economy: { breakfast: 8, lunch: 18, dinner: 30 },
  standard: { breakfast: 12, lunch: 25, dinner: 50 },
  comfort: { breakfast: 18, lunch: 35, dinner: 75 },
  premium: { breakfast: 25, lunch: 50, dinner: 120 },
  luxury: { breakfast: 40, lunch: 80, dinner: 200 },
};

// Average transport costs per day by destination type
const TRANSPORT_COSTS: Record<string, number> = {
  walkable: 5,
  metro_city: 15,
  taxi_dependent: 40,
  car_rental: 60,
};

// Walking distance estimates by activity type (km)
const WALKING_BY_CATEGORY: Record<string, number> = {
  'walking tour': 5,
  'sightseeing': 4,
  'museum': 2,
  'gallery': 1.5,
  'shopping': 3,
  'market': 2,
  'park': 3,
  'garden': 2,
  'beach': 1.5,
  'nature': 4,
  'hiking': 8,
  'neighborhood': 3,
  'food tour': 3,
  'restaurant': 0.5,
  'café': 0.3,
  'bar': 0.3,
  'spa': 0.2,
  'wellness': 0.5,
  'adventure': 2,
  'water sports': 1,
  'culture': 2,
  'entertainment': 1,
  'default': 1.5,
};

/**
 * Calculate Haversine distance between two coordinates (km)
 */
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

/**
 * Calculate total walking distance for a day
 */
export function calculateDayWalking(activities: Activity[]): {
  distanceKm: number;
  distanceMiles: number;
  intensity: DailyEstimates['walkingEstimate']['intensity'];
  formatted: string;
} {
  let totalKm = 0;
  
  // Add walking within each activity based on category
  for (const activity of activities) {
    const category = (activity.category || 'default').toLowerCase();
    
    // Find matching category
    let walkingForActivity = WALKING_BY_CATEGORY['default'];
    for (const [key, value] of Object.entries(WALKING_BY_CATEGORY)) {
      if (category.includes(key)) {
        walkingForActivity = value;
        break;
      }
    }
    
    totalKm += walkingForActivity;
  }
  
  // Add walking between activities (based on coordinates if available)
  const activitiesWithCoords = activities.filter(
    a => a.location?.coordinates?.lat && a.location?.coordinates?.lng
  );
  
  for (let i = 0; i < activitiesWithCoords.length - 1; i++) {
    const curr = activitiesWithCoords[i].location!.coordinates!;
    const next = activitiesWithCoords[i + 1].location!.coordinates!;
    
    const distance = haversineDistance(curr.lat, curr.lng, next.lat, next.lng);
    
    // Assume walking if under 2km, otherwise add partial for getting to/from transport
    if (distance < 2) {
      totalKm += distance;
    } else {
      totalKm += 0.5; // Walking to/from transport
    }
  }
  
  // Round to 1 decimal
  totalKm = Math.round(totalKm * 10) / 10;
  const totalMiles = Math.round(totalKm * 0.621371 * 10) / 10;
  
  // Determine intensity
  let intensity: DailyEstimates['walkingEstimate']['intensity'];
  if (totalKm < 3) {
    intensity = 'light';
  } else if (totalKm < 6) {
    intensity = 'moderate';
  } else if (totalKm < 10) {
    intensity = 'active';
  } else {
    intensity = 'very_active';
  }
  
  return {
    distanceKm: totalKm,
    distanceMiles: totalMiles,
    intensity,
    formatted: `~${totalKm} km / ${totalMiles} miles`,
  };
}

/**
 * Calculate budget estimate for a day
 */
export function calculateDayBudget(
  activities: Activity[],
  budgetTier: string = 'standard',
  mealsIncluded: number = 3,
  currency: string = 'USD'
): DailyEstimates['budgetEstimate'] {
  const tier = budgetTier.toLowerCase() as keyof typeof MEAL_COSTS;
  const mealCosts = MEAL_COSTS[tier] || MEAL_COSTS.standard;
  
  // Sum activity costs
  let activityCostMin = 0;
  let activityCostMax = 0;
  
  for (const activity of activities) {
    if (activity.cost?.amount) {
      // If we have a cost, add it (assume ±20% range)
      activityCostMin += activity.cost.amount * 0.8;
      activityCostMax += activity.cost.amount * 1.2;
    } else {
      // Estimate based on category and tier
      const baseCost = getEstimatedActivityCost(activity.category, budgetTier);
      activityCostMin += baseCost * 0.7;
      activityCostMax += baseCost * 1.3;
    }
  }
  
  // Calculate meal costs
  const mealTotal = 
    (mealsIncluded >= 1 ? mealCosts.breakfast : 0) +
    (mealsIncluded >= 2 ? mealCosts.lunch : 0) +
    (mealsIncluded >= 3 ? mealCosts.dinner : 0);
  
  // Estimate transport (based on activity count and tier)
  const transportType = activities.length > 3 ? 'taxi_dependent' : 'metro_city';
  let transport = TRANSPORT_COSTS[transportType] || 15;
  
  // Adjust transport for budget tier
  if (tier === 'luxury' || tier === 'premium') {
    transport *= 2;
  } else if (tier === 'budget' || tier === 'economy') {
    transport *= 0.5;
  }
  
  const totalMin = Math.round(activityCostMin + mealTotal * 0.8 + transport * 0.8);
  const totalMax = Math.round(activityCostMax + mealTotal * 1.2 + transport * 1.2);
  
  return {
    min: totalMin,
    max: totalMax,
    currency,
    formatted: `~$${totalMin}-${totalMax}`,
    breakdown: {
      activities: Math.round((activityCostMin + activityCostMax) / 2),
      meals: mealTotal,
      transport: Math.round(transport),
    },
  };
}

/**
 * Get estimated cost for an activity based on category
 */
function getEstimatedActivityCost(category: string | undefined, budgetTier: string): number {
  const cat = (category || '').toLowerCase();
  const tier = budgetTier.toLowerCase();
  
  // Base costs by category
  const baseCosts: Record<string, number> = {
    'museum': 15,
    'gallery': 12,
    'tour': 40,
    'walking tour': 25,
    'food tour': 60,
    'cooking class': 80,
    'spa': 100,
    'wellness': 60,
    'adventure': 80,
    'water sports': 70,
    'nature': 20,
    'hiking': 10,
    'beach': 5,
    'sightseeing': 20,
    'entertainment': 50,
    'nightlife': 40,
    'shopping': 0, // Variable, don't estimate
    'restaurant': 0, // Counted in meals
    'café': 10,
  };
  
  let baseCost = 25; // Default
  for (const [key, value] of Object.entries(baseCosts)) {
    if (cat.includes(key)) {
      baseCost = value;
      break;
    }
  }
  
  // Adjust for tier
  const tierMultipliers: Record<string, number> = {
    budget: 0.5,
    economy: 0.7,
    standard: 1,
    comfort: 1.3,
    premium: 2,
    luxury: 3,
  };
  
  return baseCost * (tierMultipliers[tier] || 1);
}

/**
 * Calculate intensity rating for a day
 */
export function calculateIntensityRating(
  activityCount: number,
  walkingKm: number,
  isArrivalDay: boolean,
  isDepartureDay: boolean,
  isRestDay: boolean
): DailyEstimates['intensityRating'] {
  if (isArrivalDay || isDepartureDay) {
    return '🚶 Light';
  }
  
  if (isRestDay || activityCount <= 2) {
    return '😌 Rest day';
  }
  
  if (activityCount >= 6 || walkingKm >= 12) {
    return '🔥🔥 Intense';
  }
  
  if (activityCount >= 5 || walkingKm >= 8) {
    return '🔥 Full day';
  }
  
  if (activityCount >= 3 || walkingKm >= 5) {
    return '🏃 Moderate';
  }
  
  return '🚶 Light';
}

/**
 * Calculate all daily estimates for a day
 */
export function calculateDailyEstimates(
  dayNumber: number,
  activities: Activity[],
  options: {
    budgetTier?: string;
    currency?: string;
    mealsIncluded?: number;
    isArrivalDay?: boolean;
    isDepartureDay?: boolean;
    isRestDay?: boolean;
  } = {}
): DailyEstimates {
  const walking = calculateDayWalking(activities);
  const budget = calculateDayBudget(
    activities,
    options.budgetTier,
    options.mealsIncluded ?? 3,
    options.currency
  );
  const intensity = calculateIntensityRating(
    activities.length,
    walking.distanceKm,
    options.isArrivalDay || false,
    options.isDepartureDay || false,
    options.isRestDay || false
  );
  
  return {
    dayNumber,
    budgetEstimate: budget,
    walkingEstimate: walking,
    intensityRating: intensity,
  };
}

/**
 * Build prompt section for daily estimates
 */
export function buildDailyEstimatesPrompt(budgetTier: string = 'standard'): string {
  return `
═══════════════════════════════════════════════════════════════════════════
DAILY ESTIMATES (OUTPUT REQUIREMENT)
═══════════════════════════════════════════════════════════════════════════

For EACH DAY, include in the day metadata:

1. INTENSITY RATING (pick one):
   😌 Rest day - Minimal activities, mostly relaxation
   🚶 Light - 2-3 easy activities, under 5km walking
   🏃 Moderate - 3-4 activities, 5-8km walking  
   🔥 Full day - 5+ activities, 8-12km walking
   🔥🔥 Intense - Packed schedule, 12km+ walking

2. WALKING ESTIMATE:
   Format: "~X km / Y miles"
   Consider: Activities themselves + travel between them
   
3. BUDGET ESTIMATE (for ${budgetTier} tier):
   Format: "~$XXX-YYY"
   Include: Activities + meals + local transport
   
Example day metadata:
{
  "intensityRating": "🏃 Moderate",
  "walkingEstimate": "~6 km / 3.7 miles",
  "budgetEstimate": "~$120-180"
}

═══════════════════════════════════════════════════════════════════════════
`;
}
