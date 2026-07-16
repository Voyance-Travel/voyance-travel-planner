// Extracted from EditorialItinerary.tsx during the file-size decomposition.
// Cost estimation, currency conversion + per-activity/day cost resolution.
import type { EditorialActivity, EditorialDay } from '../EditorialItinerary';
import { convertToUSD } from '@/lib/currency';
import { estimateCostSync, isLikelyFreePublicVenue } from '@/lib/cost-estimation';
import { getLedgerOverride, warnOnceLedgerOverride } from '@/utils/ledgerCostOverride';
import { normalizeCurrencyCode } from './currency-utils';

// Smart cost estimation by category when no explicit cost is provided
// Base costs are per-person, will be multiplied by travelers
const CATEGORY_COST_ESTIMATES: Record<string, { base: number; budgetMod: Record<string, number> }> = {
  // Dining
  breakfast: { base: 18, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.8, splurge: 2.5 } },
  brunch: { base: 28, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.8, splurge: 2.5 } },
  lunch: { base: 22, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.8, splurge: 2.5 } },
  dinner: { base: 45, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.8, splurge: 2.5 } },
  dining: { base: 35, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.6, splurge: 2.2 } },
  coffee: { base: 8, budgetMod: { budget: 0.7, moderate: 1, luxury: 1.3, splurge: 1.5 } },
  cafe: { base: 12, budgetMod: { budget: 0.7, moderate: 1, luxury: 1.4, splurge: 1.8 } },
  // Activities
  museum: { base: 20, budgetMod: { budget: 0.8, moderate: 1, luxury: 1.2, splurge: 1.5 } },
  cultural: { base: 25, budgetMod: { budget: 0.7, moderate: 1, luxury: 1.3, splurge: 1.6 } },
  sightseeing: { base: 15, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.4, splurge: 1.8 } },
  tour: { base: 50, budgetMod: { budget: 0.5, moderate: 1, luxury: 1.6, splurge: 2.2 } },
  activity: { base: 30, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.5, splurge: 2.0 } },
  adventure: { base: 75, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.4, splurge: 1.8 } },
  // Relaxation
  spa: { base: 100, budgetMod: { budget: 0.5, moderate: 1, luxury: 1.8, splurge: 3.0 } },
  relaxation: { base: 40, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.6, splurge: 2.5 } },
  beach: { base: 10, budgetMod: { budget: 0.8, moderate: 1, luxury: 1.5, splurge: 2.0 } },
  // Shopping/Entertainment
  shopping: { base: 50, budgetMod: { budget: 0.4, moderate: 1, luxury: 2.0, splurge: 3.5 } },
  entertainment: { base: 40, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.5, splurge: 2.0 } },
  nightlife: { base: 60, budgetMod: { budget: 0.5, moderate: 1, luxury: 1.8, splurge: 2.5 } },
  // Transport/Other
  transportation: { base: 25, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.5, splurge: 2.0 } },
  transport: { base: 20, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.5, splurge: 2.0 } },
  accommodation: { base: 0, budgetMod: { budget: 1, moderate: 1, luxury: 1, splurge: 1 } }, // Usually bundled
};

export function estimateCostByCategory(
  category: string | undefined,
  travelers: number = 1,
  budgetTier: string = 'moderate'
): number {
  const cat = (category || 'activity').toLowerCase();
  
  // Find matching category (check for partial matches too)
  let estimate = CATEGORY_COST_ESTIMATES[cat];
  if (!estimate) {
    // Check for partial matches in title keywords
    for (const [key, val] of Object.entries(CATEGORY_COST_ESTIMATES)) {
      if (cat.includes(key) || key.includes(cat)) {
        estimate = val;
        break;
      }
    }
  }
  
  // Default fallback
  if (!estimate) {
    estimate = { base: 25, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.5, splurge: 2.0 } };
  }
  
  const budgetMultiplier = estimate.budgetMod[(budgetTier || 'moderate').toLowerCase()] || 1;
  const baseCost = estimate.base * budgetMultiplier;
  
  // Add 20% for tip/tax on dining categories
  const isDining = ['breakfast', 'brunch', 'lunch', 'dinner', 'dining', 'coffee', 'cafe'].includes(cat);
  const withTax = isDining ? baseCost * 1.2 : baseCost;
  
  // Multiply by travelers and round
  const total = withTax * travelers;
  const isTransportCategory = ['transportation', 'transport', 'transfer'].includes(cat);
  return isTransportCategory
    ? Math.round(total)        // Transport: round to nearest $1
    : Math.round(total / 5) * 5; // Everything else: round to nearest $5
}

export type CostBasis = 'per_person' | 'flat';

export interface CostInfo {
  amount: number;
  isEstimated: boolean;
  estimateReason?: string;
  confidence?: 'high' | 'medium' | 'low';
  basis: CostBasis;
}

/**
 * Get activity cost with defensible estimation using destination_cost_index
 * Uses synchronous version for immediate rendering - cache preloaded on component mount
 */
// Categories that should NEVER show as "Free" - always estimate if cost is 0
const NEVER_FREE_CATEGORIES = [
  'dining', 'restaurant', 'breakfast', 'brunch', 'lunch', 'dinner', 'cafe', 'coffee',
  'cruise', 'boat', 'tour', 'activity', 'experience', 'spa', 'massage', 'show',
  'performance', 'concert', 'theater', 'theatre', 'nightlife', 'bar', 'club',
  // Transport categories - airport transfers, taxis, etc. are never free
  'transfer', 'transport', 'transportation', 'airport', 'taxi', 'uber', 'rideshare',
  // Additional categories that should always have a cost
  'shopping', 'entertainment', 'cultural', 'attraction', 'museum', 'gallery',
  'market', 'cooking_class', 'workshop', 'adventure', 'excursion',
  'wine', 'tasting', 'snorkeling', 'diving', 'surfing', 'hiking_tour',
];

export function isNeverFreeCategory(category: string, title: string): boolean {
  const cat = (category || '').toLowerCase();
  const titleLower = (title || '').toLowerCase();
  
  // Check category
  if (NEVER_FREE_CATEGORIES.some(nfc => cat.includes(nfc))) return true;
  
  // Check title for dining/meal keywords
  const neverFreeKeywords = [
    'breakfast', 'brunch', 'lunch', 'dinner', 'cruise', 'tour',
    'restaurant', 'café', 'cafe', 'transfer', 'airport', 'taxi',
    'uber', 'private car', 'shuttle',
    // Removed: 'train to', 'bus to' — public transit CAN be free (day pass, included transfer)
  ];
  if (neverFreeKeywords.some(kw => titleLower.includes(kw))) {
    return true;
  }
  
  return false;
}

/** Flat-rate categories: cost covers the whole group, not per-person */
const FLAT_RATE_KEYWORDS = [
  'transfer', 'taxi', 'uber', 'rideshare', 'private car', 'shuttle',
  'car rental', 'rental car', 'private tour', 'private guide',
  'accommodation', 'hotel', 'check-in', 'check-out', 'checkout',
];

export function inferCostBasis(category: string, title: string): CostBasis {
  const cat = (category || '').toLowerCase();
  const t = (title || '').toLowerCase();
  // Explicit basis from backend
  if (FLAT_RATE_KEYWORDS.some(kw => cat.includes(kw) || t.includes(kw))) return 'flat';
  return 'per_person';
}

export function getActivityCostInfoImpl(
  activity: EditorialActivity,
  travelers: number = 1,
  budgetTier: string = 'moderate',
  destinationCity?: string,
  destinationCountry?: string,
  isManualMode: boolean = false
): CostInfo {
  const category = activity.category || activity.type || 'activity';
  const title = activity.title || '';
  
  // Walk connectors are always free — skip estimation entirely
  const catLower = (category || '').toLowerCase();
  const titleLower = (title || '').toLowerCase();
  const isWalk = ['walk', 'walking', 'stroll'].includes(catLower) ||
    /\bwalk\b|\bstroll\b|\bwalking\b/i.test(titleLower);
  if (isWalk) {
    // Walking is always free — override any AI-hallucinated cost
    return { amount: 0, isEstimated: false, confidence: 'high' as const, basis: 'flat' as CostBasis };
  }
  
  // Accommodation cards (check-in, checkout, freshen-up, return to hotel) are always Free
  // Hotel costs live in the Budget/Payments tabs — not on activity cards
  const isAccommodation = ['accommodation', 'hotel', 'stay'].includes(catLower) ||
    /check.?in|check.?out|checkout|freshen\s*up|return to .*(hotel|four|aman|ritz|hyatt|hilton|marriott|peninsula|mandarin|park|palace|st\.\s*regis|waldorf|conrad|w\s+hotel|shangri|intercontinental|westin|sheraton|fairmont|rosewood|banyan|six\s*senses|oberoi|taj\s|belmond)/i.test(titleLower);
  if (isAccommodation) {
    return { amount: 0, isEstimated: false, confidence: 'high' as const, basis: 'flat' as CostBasis };
  }
  
  // Free attractions — temples, shrines, gardens, crossings, parks, plazas, etc.
  // These should show "Free" instead of ~$50 estimation fallback
  const FREE_ATTRACTION_KEYWORDS = [
    'crossing', 'gardens', 'park', 'shrine', 'temple', 'plaza',
    'square', 'bridge', 'waterfront', 'promenade', 'boulevard',
    'viewpoint', 'lookout', 'market stroll', 'neighborhood walk',
    'imperial palace', 'east gardens', 'meiji jingu', 'senso-ji',
    'sensoji', 'fushimi inari', 'central park', 'hyde park',
  ];
  const looksLikelyFree = FREE_ATTRACTION_KEYWORDS.some(kw => titleLower.includes(kw)) &&
    ['sightseeing', 'explore', 'cultural', 'activity', 'attraction'].includes(catLower);
  
  // Also check the shared free-public-venue detector (catches praça, miradouro, jardim, etc.)
  const isFreePublicVenue = isLikelyFreePublicVenue({
    title,
    category,
    type: activity.type,
    locationName: activity.location?.name,
    address: activity.location?.address,
    description: (activity as any).description,
    venueName: (activity as any).venue_name,
    restaurantName: (activity as any).restaurant?.name,
    placeName: (activity as any).place_name,
  });

  if (isFreePublicVenue || (looksLikelyFree && !isNeverFreeCategory(category, title))) {
    return { amount: 0, isEstimated: false, confidence: 'medium' as const, basis: 'flat' as CostBasis };
  }
  
  const shouldNeverBeFree = isNeverFreeCategory(category, title);
  // Use explicit basis from backend if available, otherwise infer
  const basis: CostBasis = (activity as any).costBasis || (activity as any).cost?.basis || inferCostBasis(category, title);
  
  // Safely parse cost amount - handle null, NaN, undefined
  const rawCostAmount = activity.cost?.amount;
  const costAmount = (rawCostAmount !== null && rawCostAmount !== undefined && !isNaN(rawCostAmount))
    ? rawCostAmount : undefined;

  // Also check normalized root-level price fields preserved by the parser spread
  // These survive even when parseCost couldn't build a cost object
  const actAny = activity as any;
  const normalizedPrice = (() => {
    for (const field of ['price_per_person', 'estimated_price_per_person', 'price']) {
      const v = actAny[field];
      if (typeof v === 'number' && !isNaN(v)) return v;
    }
    return undefined;
  })();
  // If backend explicitly marked is_free, trust it
  if (actAny.is_free === true) {
    return { amount: 0, isEstimated: false, confidence: 'high' as const, basis: 'flat' as CostBasis };
  }
  
  // Ledger is the single source of truth: `activity_costs` is what Budget
  // and Payments read. Whenever a ledger row exists for this activity, the
  // card MUST display the ledger value so all three surfaces reconcile —
  // EXCEPT when the user authored / imported / booked the cost (their input
  // is authoritative) or we're in manual mode.
  // See mem://constraints/finance/displayed-trip-total-single-source.
  const ledgerOverride = getLedgerOverride((activity as any).id);
  const costBasisLower = String((activity as any).cost?.basis || '').toLowerCase();
  const isUserAuthored =
    (activity as any).costSource === 'imported' ||
    (activity as any).costSource === 'user_override' ||
    costBasisLower === 'user' ||
    costBasisLower === 'user_override' ||
    costBasisLower === 'booked' ||
    costBasisLower === 'imported';
  if (ledgerOverride && !isUserAuthored && !isManualMode) {
    const jsonbAmt = costAmount ?? 0;
    if (jsonbAmt > 0 && Math.abs(jsonbAmt - ledgerOverride.perPersonUsd) >= 1) {
      warnOnceLedgerOverride(String((activity as any).id), {
        jsonbAmount: jsonbAmt,
        ledgerAmount: ledgerOverride.perPersonUsd,
        source: ledgerOverride.source,
        title,
      });
    }
    return {
      amount: ledgerOverride.perPersonUsd,
      isEstimated: false,
      confidence: 'high' as const,
      basis: 'per_person' as CostBasis,
    };
  }

  // Check cost.amount first - this is explicit pricing from venue data
  // BUT if it's 0 and the category should never be free, fall through to estimation
  if (costAmount !== undefined && costAmount > 0) {
    const sourceCurrency = normalizeCurrencyCode(activity.cost?.currency) || 'USD';
    const amountUsd = sourceCurrency === 'USD' ? costAmount : convertToUSD(costAmount, sourceCurrency);
    return { amount: amountUsd, isEstimated: false, confidence: 'high', basis };
  }
  
  // If cost is explicitly 0 and source is imported/user-override, respect it as-is
  if (costAmount === 0 && ((activity as any).costSource === 'imported' || (activity as any).costSource === 'user_override')) {
    return { amount: 0, isEstimated: false, confidence: 'high', basis };
  }
  // In manual (Build It Myself) mode, trust user's data — never auto-estimate
  if (isManualMode && costAmount === 0) {
    return { amount: 0, isEstimated: false, confidence: 'high' as const, basis };
  }
  // If cost is explicitly 0 but category should never be free, skip to estimation
  if (costAmount === 0 && shouldNeverBeFree) {
    // Fall through to estimation engine below
  } else if (costAmount === 0) {
    // Truly free activity (parks, viewpoints, walking tours, etc.)
    return { amount: 0, isEstimated: false, confidence: 'high', basis };
  }

  // Check normalized root-level price fields (e.g. price_per_person: 0 from backend)
  if (normalizedPrice !== undefined && normalizedPrice === 0 && !shouldNeverBeFree) {
    return { amount: 0, isEstimated: false, confidence: 'high', basis };
  }
  if (normalizedPrice !== undefined && normalizedPrice > 0 && costAmount === undefined) {
    return { amount: normalizedPrice, isEstimated: false, confidence: 'medium', basis };
  }
  
  // Check estimatedCost - AI-provided estimate during generation
  const rawEstAmount = activity.estimatedCost?.amount;
  const estAmount = (rawEstAmount !== null && rawEstAmount !== undefined && !isNaN(rawEstAmount))
    ? rawEstAmount : undefined;
    
  if (estAmount !== undefined && estAmount > 0) {
    const sourceCurrency = normalizeCurrencyCode(activity.estimatedCost?.currency) || 'USD';
    const amountUsd = sourceCurrency === 'USD' ? estAmount : convertToUSD(estAmount, sourceCurrency);
    return { 
      amount: amountUsd, 
      isEstimated: true,
      estimateReason: 'AI-estimated based on venue type',
      confidence: 'medium',
      basis,
    };
  }
  
  // If estimatedCost is 0 but should never be free, fall through
  if (estAmount === 0 && shouldNeverBeFree) {
    // Fall through to estimation engine below
  } else if (estAmount === 0) {
    return { amount: 0, isEstimated: true, estimateReason: 'No cost expected', confidence: 'medium', basis };
  }
  
  // Use defensible cost estimation engine
  const priceLevel = (activity as any).priceLevel || (activity as any).price_level;
  
  const result = estimateCostSync({
    category,
    title, // Pass title for meal type inference (breakfast vs dinner)
    city: destinationCity,
    country: destinationCountry,
    travelers,
    budgetTier: budgetTier as 'budget' | 'moderate' | 'luxury',
    priceLevel: priceLevel ? Number(priceLevel) : undefined,
  });
  
  // Safety net: if estimation returned 0 for a never-free category, use minimum fallback
  const amount = (result.amount === 0 && shouldNeverBeFree) ? Math.max(10, travelers * 5) : result.amount;

  // estimateCostSync already multiplies per-person dining categories by travelers
  // (see src/lib/cost-estimation.ts line 285). To keep cards in the same unit
  // as the day badge (which is per-person when travelers > 1), divide back to
  // per-person and tag basis as 'per_person' so the "/pp" suffix and the
  // "Group total: …" tooltip render correctly.
  const PER_PERSON_ENGINE_CATS = new Set([
    'dining', 'restaurant', 'breakfast', 'brunch', 'lunch', 'dinner', 'cafe', 'coffee'
  ]);
  const isPerPersonDining = PER_PERSON_ENGINE_CATS.has((category || '').toLowerCase());
  const finalAmount = isPerPersonDining
    ? Math.round(amount / Math.max(travelers, 1))
    : amount;
  const finalBasis: CostBasis = isPerPersonDining ? 'per_person' : basis;

  return {
    amount: finalAmount,
    isEstimated: result.isEstimated,
    estimateReason: result.reason || `Estimated for ${category} in ${destinationCity || 'this area'}`,
    confidence: result.confidence,
    basis: finalBasis,
  };
}

// Debug-only: gate per-activity card price resolution log behind
// localStorage.VOYANCE_PRICE_DEBUG === '1'. Reports the inputs (ledger, JSON cost,
// normalized price fields) alongside the final card amount/basis so we can see
// exactly which path produced each visible card price. One log line per
// (tripId, activityId) per session.
const __CARD_PRICE_LOGGED = new Set<string>();
export function __cardPriceDebugEnabled(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage?.getItem('VOYANCE_PRICE_DEBUG') === '1';
  } catch { return false; }
}
export function getActivityCostInfo(
  activity: EditorialActivity,
  travelers: number = 1,
  budgetTier: string = 'moderate',
  destinationCity?: string,
  destinationCountry?: string,
  isManualMode: boolean = false
): CostInfo {
  const info = getActivityCostInfoImpl(activity, travelers, budgetTier, destinationCity, destinationCountry, isManualMode);
  if (__cardPriceDebugEnabled()) {
    const a: any = activity;
    const id = String(a.id ?? '');
    const key = id || a.title || Math.random().toString(36);
    if (!__CARD_PRICE_LOGGED.has(key)) {
      __CARD_PRICE_LOGGED.add(key);
      const ledger = getLedgerOverride(id);
      // eslint-disable-next-line no-console
      console.info('[CARD_PRICE_RESOLVE]', {
        activityId: id,
        title: a.title,
        day: a.dayNumber ?? a.day_number,
        category: a.category,
        ledger: ledger ? { perPersonUsd: ledger.perPersonUsd, source: ledger.source } : null,
        jsonCost: { amount: a.cost?.amount, perPerson: a.cost?.perPerson, basis: a.cost?.basis, source: a.cost?.source },
        normalizedPriceFields: { price_per_person: a.price_per_person, estimated_price_per_person: a.estimated_price_per_person, price: a.price },
        finalCardAmount: info.amount,
        finalCardBasis: info.basis,
        isEstimated: info.isEstimated,
        travelers,
      });
    }
  }
  return info;
}



/** Short label for cost basis — always "/pp" for multi-guest trips for consistency */
export function basisLabel(basis: CostBasis, travelers: number): string {
  if (travelers <= 1) return '';
  return '/pp';
}

export function getActivityCost(
  activity: EditorialActivity,
  travelers: number = 1,
  budgetTier: string = 'moderate',
  destinationCity?: string,
  destinationCountry?: string,
  isManualMode: boolean = false
): number {
  return getActivityCostInfo(activity, travelers, budgetTier, destinationCity, destinationCountry, isManualMode).amount;
}


export function getDayTotalCost(
  activities: EditorialActivity[], 
  travelers: number = 1, 
  budgetTier: string = 'moderate',
  destinationCity?: string,
  destinationCountry?: string,
  isManualMode: boolean = false
): number {
  // Sum the SAME amount shown on each activity card — estimates included — so
  // the day total matches the visible per-activity prices. (Previously
  // confirmed-only via `isEstimated ? 0`, which made the badge diverge from the
  // cards: $35 total next to ~$139 of shown prices. getActivityCostInfo already
  // applies the ledger override when a booking exists, so booked items still sum
  // at their confirmed value.)
  return activities.reduce((sum, act) => {
    const info = getActivityCostInfo(act, travelers, budgetTier, destinationCity, destinationCountry, isManualMode);
    return sum + (info.amount || 0);
  }, 0);
}
