// ============================================================
// User Lifecycle Cost Model - From Site Visit to Power User
// Based on docs/PRICE_SHEET.md - ACCURATE input/output tracking
// Last Updated: February 2026
// ============================================================

// ============================================================================
// LOVABLE AI GATEWAY PRICING (per 1k tokens)
// Source: Lovable AI Gateway docs
// ============================================================================

export const AI_MODEL_PRICING = {
  // OpenAI Models
  'openai/gpt-5': { 
    inputPer1k: 0.01, 
    outputPer1k: 0.03,
    useCase: 'Full itinerary generation - complex multi-day trips'
  },
  'openai/gpt-5-mini': { 
    inputPer1k: 0.0004, 
    outputPer1k: 0.0016,
    useCase: 'DNA calculation, day regeneration, activity swaps, chat'
  },
  'openai/gpt-5-nano': { 
    inputPer1k: 0.00015, 
    outputPer1k: 0.0006,
    useCase: 'Simple classification, summaries'
  },
  
  // Google Models
  'google/gemini-2.5-flash': { 
    inputPer1k: 0.0001, 
    outputPer1k: 0.0004,
    useCase: 'Quick preview, fast enrichment, roast itinerary'
  },
  'google/gemini-2.5-flash-lite': { 
    inputPer1k: 0.00005, 
    outputPer1k: 0.0002,
    useCase: 'Simple tasks, classification'
  },
  'google/gemini-2.5-pro': { 
    inputPer1k: 0.005, 
    outputPer1k: 0.015,
    useCase: 'Complex reasoning, multimodal'
  },
} as const;

// ============================================================================
// FEATURE-LEVEL AI COSTS
// Tokens estimated from actual edge function implementations
// ============================================================================

export const AI_FEATURE_COSTS = {
  // ========== ENTRY POINT FEATURES (Pre-signup) ==========
  quick_preview: {
    name: 'Quick Preview (3-day teaser)',
    model: 'google/gemini-2.5-flash',
    inputTokens: { min: 500, max: 1000 },
    outputTokens: { min: 200, max: 500 },
    costRange: { min: 0.003, max: 0.01 },
    triggeredBy: 'Plan a Trip CTA on homepage',
  },
  analyze_itinerary: {
    name: 'Roast My Itinerary',
    model: 'google/gemini-2.5-flash',
    inputTokens: { min: 500, max: 1000 },
    outputTokens: { min: 500, max: 800 },
    costRange: { min: 0.003, max: 0.01 },
    triggeredBy: 'Fix My Itinerary CTA on homepage',
  },
  
  // ========== TRAVEL DNA (One-time per user) ==========
  travel_dna: {
    name: 'Travel DNA Calculation',
    model: 'openai/gpt-5-mini',
    inputTokens: { min: 500, max: 1500 },
    outputTokens: { min: 300, max: 800 },
    costRange: { min: 0.01, max: 0.03 },
    triggeredBy: 'Complete 21-question quiz',
    notes: 'Includes archetype matching, trait scoring, personality summary',
  },
  
  // ========== ITINERARY GENERATION (Credit-based) ==========
  full_itinerary: {
    name: 'Full Itinerary Generation',
    model: 'openai/gpt-5',
    inputTokens: { min: 8000, max: 25000 },
    outputTokens: { min: 6000, max: 15000 },
    costRange: { min: 0.15, max: 0.60 },
    triggeredBy: 'Generate trip after paying/using credits',
    notes: 'Includes personalization enforcer, geographic coherence, venue verification',
  },
  day1_only: {
    name: 'Day 1 Only (Free tier)',
    model: 'openai/gpt-5',
    inputTokens: { min: 3000, max: 6000 },
    outputTokens: { min: 1500, max: 3000 },
    costRange: { min: 0.03, max: 0.08 },
    triggeredBy: 'Free user starts trip planning',
    notes: 'Reduced cost vs full trip - only generates Day 1',
  },
  
  // ========== ITINERARY MODIFICATIONS (Credit-based) ==========
  regenerate_day: {
    name: 'Regenerate Single Day',
    model: 'openai/gpt-5-mini',
    inputTokens: { min: 2000, max: 5000 },
    outputTokens: { min: 2000, max: 4000 },
    costRange: { min: 0.02, max: 0.08 },
    creditsCharged: 15,
    triggeredBy: 'User regenerates a day in their itinerary',
  },
  swap_activity: {
    name: 'Swap Single Activity',
    model: 'openai/gpt-5-mini',
    inputTokens: { min: 1000, max: 2000 },
    outputTokens: { min: 500, max: 1000 },
    costRange: { min: 0.005, max: 0.02 },
    creditsCharged: 5,
    triggeredBy: 'User swaps one activity for alternative',
  },
  restaurant_recommendation: {
    name: 'Restaurant Recommendation',
    model: 'openai/gpt-5-mini',
    inputTokens: { min: 1000, max: 3000 },
    outputTokens: { min: 500, max: 1500 },
    costRange: { min: 0.01, max: 0.04 },
    creditsCharged: 10,
    triggeredBy: 'User requests restaurant for meal slot',
  },
  itinerary_chat: {
    name: 'AI Chat Message',
    model: 'openai/gpt-5-mini',
    inputTokens: { min: 500, max: 2000 },
    outputTokens: { min: 200, max: 800 },
    costRange: { min: 0.005, max: 0.02 },
    creditsCharged: 2,
    triggeredBy: 'User sends message in itinerary chat',
  },
  
  // ========== OTHER AI FEATURES ==========
  mystery_trip: {
    name: 'Mystery Trip Suggestion',
    model: 'openai/gpt-5-mini',
    inputTokens: { min: 1000, max: 3000 },
    outputTokens: { min: 1000, max: 2000 },
    costRange: { min: 0.01, max: 0.04 },
    triggeredBy: 'User requests mystery destination',
  },
  parse_story: {
    name: 'Parse Travel Story',
    model: 'openai/gpt-5-mini',
    inputTokens: { min: 500, max: 2000 },
    outputTokens: { min: 500, max: 1000 },
    costRange: { min: 0.005, max: 0.02 },
    triggeredBy: 'User pastes travel story text',
  },
  explain_recommendation: {
    name: 'Explain Why This',
    model: 'openai/gpt-5-mini',
    inputTokens: { min: 300, max: 800 },
    outputTokens: { min: 200, max: 500 },
    costRange: { min: 0.002, max: 0.008 },
    triggeredBy: 'User clicks "Why this?" on activity',
  },
} as const;

// ============================================================================
// EXTERNAL API COSTS
// ============================================================================

export const EXTERNAL_API_COSTS = {
  // Google APIs ($200/mo free credit)
  google_places_search: {
    costPer1k: 17.00,
    freeCredit: 200, // $200/mo = ~11,700 calls before charges
    avgCallsPerTrip: 5,
    notes: 'Text Search + Place Details for venue verification',
  },
  google_places_photo: {
    costPer1k: 7.00,
    avgCallsPerTrip: 3,
    notes: 'Photo retrieval for activities',
  },
  google_routes: {
    costPer1k: 5.00,
    avgCallsPerTrip: 5,
    notes: 'Route optimization per day',
  },
  google_geocoding: {
    costPer1k: 5.00,
    avgCallsPerTrip: 2,
    notes: 'Address resolution',
  },
  
  // Amadeus (Free tier: 2,000 calls/mo per endpoint)
  amadeus_flights: {
    freeTier: 2000,
    paidCostPerCall: 0.01,
    notes: 'Flight offers search - usually within free tier',
  },
  amadeus_hotels: {
    freeTier: 2000,
    paidCostPerCall: 0.01,
    notes: 'Hotel list + offers - usually within free tier',
  },
  
  // Free APIs
  open_meteo: { cost: 0, notes: 'Weather + geocoding - completely free' },
  viator: { cost: 0, notes: 'Activity search - free, earns 8-10% affiliate' },
  foursquare: { cost: 0, freeTier: 950, notes: '950 calls/day free' },
  pexels: { cost: 0, notes: 'Photo fallback - free' },
  wikimedia: { cost: 0, notes: 'Photo fallback - free' },
  tripadvisor: { cost: 0, notes: 'Photo fallback - basic tier free' },
  
  // Perplexity (via connector)
  perplexity: {
    costPerCall: 0.005,
    notes: 'Destination intelligence, travel advisories',
  },
} as const;

// ============================================================================
// USER LIFECYCLE COST MODEL
// ============================================================================

export interface UserJourneyCost {
  stage: string;
  description: string;
  actions: {
    name: string;
    probability: number; // 0-1, likelihood user does this
    costMin: number;
    costMax: number;
    notes?: string;
  }[];
  totalCostMin: number;
  totalCostMax: number;
}

// Anonymous visitor who never signs up
export const BOUNCE_USER_COST: UserJourneyCost = {
  stage: 'Bounce (No Signup)',
  description: 'User visits homepage, maybe clicks around, leaves without account',
  actions: [
    { name: 'View Homepage', probability: 1.0, costMin: 0, costMax: 0 },
    { name: 'Quick Preview (maybe)', probability: 0.3, costMin: 0.003 * 0.3, costMax: 0.01 * 0.3 },
  ],
  totalCostMin: 0.001,
  totalCostMax: 0.003,
};

// User signs up but never purchases
export const FREE_USER_COST: UserJourneyCost = {
  stage: 'Free User (No Purchase)',
  description: 'User signs up, takes DNA quiz, generates Day 1 preview, never pays',
  actions: [
    { name: 'Quick Preview', probability: 0.8, costMin: 0.003, costMax: 0.01, notes: 'Before signup' },
    { name: 'Travel DNA Quiz', probability: 0.9, costMin: 0.01, costMax: 0.03 },
    { name: 'Day 1 Generation', probability: 0.7, costMin: 0.03, costMax: 0.08, notes: 'Free credits used' },
    { name: 'Flight Search', probability: 0.4, costMin: 0, costMax: 0.05, notes: 'Within Amadeus free tier' },
    { name: 'Weather Lookup', probability: 0.5, costMin: 0, costMax: 0 },
  ],
  totalCostMin: 0.04,
  totalCostMax: 0.16,
};

// User makes one purchase (single trip pass)
export const SINGLE_PURCHASE_USER_COST: UserJourneyCost = {
  stage: 'Single Trip Pass User',
  description: 'User buys one trip pass ($12-29), uses it for one trip',
  actions: [
    { name: 'Travel DNA Quiz', probability: 1.0, costMin: 0.01, costMax: 0.03 },
    { name: 'Full Itinerary (5 days)', probability: 1.0, costMin: 0.15, costMax: 0.60 },
    { name: 'Venue Verification (Google)', probability: 1.0, costMin: 0.05, costMax: 0.10 },
    { name: 'Day Regenerations (2x)', probability: 0.6, costMin: 0.04, costMax: 0.16 },
    { name: 'Activity Swaps (3x)', probability: 0.5, costMin: 0.015, costMax: 0.06 },
    { name: 'Restaurant Recs (2x)', probability: 0.4, costMin: 0.02, costMax: 0.08 },
    { name: 'AI Chat (5x)', probability: 0.3, costMin: 0.025, costMax: 0.10 },
    { name: 'Route Optimization', probability: 0.7, costMin: 0.005, costMax: 0.015 },
    { name: 'Flight Search', probability: 0.5, costMin: 0, costMax: 0.05 },
    { name: 'Hotel Search', probability: 0.4, costMin: 0, costMax: 0.05 },
  ],
  totalCostMin: 0.30,
  totalCostMax: 1.25,
};

// Repeat user (multiple trips)
export const REPEAT_USER_COST: UserJourneyCost = {
  stage: 'Repeat User (3 Trips/Year)',
  description: 'User returns, generates 3 trips per year',
  actions: [
    { name: 'Travel DNA Quiz (once)', probability: 1.0, costMin: 0.01, costMax: 0.03 },
    { name: 'Full Itineraries (3x)', probability: 1.0, costMin: 0.45, costMax: 1.80 },
    { name: 'Venue Verification (3x)', probability: 1.0, costMin: 0.15, costMax: 0.30 },
    { name: 'Day Regenerations (6x)', probability: 0.7, costMin: 0.12, costMax: 0.48 },
    { name: 'Activity Swaps (10x)', probability: 0.6, costMin: 0.05, costMax: 0.20 },
    { name: 'Restaurant Recs (6x)', probability: 0.5, costMin: 0.06, costMax: 0.24 },
    { name: 'AI Chat (15x)', probability: 0.4, costMin: 0.075, costMax: 0.30 },
    { name: 'Route Optimization (3x)', probability: 0.8, costMin: 0.015, costMax: 0.045 },
  ],
  totalCostMin: 0.92,
  totalCostMax: 3.40,
};

// Power user / heavy usage
export const POWER_USER_COST: UserJourneyCost = {
  stage: 'Power User (10 Trips/Year)',
  description: 'Heavy user, generates 10+ trips, uses all features extensively',
  actions: [
    { name: 'Travel DNA Quiz (once)', probability: 1.0, costMin: 0.01, costMax: 0.03 },
    { name: 'Full Itineraries (10x)', probability: 1.0, costMin: 1.50, costMax: 6.00 },
    { name: 'Venue Verification (10x)', probability: 1.0, costMin: 0.50, costMax: 1.00 },
    { name: 'Day Regenerations (20x)', probability: 0.8, costMin: 0.40, costMax: 1.60 },
    { name: 'Activity Swaps (30x)', probability: 0.7, costMin: 0.15, costMax: 0.60 },
    { name: 'Restaurant Recs (20x)', probability: 0.6, costMin: 0.20, costMax: 0.80 },
    { name: 'AI Chat (50x)', probability: 0.5, costMin: 0.25, costMax: 1.00 },
    { name: 'Route Optimization (10x)', probability: 0.9, costMin: 0.05, costMax: 0.15 },
    { name: 'Mystery Trips (5x)', probability: 0.3, costMin: 0.05, costMax: 0.20 },
  ],
  totalCostMin: 3.11,
  totalCostMax: 11.38,
};

// ============================================================================
// CREDIT ECONOMICS
// Maps credits → actual $ cost to serve
// ============================================================================

export const CREDIT_TO_COST_MAPPING = {
  trip_generation: { credits: 0, costMin: 0.15, costMax: 0.60, notes: 'Variable - includes AI generation + verification' },
  swap_activity: { credits: 15, costMin: 0.005, costMax: 0.02 },
  regenerate_day: { credits: 90, costMin: 0.02, costMax: 0.08 },
  hotel_search: { credits: 40, costMin: 0.01, costMax: 0.05, notes: 'Per city' },
} as const;

// Calculate cost per credit (for margin analysis)
export function calculateCostPerCredit(): { min: number; max: number; avg: number } {
  const actions = Object.values(CREDIT_TO_COST_MAPPING);
  let totalCredits = 0;
  let totalCostMin = 0;
  let totalCostMax = 0;
  
  for (const action of actions) {
    totalCredits += action.credits;
    totalCostMin += action.costMin;
    totalCostMax += action.costMax;
  }
  
  return {
    min: totalCostMin / totalCredits,
    max: totalCostMax / totalCredits,
    avg: ((totalCostMin + totalCostMax) / 2) / totalCredits,
  };
}

// ============================================================================
// REVENUE VS COST ANALYSIS
// ============================================================================

export const CREDIT_PACK_ECONOMICS = [
  {
    name: 'Top-Up',
    credits: 50,
    price: 5.00,
    stripeFee: 5.00 * 0.029 + 0.30,
    netRevenue: 5.00 - (5.00 * 0.029 + 0.30),
    estimatedCost: { min: 0.05, max: 0.20 },
    get grossProfit() { return { min: this.netRevenue - this.estimatedCost.max, max: this.netRevenue - this.estimatedCost.min }; },
  },
  {
    name: 'Single Trip',
    credits: 200,
    price: 12.00,
    stripeFee: 12.00 * 0.029 + 0.30,
    netRevenue: 12.00 - (12.00 * 0.029 + 0.30),
    estimatedCost: { min: 0.20, max: 0.80 },
    get grossProfit() { return { min: this.netRevenue - this.estimatedCost.max, max: this.netRevenue - this.estimatedCost.min }; },
  },
  {
    name: 'Starter',
    credits: 500,
    price: 29.00,
    stripeFee: 29.00 * 0.029 + 0.30,
    netRevenue: 29.00 - (29.00 * 0.029 + 0.30),
    estimatedCost: { min: 0.50, max: 2.00 },
    get grossProfit() { return { min: this.netRevenue - this.estimatedCost.max, max: this.netRevenue - this.estimatedCost.min }; },
  },
  {
    name: 'Explorer',
    credits: 1200,
    price: 55.00,
    stripeFee: 55.00 * 0.029 + 0.30,
    netRevenue: 55.00 - (55.00 * 0.029 + 0.30),
    estimatedCost: { min: 1.20, max: 4.80 },
    get grossProfit() { return { min: this.netRevenue - this.estimatedCost.max, max: this.netRevenue - this.estimatedCost.min }; },
  },
  {
    name: 'Adventurer',
    credits: 2500,
    price: 89.00,
    stripeFee: 89.00 * 0.029 + 0.30,
    netRevenue: 89.00 - (89.00 * 0.029 + 0.30),
    estimatedCost: { min: 2.50, max: 10.00 },
    get grossProfit() { return { min: this.netRevenue - this.estimatedCost.max, max: this.netRevenue - this.estimatedCost.min }; },
  },
] as const;

// ============================================================================
// EXPECTED LOSS PER USER TYPE
// ============================================================================

export function calculateExpectedLossPerUser() {
  // Weighted average based on expected user distribution
  const distribution = {
    bounce: { pct: 0.60, cost: (BOUNCE_USER_COST.totalCostMin + BOUNCE_USER_COST.totalCostMax) / 2 },
    free: { pct: 0.25, cost: (FREE_USER_COST.totalCostMin + FREE_USER_COST.totalCostMax) / 2 },
    single: { pct: 0.10, cost: (SINGLE_PURCHASE_USER_COST.totalCostMin + SINGLE_PURCHASE_USER_COST.totalCostMax) / 2 },
    repeat: { pct: 0.04, cost: (REPEAT_USER_COST.totalCostMin + REPEAT_USER_COST.totalCostMax) / 2 },
    power: { pct: 0.01, cost: (POWER_USER_COST.totalCostMin + POWER_USER_COST.totalCostMax) / 2 },
  };
  
  let weightedCost = 0;
  for (const segment of Object.values(distribution)) {
    weightedCost += segment.pct * segment.cost;
  }
  
  return {
    blendedCostPerVisitor: weightedCost,
    bySegment: distribution,
    notes: '60% bounce, 25% free, 10% single purchase, 4% repeat, 1% power user',
  };
}

// ============================================================================
// SUMMARY METRICS
// ============================================================================

export const LIFECYCLE_SUMMARY = {
  // Per-visitor metrics
  costPerBounce: '$0.001 - $0.003',
  costPerFreeUser: '$0.04 - $0.16',
  costPerPaidUser: '$0.30 - $1.25',
  costPerPowerUser: '$3.11 - $11.38',
  
  // Revenue metrics
  avgRevenuePerPaidUser: '$29 - $55',
  grossMargin: '93% - 98%',
  
  // Key ratios
  conversionRequired: '2-5% of visitors must pay to break even',
  creditCostRatio: '~$0.001 - $0.004 per credit consumed',
} as const;
