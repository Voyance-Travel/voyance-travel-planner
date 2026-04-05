/**
 * Defensible Cost Estimation Engine
 * 
 * Uses destination_cost_index table for location-aware pricing.
 * Formula: (Category Base × Budget Multiplier × Destination Index) × (1 + Tax/Tip)
 * 
 * Resolution Priority:
 * 1. Explicit cost from venue data
 * 2. Google priceLevel mapping
 * 3. Category base × destination index calculation
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// TYPES
// ============================================================================

export interface CostIndex {
  city: string;
  country: string;
  cost_multiplier: number;
  breakfast_base_usd: number;
  lunch_base_usd: number;
  dinner_base_usd: number;
  coffee_base_usd: number;
  activity_base_usd: number;
  museum_base_usd: number;
  tour_base_usd: number;
  transport_base_usd: number;
  tax_tip_buffer: number;
  confidence_score: number;
}

export interface CostEstimateResult {
  amount: number;
  currency: 'USD';
  isEstimated: boolean;
  confidence: 'high' | 'medium' | 'low';
  source: 'explicit' | 'price_level' | 'category_estimate' | 'fallback';
  reason: string;
  perPerson?: number;
}

export interface EstimateParams {
  category: string;
  title?: string; // Activity title - used to infer meal type when category is generic
  city?: string;
  country?: string;
  travelers?: number;
  budgetTier?: 'budget' | 'moderate' | 'luxury';
  priceLevel?: number; // Google Places 1-4
  explicitCost?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Budget tier multipliers
const BUDGET_MULTIPLIERS: Record<string, number> = {
  budget: 0.7,
  moderate: 1.0,
  luxury: 1.5,
};

// Google priceLevel to USD ranges (per person, moderate budget)
const PRICE_LEVEL_RANGES: Record<number, { min: number; max: number }> = {
  1: { min: 5, max: 15 },    // Inexpensive
  2: { min: 15, max: 30 },   // Moderate
  3: { min: 30, max: 60 },   // Expensive
  4: { min: 60, max: 120 },  // Very Expensive
};

// Category to base field mapping
const CATEGORY_TO_BASE_FIELD: Record<string, keyof CostIndex> = {
  breakfast: 'breakfast_base_usd',
  brunch: 'breakfast_base_usd',
  lunch: 'lunch_base_usd',
  dinner: 'dinner_base_usd',
  dining: 'dinner_base_usd', // Generic dining - will be refined by title analysis
  restaurant: 'dinner_base_usd',
  coffee: 'coffee_base_usd',
  cafe: 'coffee_base_usd',
  activity: 'activity_base_usd',
  attraction: 'activity_base_usd',
  sightseeing: 'activity_base_usd',
  museum: 'museum_base_usd',
  gallery: 'museum_base_usd',
  tour: 'tour_base_usd',
  experience: 'tour_base_usd',
  transport: 'transport_base_usd',
  transfer: 'transport_base_usd',
  airport: 'transport_base_usd',
  taxi: 'transport_base_usd',
};

/**
 * Infer meal type from activity title when category is generic "dining"
 */
function inferMealTypeFromTitle(title: string): keyof CostIndex | null {
  const titleLower = (title || '').toLowerCase();
  if (titleLower.includes('breakfast') || titleLower.includes('morning meal')) {
    return 'breakfast_base_usd';
  }
  if (titleLower.includes('brunch')) {
    return 'breakfast_base_usd';
  }
  if (titleLower.includes('lunch') || titleLower.includes('midday')) {
    return 'lunch_base_usd';
  }
  if (titleLower.includes('coffee') || titleLower.includes('café') || titleLower.includes('cafe')) {
    return 'coffee_base_usd';
  }
  // Default to dinner for evening/dinner/restaurant
  return null;
}

// Default base prices (USD) when no destination index exists
const DEFAULT_BASE_PRICES: CostIndex = {
  city: '_default',
  country: '_default',
  cost_multiplier: 1.0,
  breakfast_base_usd: 15,
  lunch_base_usd: 25,
  dinner_base_usd: 45,
  coffee_base_usd: 5,
  activity_base_usd: 30,
  museum_base_usd: 20,
  tour_base_usd: 75,
  transport_base_usd: 15,
  tax_tip_buffer: 0.18,
  confidence_score: 0.5,
};

// ============================================================================
// CACHE
// ============================================================================

// In-memory cache for cost indices (refreshes on page load)
const costIndexCache = new Map<string, CostIndex>();
let cacheInitialized = false;

/**
 * Initialize the cost index cache from Supabase
 */
async function initializeCache(): Promise<void> {
  if (cacheInitialized) return;
  
  try {
    const { data, error } = await supabase
      .from('destination_cost_index')
      .select('*');
    
    if (error) {
      console.warn('Failed to load cost index, using defaults:', error);
      return;
    }
    
    if (data) {
      data.forEach((row: CostIndex) => {
        const key = `${(row.city || '').toLowerCase()}|${(row.country || '').toLowerCase()}`;
        costIndexCache.set(key, row);
      });
      cacheInitialized = true;
      console.log(`Cost index cache loaded: ${costIndexCache.size} destinations`);
    }
  } catch (err) {
    console.warn('Cost index cache init failed:', err);
  }
}

/**
 * Get cost index for a destination (city/country)
 */
async function getCostIndex(city?: string, country?: string): Promise<CostIndex> {
  await initializeCache();
  
  if (!city && !country) {
    return costIndexCache.get('_default|_default') || DEFAULT_BASE_PRICES;
  }
  
  // Try exact match
  const exactKey = `${(city || '').toLowerCase()}|${(country || '').toLowerCase()}`;
  if (costIndexCache.has(exactKey)) {
    return costIndexCache.get(exactKey)!;
  }
  
  // Try city-only match (for city-states like Singapore)
  if (city) {
    for (const [key, value] of costIndexCache.entries()) {
      if (key.startsWith(`${(city || '').toLowerCase()}|`)) {
        return value;
      }
    }
  }
  
  // Try country-only match (use first city in that country as proxy)
  if (country) {
    for (const [key, value] of costIndexCache.entries()) {
      if (key.endsWith(`|${(country || '').toLowerCase()}`)) {
        return value;
      }
    }
  }
  
  // Return default
  return costIndexCache.get('_default|_default') || DEFAULT_BASE_PRICES;
}

// ============================================================================
// MAIN ESTIMATION FUNCTION
// ============================================================================

/**
 * Estimate cost for an activity with defensible logic
 * 
 * @param params - Estimation parameters
 * @returns Cost estimate with confidence and explanation
 */
export async function estimateCost(params: EstimateParams): Promise<CostEstimateResult> {
  const {
    category,
    city,
    country,
    travelers = 1,
    budgetTier = 'moderate',
    priceLevel,
    explicitCost,
  } = params;
  
  // Priority 1: Explicit cost
  if (explicitCost !== undefined && explicitCost >= 0) {
    return {
      amount: explicitCost,
      currency: 'USD',
      isEstimated: false,
      confidence: 'high',
      source: 'explicit',
      reason: 'Verified venue pricing',
    };
  }
  
  // Get destination cost index
  const costIndex = await getCostIndex(city, country);
  const destinationName = city || country || 'this area';
  
  // Priority 2: Google priceLevel
  if (priceLevel && priceLevel >= 1 && priceLevel <= 4) {
    const range = PRICE_LEVEL_RANGES[priceLevel];
    const budgetMult = BUDGET_MULTIPLIERS[budgetTier] || 1.0;
    const midpoint = (range.min + range.max) / 2;
    const perPerson = Math.round(midpoint * budgetMult * costIndex.cost_multiplier);
    const total = perPerson * travelers;
    const withTax = Math.round(total * (1 + costIndex.tax_tip_buffer) / 5) * 5;
    
    return {
      amount: withTax,
      currency: 'USD',
      isEstimated: true,
      confidence: 'medium',
      source: 'price_level',
      reason: `Based on venue price level (${priceLevel}/4) in ${destinationName}`,
      perPerson,
    };
  }
  
  // Priority 3: Category-based estimation with title inference
  const normalizedCategory = (category || 'activity').toLowerCase().trim();
  
  // Try to infer meal type from title if category is generic "dining"
  let baseField: keyof CostIndex;
  if (normalizedCategory === 'dining' && params.title) {
    baseField = inferMealTypeFromTitle(params.title) || CATEGORY_TO_BASE_FIELD[normalizedCategory] || 'activity_base_usd';
  } else {
    baseField = CATEGORY_TO_BASE_FIELD[normalizedCategory] || 'activity_base_usd';
  }
  const basePrice = (costIndex[baseField] as number) || DEFAULT_BASE_PRICES.activity_base_usd;
  
  const budgetMult = BUDGET_MULTIPLIERS[budgetTier] || 1.0;
  const perPerson = Math.max(5, Math.round(basePrice * budgetMult * costIndex.cost_multiplier));
  
  // Determine if this is a per-person category (dining) or flat fee (museum entry)
  const isPerPerson = ['breakfast', 'brunch', 'lunch', 'dinner', 'dining', 'restaurant', 'coffee', 'cafe'].includes(normalizedCategory);
  const subtotal = isPerPerson ? perPerson * travelers : perPerson;
  
  // Apply tax/tip buffer for dining
  const isDining = ['breakfast', 'brunch', 'lunch', 'dinner', 'dining', 'restaurant'].includes(normalizedCategory);
  const taxMultiplier = isDining ? (1 + costIndex.tax_tip_buffer) : 1.0;
  const total = Math.max(5, Math.round((subtotal * taxMultiplier) / 5) * 5);
  
  // Confidence based on destination data quality
  const confidence: 'high' | 'medium' | 'low' = 
    costIndex.confidence_score >= 0.8 ? 'high' :
    costIndex.confidence_score >= 0.6 ? 'medium' : 'low';
  
  // Build reason string
  let reason: string;
  if (isDining) {
    reason = `~$${perPerson}/person for ${normalizedCategory} in ${destinationName}`;
  } else {
    reason = `Typical ${normalizedCategory} cost in ${destinationName}`;
  }
  
  return {
    amount: total,
    currency: 'USD',
    isEstimated: true,
    confidence,
    source: 'category_estimate',
    reason,
    perPerson: isPerPerson ? perPerson : undefined,
  };
}

/**
 * Synchronous estimation for immediate use (uses cached data or defaults)
 * Call initializeCache() early in app lifecycle for best results
 */
export function estimateCostSync(params: EstimateParams): CostEstimateResult {
  const {
    category,
    city,
    country,
    travelers = 1,
    budgetTier = 'moderate',
    priceLevel,
    explicitCost,
  } = params;
  
  // Block accommodation categories — hotel costs are tracked separately in Budget/Payments
  const normalizedCategoryEarly = (category || 'activity').toLowerCase().trim();
  if (['accommodation', 'hotel', 'stay', 'check-in', 'checkout', 'check-out'].includes(normalizedCategoryEarly)) {
    return {
      amount: 0,
      currency: 'USD',
      isEstimated: false,
      confidence: 'high' as const,
      source: 'explicit' as const,
      reason: 'Accommodation excluded from activity costs',
    };
  }
  
  // Priority 1: Explicit cost
  if (explicitCost !== undefined && explicitCost >= 0) {
    return {
      amount: explicitCost,
      currency: 'USD',
      isEstimated: false,
      confidence: 'high',
      source: 'explicit',
      reason: 'Verified venue pricing',
    };
  }
  
  // Get cached cost index or default
  const exactKey = `${(city || '').toLowerCase()}|${(country || '').toLowerCase()}`;
  let costIndex = costIndexCache.get(exactKey);
  
  // Try partial matches
  if (!costIndex && city) {
    for (const [key, value] of costIndexCache.entries()) {
      if (key.startsWith(`${(city || '').toLowerCase()}|`)) {
        costIndex = value;
        break;
      }
    }
  }
  if (!costIndex && country) {
    for (const [key, value] of costIndexCache.entries()) {
      if (key.endsWith(`|${(country || '').toLowerCase()}`)) {
        costIndex = value;
        break;
      }
    }
  }
  costIndex = costIndex || DEFAULT_BASE_PRICES;
  
  const destinationName = city || country || 'this area';
  
  // Priority 2: Google priceLevel
  if (priceLevel && priceLevel >= 1 && priceLevel <= 4) {
    const range = PRICE_LEVEL_RANGES[priceLevel];
    const budgetMult = BUDGET_MULTIPLIERS[budgetTier] || 1.0;
    const midpoint = (range.min + range.max) / 2;
    const perPerson = Math.round(midpoint * budgetMult * costIndex.cost_multiplier);
    const total = perPerson * travelers;
    const withTax = Math.round(total * (1 + costIndex.tax_tip_buffer) / 5) * 5;
    
    return {
      amount: withTax,
      currency: 'USD',
      isEstimated: true,
      confidence: 'medium',
      source: 'price_level',
      reason: `Based on venue price level (${priceLevel}/4) in ${destinationName}`,
      perPerson,
    };
  }
  
  // Priority 3: Category-based estimation with title inference
  const normalizedCategory = (category || 'activity').toLowerCase().trim();

  // ─── Transport mode-aware pricing ───
  if (['transport', 'transfer', 'transportation'].includes(normalizedCategory)) {
    const titleLower = (params.title || '').toLowerCase();
    let transportBase: number;

    if (titleLower.includes('walk') || titleLower.includes('stroll')) {
      return {
        amount: 0,
        currency: 'USD',
        isEstimated: false,
        confidence: 'high' as const,
        source: 'category_estimate' as const,
        reason: 'Walking is free',
      };
    } else if (titleLower.includes('subway') || titleLower.includes('metro')) {
      transportBase = 3;
    } else if (titleLower.includes('bus') && !titleLower.includes('airport')) {
      transportBase = 3;
    } else if (titleLower.includes('train') || titleLower.includes('rail')) {
      transportBase = 5;
    } else if (titleLower.includes('tram') || titleLower.includes('trolley') || titleLower.includes('streetcar')) {
      transportBase = 3;
    } else if (titleLower.includes('ferry') || titleLower.includes('boat') || titleLower.includes('water taxi')) {
      transportBase = 8;
    } else if (titleLower.includes('taxi') || titleLower.includes('cab')) {
      transportBase = 20;
    } else if (titleLower.includes('uber') || titleLower.includes('lyft') || titleLower.includes('rideshare') || titleLower.includes('ride')) {
      transportBase = 18;
    } else if (titleLower.includes('shuttle') || titleLower.includes('airport bus')) {
      transportBase = 12;
    } else if (titleLower.includes('private') || titleLower.includes('car service')) {
      transportBase = 40;
    } else {
      const viaMatch = titleLower.match(/via\s+(.+)/);
      if (viaMatch) {
        const viaMode = viaMatch[1];
        if (/\d\s*(train|line|metro|subway)/.test(viaMode) || /line\s*\d/.test(viaMode)) {
          transportBase = 3;
        } else if (/bus|route/.test(viaMode)) {
          transportBase = 3;
        } else if (/taxi|cab|uber|lyft/.test(viaMode)) {
          transportBase = 20;
        } else {
          transportBase = 5;
        }
      } else {
        transportBase = 5;
      }
    }

    const isPublicTransit = transportBase <= 8;
    const transitMultiplier = isPublicTransit
      ? Math.min(costIndex.cost_multiplier, 1.3)
      : costIndex.cost_multiplier;
    const amount = Math.max(0, Math.round(transportBase * transitMultiplier));

    return {
      amount,
      currency: 'USD',
      isEstimated: true,
      confidence: isPublicTransit ? 'medium' as const : 'low' as const,
      source: 'category_estimate' as const,
      reason: `Estimated ${isPublicTransit ? 'public transit' : 'private transport'} fare in ${destinationName}`,
    };
  }

  // Try to infer meal type from title if category is generic "dining"
  let baseField: keyof CostIndex;
  if (normalizedCategory === 'dining' && params.title) {
    baseField = inferMealTypeFromTitle(params.title) || CATEGORY_TO_BASE_FIELD[normalizedCategory] || 'activity_base_usd';
  } else {
    baseField = CATEGORY_TO_BASE_FIELD[normalizedCategory] || 'activity_base_usd';
  }
  const basePrice = (costIndex[baseField] as number) || DEFAULT_BASE_PRICES.activity_base_usd;
  
  const budgetMult = BUDGET_MULTIPLIERS[budgetTier] || 1.0;
  const perPerson = Math.max(5, Math.round(basePrice * budgetMult * costIndex.cost_multiplier));
  
  const isPerPerson = ['breakfast', 'brunch', 'lunch', 'dinner', 'dining', 'restaurant', 'coffee', 'cafe'].includes(normalizedCategory);
  const subtotal = isPerPerson ? perPerson * travelers : perPerson;
  
  const isDining = ['breakfast', 'brunch', 'lunch', 'dinner', 'dining', 'restaurant'].includes(normalizedCategory);
  const taxMultiplier = isDining ? (1 + costIndex.tax_tip_buffer) : 1.0;
  const total = Math.max(5, Math.round((subtotal * taxMultiplier) / 5) * 5);
  
  const confidence: 'high' | 'medium' | 'low' = 
    costIndex.confidence_score >= 0.8 ? 'high' :
    costIndex.confidence_score >= 0.6 ? 'medium' : 'low';
  
  let reason: string;
  if (isDining) {
    reason = `~$${perPerson}/person for ${normalizedCategory} in ${destinationName}`;
  } else {
    reason = `Typical ${normalizedCategory} cost in ${destinationName}`;
  }
  
  return {
    amount: total,
    currency: 'USD',
    isEstimated: true,
    confidence,
    source: 'category_estimate',
    reason,
    perPerson: isPerPerson ? perPerson : undefined,
  };
}

// ============================================================================
// FREE PUBLIC VENUE DETECTOR
// ============================================================================

/**
 * Patterns that indicate a free public venue (parks, plazas, viewpoints, gardens, etc.)
 * Checked against combined text from title + location + description.
 */
const FREE_VENUE_PATTERNS = [
  // Portuguese
  /\bpra[çc]a\b/i, /\bmiradouro\b/i, /\bjardim\b/i, /\blargo\b/i, /\bparque\b/i,
  // Spanish
  /\bplaza\b/i, /\bmirador\b/i, /\bparque\b/i, /\bjard[ií]n\b/i,
  // English
  /\bsquare\b/i, /\bviewpoint\b/i, /\blookout\b/i, /\bgarden(?:s)?\b/i,
  /\bpark\b/i, /\bwaterfront\b/i, /\briverside\b/i, /\bpromenade\b/i,
  /\bboardwalk\b/i, /\bpier\b/i, /\bbeach\b/i,
  /\bneighborhood\s+(?:walk|stroll|explore)\b/i,
  /\bdistrict\s+(?:walk|stroll|explore)\b/i,
  /\bexplore\b.*\b(?:district|neighborhood|neighbourhood|quarter|old\s+town|area)\b/i,
  /\bstroll\b.*\b(?:district|neighborhood|neighbourhood|quarter)\b/i,
  /\b(?:walk|stroll)\s+(?:through|around|along)\b/i,
  // French
  /\bjardin\b/i, /\bplace\s+\w/i, /\besplanade\b/i,
  // Italian
  /\bpiazza\b/i, /\bgiardino\b/i,
  // Common free venue types
  /\bpublic\s+(?:square|garden|park|space)\b/i,
  /\bfree\s+(?:attraction|venue|entry)\b/i,
];

/**
 * Patterns that indicate a PAID venue — these override free-venue detection.
 */
const PAID_OVERRIDE_PATTERNS = [
  // Dining / bars
  /\b(?:breakfast|brunch|lunch|dinner|restaurant|café|cafe|coffee|bar|bistro|tapas|food|cocktail|nightcap)\b/i,
  // Ticketed attractions
  /\b(?:museum|monastery|palace|castle|tower|aquarium|zoo|show|concert|theater|theatre|ticket|admission|entrance|gallery)\b/i,
  // Wellness
  /\b(?:spa|wellness|massage|treatment|hammam|thermal|sauna)\b/i,
  // Transport
  /\b(?:airport|taxi|uber|rideshare|transfer|shuttle|train\s+to|bus\s+to|private\s+car)\b/i,
  // Tours / experiences
  /\b(?:guided\s+tour|boat\s+tour|cruise|cooking\s+class|workshop|tasting)\b/i,
];

/**
 * Detect whether an activity is a free public venue.
 * Checks combined text from all available fields.
 * Returns true for parks, plazas, viewpoints, gardens, etc.
 * Returns false for dining, ticketed, wellness, and transport activities.
 */
export function isLikelyFreePublicVenue(fields: {
  title?: string;
  category?: string;
  type?: string;
  locationName?: string;
  address?: string;
  description?: string;
}): boolean {
  const combined = [
    fields.title,
    fields.locationName,
    fields.address,
    fields.description,
  ].filter(Boolean).join(' ');

  if (!combined) return false;

  // Always-free activities: arrivals, departures, hotel logistics — bypass paid overrides
  const ALWAYS_FREE_ACTIVITY = /\b(?:arrival|departure|check[\s-]?in|check[\s-]?out|return\s+to|freshen\s+up|settle\s+in)\b/i;
  if (ALWAYS_FREE_ACTIVITY.test(fields.title || '')) return true;

  // Check paid overrides first — dining at a praça is still paid
  if (PAID_OVERRIDE_PATTERNS.some(p => p.test(combined))) return false;

  // Check category — dining/transport/etc categories are never free
  const cat = (fields.category || fields.type || '').toLowerCase();
  if (['dining', 'restaurant', 'breakfast', 'brunch', 'lunch', 'dinner',
       'cafe', 'coffee', 'transport', 'transfer', 'taxi', 'tour',
       'cruise', 'boat', 'spa', 'wellness', 'nightlife', 'bar', 'club',
       'museum', 'gallery', 'show', 'performance', 'concert'].includes(cat)) {
    return false;
  }

  // Check free venue patterns
  return FREE_VENUE_PATTERNS.some(p => p.test(combined));
}

/**
 * Pre-warm the cache (call early in app lifecycle)
 */
export async function preloadCostIndex(): Promise<void> {
  await initializeCache();
}

/**
 * Get raw cost index for a destination (for debugging)
 */
export async function getDestinationCostIndex(city?: string, country?: string): Promise<CostIndex> {
  return getCostIndex(city, country);
}
