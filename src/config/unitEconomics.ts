// ============================================================
// Unit Economics Configuration - Admin Dashboard
// ACCURATE cost tracking based on docs/PRICE_SHEET.md
// Last Updated: February 2026
// ============================================================

// ============================================================================
// FIXED MONTHLY COSTS
// These are what we ACTUALLY pay, not what's "included" or "free tier"
// ============================================================================

export const FIXED_COSTS = [
  // Platform
  { 
    name: 'Lovable Subscription', 
    cost: 25.00, 
    frequency: 'monthly',
    note: 'Pro plan - includes Cloud, hosting, edge functions',
    category: 'platform',
  },
  { 
    name: 'Custom Domain', 
    cost: 4.08, // $49/year ÷ 12
    frequency: 'monthly',
    note: '$49/year amortized',
    category: 'platform',
  },
  { 
    name: 'GitHub', 
    cost: 0, 
    frequency: 'monthly',
    note: 'Free tier (Team would be $4/user/mo)',
    category: 'platform',
  },
  // Email - Zoho Mail free tier
  { 
    name: 'Zoho Mail', 
    cost: 0, 
    frequency: 'monthly',
    note: 'Free tier: 50 emails/day via SMTP',
    category: 'email',
  },
  // Google Cloud - $200/mo free credit
  { 
    name: 'Google Cloud Credit', 
    cost: 0, 
    frequency: 'monthly',
    note: '$200/mo free credit - monitor usage!',
    category: 'api',
  },
] as const;

// Calculate total fixed monthly cost
export const TOTAL_FIXED_MONTHLY = FIXED_COSTS.reduce((sum, c) => sum + c.cost, 0);

// ============================================================================
// VARIABLE COSTS - AI (Lovable AI Gateway)
// From docs/PRICE_SHEET.md Section 2
// See also: src/config/userLifecycleCosts.ts for detailed per-feature breakdown
// ============================================================================

export const AI_COSTS = {
  // Model pricing (per 1k tokens)
  models: {
    'openai/gpt-5': { input: 0.01, output: 0.03, useCase: 'Full itinerary generation' },
    'openai/gpt-5-mini': { input: 0.0004, output: 0.0016, useCase: 'DNA, swaps, chat, regeneration' },
    'openai/gpt-5-nano': { input: 0.00015, output: 0.0006, useCase: 'Simple classification' },
    'google/gemini-2.5-flash': { input: 0.0001, output: 0.0004, useCase: 'Quick preview, roast' },
    'google/gemini-2.5-flash-lite': { input: 0.00005, output: 0.0002, useCase: 'Simple tasks' },
    'google/gemini-2.5-pro': { input: 0.005, output: 0.015, useCase: 'Complex reasoning' },
  },
  
  // Per-feature costs (from PRICE_SHEET.md)
  features: {
    // Pre-signup (free to user, cost to us)
    quick_preview: { min: 0.003, max: 0.01, model: 'gemini-2.5-flash', desc: '3-day teaser on homepage' },
    analyze_itinerary: { min: 0.003, max: 0.01, model: 'gemini-2.5-flash', desc: 'Roast existing itinerary' },
    
    // One-time per user
    travel_dna: { min: 0.01, max: 0.03, model: 'gpt-5-mini', desc: 'Calculate DNA from 21-question quiz' },
    
    // Credit-based (paid features)
    full_itinerary: { min: 0.15, max: 0.60, model: 'gpt-5', desc: 'Full trip generation (5 days)' },
    day1_only: { min: 0.03, max: 0.08, model: 'gpt-5', desc: 'Day 1 only for free users' },
    day_regeneration: { min: 0.02, max: 0.08, model: 'gpt-5-mini', desc: 'Regenerate single day (15 credits)' },
    activity_swap: { min: 0.005, max: 0.02, model: 'gpt-5-mini', desc: 'Swap one activity (5 credits)' },
    restaurant_rec: { min: 0.01, max: 0.04, model: 'gpt-5-mini', desc: 'Restaurant recommendation (10 credits)' },
    itinerary_chat: { min: 0.005, max: 0.02, model: 'gpt-5-mini', desc: 'AI chat message (2 credits)' },
    mystery_trip: { min: 0.01, max: 0.04, model: 'gpt-5-mini', desc: 'Mystery destination suggestion' },
    parse_story: { min: 0.005, max: 0.02, model: 'gpt-5-mini', desc: 'Parse travel story text' },
    explain_recommendation: { min: 0.002, max: 0.008, model: 'gpt-5-mini', desc: 'Why this activity?' },
  },
} as const;

// ============================================================================
// VARIABLE COSTS - External APIs
// From docs/PRICE_SHEET.md Section 3
// ============================================================================

export const EXTERNAL_API_COSTS = {
  // Amadeus (free tier: 2,000 calls/mo per endpoint)
  amadeus: {
    flight_search: { cost: 0, freeTier: 2000, paidCost: 0.01, desc: 'Flight offers search' },
    hotel_list: { cost: 0, freeTier: 2000, paidCost: 0.01, desc: 'Hotel list by city' },
    hotel_offers: { cost: 0, freeTier: 2000, paidCost: 0.01, desc: 'Hotel price offers' },
  },
  
  // Google APIs ($200/mo free credit)
  google: {
    places_text_search: { costPer1k: 17.00, desc: 'Text Search (New)' },
    places_details: { costPer1k: 17.00, desc: 'Place Details' },
    places_photo: { costPer1k: 7.00, desc: 'Photo Media' },
    routes: { costPer1k: 5.00, desc: 'Routes API' },
    geocoding: { costPer1k: 5.00, desc: 'Geocoding' },
    static_maps: { costPer1k: 2.00, desc: 'Static Maps' },
  },
  
  // Free APIs
  openMeteo: { cost: 0, desc: 'Weather & geocoding - completely free' },
  viator: { cost: 0, desc: 'Activity search - free, earns 8-10% affiliate commission' },
  foursquare: { cost: 0, freeTier: 950, desc: '950 calls/day free' },
  
  // Usage-based
  perplexity: { costPerCall: 0.005, desc: 'Destination intelligence, travel advisories' },
  
  // Photo fallbacks (tiered system)
  tripadvisor: { cost: 0, desc: 'Photo fallback - basic tier free' },
  pexels: { cost: 0, desc: 'Photo fallback - free' },
  wikimedia: { cost: 0, desc: 'Photo fallback - free' },
  lovable_ai_image: { min: 0.01, max: 0.05, desc: 'AI image generation - last resort' },
} as const;

// ============================================================================
// USER LIFECYCLE COSTS (Summary)
// Full details in src/config/userLifecycleCosts.ts
// ============================================================================

export const USER_LIFECYCLE_COSTS = {
  bounce: { min: 0.001, max: 0.003, desc: 'Visitor who leaves without signup' },
  freeUser: { min: 0.34, max: 0.41, desc: 'One-time acquisition: free 3-day trip + up to 5 edits. Subsequent trips: $0.03 each (locked preview)' },
  singlePurchase: { min: 0.30, max: 1.25, desc: 'Buys one credit pack' },
  repeatUser: { min: 0.92, max: 3.40, desc: '3 trips per year' },
  powerUser: { min: 3.11, max: 11.38, desc: '10+ trips per year' },
} as const;

// Blended cost per visitor (weighted by distribution)
// 60% bounce, 25% free (one-time acquisition amortized), 10% single, 4% repeat, 1% power
export const BLENDED_COST_PER_VISITOR = 
  0.60 * ((0.001 + 0.003) / 2) +
  0.25 * ((0.34 + 0.41) / 2) +  // One-time acquisition cost (not recurring per trip)
  0.10 * ((0.30 + 1.25) / 2) +
  0.04 * ((0.92 + 3.40) / 2) +
  0.01 * ((3.11 + 11.38) / 2);
// ≈ $0.26 per visitor on average (acquisition-weighted, not recurring)

// ============================================================================
// CREDIT SYSTEM COSTS
// Maps credit actions to actual $ cost
// ============================================================================

export const CREDIT_ACTION_MAPPING = {
  trip_generation: { credits: 0, costMin: 0.15, costMax: 0.60, desc: 'Full trip generation (variable)' },
  unlock_day: { credits: 150, costMin: 0.06, costMax: 0.15, desc: 'Unlock full day details' },
  swap_activity: { credits: 10, costMin: 0.005, costMax: 0.02, desc: 'Swap an activity' },
  regenerate_day: { credits: 20, costMin: 0.02, costMax: 0.08, desc: 'Regenerate a day' },
  restaurant_rec: { credits: 15, costMin: 0.01, costMax: 0.04, desc: 'Restaurant recommendation' },
  ai_message: { credits: 10, costMin: 0.005, costMax: 0.02, desc: 'AI companion message' },
  hotel_search: { credits: 40, costMin: 0.01, costMax: 0.05, desc: 'Hotel search per city' },
} as const;

// ============================================================================
// REVENUE / PRICING
// From docs/PRICE_SHEET.md Section 6
// ============================================================================

export const REVENUE_CONFIG = {
  // Current products (active in Stripe)
  creditPacks: {
    boost: { credits: 100, price: 8.99, stripeProductId: 'prod_TvoDemv6UvLUc4' },
    single: { credits: 200, price: 15.99, stripeProductId: 'prod_TuvcrwliHJ0mph' },
    weekend: { credits: 500, price: 29.99, stripeProductId: 'prod_Tuvc6zstLq6b4V' },
    explorer: { credits: 1200, price: 65.99, stripeProductId: 'prod_TvoD2IYQGay8FB' },
    adventurer: { credits: 2500, price: 99.99, stripeProductId: 'prod_TuvcYuWNk7Tayn' },
  },
  
  // Legacy (deprecated but still in DB)
  legacy: {
    tripPass: { price: 24.99, deprecated: true },
    monthly: { price: 15.99, deprecated: true },
    yearly: { price: 129.00, deprecated: true },
  },
  
  // Stripe fees
  stripeFees: {
    percentage: 0.029, // 2.9%
    fixed: 0.30, // $0.30 per transaction
  },
  
  // Conversion funnel:
  // 1. First trip: bypasses credits (full 3-day enriched, one-time)
  // 2. Subsequent trips: Day 1 preview always free (AI-only, no enrichment)
  // 3. Monthly grant: 150cr/mo for ALL users (free + paid), 2-month expiry
  // 4. Purchased credits never expire
  // 5. User runs out of free credits → buys pack (conversion)
  freeTier: {
    freeTripDays: 3,
    freeEditsLimit: 5,
    oneFreeTripPerAccount: true,
    acquisitionCostBlended: 0.378,     // One-time per new user
    acquisitionCostWorstCase: 0.413,   // All 5 edits used
    day1PreviewCost: 0.010,            // AI-only lightweight preview (always free)
    monthlyGrantCredits: 150,          // Credits per month (ALL users)
    monthlyGrantExpiry: 2,             // Months until free credits expire
    purchasedNeverExpire: true,        // Purchased credits never expire
    recurringCostIfUsed: 0.040,        // Cost if user spends all 150cr
    usageRate: 0.60,                   // ~60% of users use their free credits
    recurringCostPerMonth: 0.024,      // Blended: $0.04 × 60%
  },
} as const;

// ============================================================================
// UNIT ECONOMICS CALCULATIONS
// ============================================================================

export interface EconomicsInput {
  // From credit_ledger aggregations
  creditsSpent: number;
  creditsPurchased: number;
  revenueFromPurchases: number; // Actual Stripe revenue
  
  // User counts
  totalUsers: number;
  paidUsers: number;
  
  // Activity breakdown (count of each action type)
  activityCounts: Record<string, number>;
  
  // Optional: actual API call counts if tracked
  apiCalls?: {
    googlePlaces?: number;
    googleRoutes?: number;
    amadeus?: number;
    perplexity?: number;
    aiCalls?: Record<string, number>;
  };
}

export interface EconomicsOutput {
  // Fixed costs
  fixedCostsMonthly: number;
  
  // Variable costs
  estimatedAiCost: number;
  estimatedApiCost: number;
  totalVariableCost: number;
  
  // Total costs
  totalMonthlyCost: number;
  costPerPaidUser: number;
  costPerCredit: number;
  
  // Revenue
  grossRevenue: number;
  stripeFees: number;
  netRevenue: number;
  
  // Margins
  grossProfit: number;
  grossMarginPercent: number;
  
  // Breakdowns
  costBreakdown: {
    category: string;
    amount: number;
    percent: number;
  }[];
}

export function calculateUnitEconomics(input: EconomicsInput): EconomicsOutput {
  // Fixed costs
  const fixedCostsMonthly = TOTAL_FIXED_MONTHLY;
  
  // Estimate AI costs from activity counts
  let estimatedAiCost = 0;
  for (const [action, count] of Object.entries(input.activityCounts)) {
    const mapping = CREDIT_ACTION_MAPPING[action as keyof typeof CREDIT_ACTION_MAPPING];
    if (mapping) {
      // Use midpoint of cost range
      const avgCost = (mapping.costMin + mapping.costMax) / 2;
      estimatedAiCost += avgCost * count;
    }
  }
  
  // Estimate API costs (if tracking data provided)
  let estimatedApiCost = 0;
  if (input.apiCalls) {
    if (input.apiCalls.googlePlaces) {
      // $17 per 1k calls, but $200 free credit covers ~11k calls
      const billableCalls = Math.max(0, input.apiCalls.googlePlaces - 11000);
      estimatedApiCost += (billableCalls / 1000) * 17;
    }
    if (input.apiCalls.googleRoutes) {
      const billableCalls = Math.max(0, input.apiCalls.googleRoutes - 40000);
      estimatedApiCost += (billableCalls / 1000) * 5;
    }
    if (input.apiCalls.perplexity) {
      estimatedApiCost += input.apiCalls.perplexity * 0.005;
    }
  }
  
  const totalVariableCost = estimatedAiCost + estimatedApiCost;
  const totalMonthlyCost = fixedCostsMonthly + totalVariableCost;
  
  // Revenue calculations
  const grossRevenue = input.revenueFromPurchases;
  
  // Estimate Stripe fees (2.9% + $0.30 per transaction)
  // Rough estimate: assume average transaction is $35
  const estimatedTransactions = grossRevenue > 0 ? Math.ceil(grossRevenue / 35) : 0;
  const stripeFees = (grossRevenue * 0.029) + (estimatedTransactions * 0.30);
  const netRevenue = grossRevenue - stripeFees;
  
  // Margins
  const grossProfit = netRevenue - totalMonthlyCost;
  const grossMarginPercent = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
  
  // Per-unit metrics
  const costPerPaidUser = input.paidUsers > 0 ? totalMonthlyCost / input.paidUsers : 0;
  const costPerCredit = input.creditsSpent > 0 ? totalVariableCost / input.creditsSpent : 0;
  
  // Cost breakdown
  const costBreakdown = [
    { category: 'Fixed (Lovable + Domain)', amount: fixedCostsMonthly, percent: (fixedCostsMonthly / totalMonthlyCost) * 100 },
    { category: 'AI (Lovable AI Gateway)', amount: estimatedAiCost, percent: (estimatedAiCost / totalMonthlyCost) * 100 },
    { category: 'External APIs', amount: estimatedApiCost, percent: (estimatedApiCost / totalMonthlyCost) * 100 },
    { category: 'Stripe Fees', amount: stripeFees, percent: (stripeFees / totalMonthlyCost) * 100 },
  ].filter(c => c.amount > 0);
  
  return {
    fixedCostsMonthly,
    estimatedAiCost,
    estimatedApiCost,
    totalVariableCost,
    totalMonthlyCost,
    costPerPaidUser,
    costPerCredit,
    grossRevenue,
    stripeFees,
    netRevenue,
    grossProfit,
    grossMarginPercent,
    costBreakdown,
  };
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

export function formatUSD(n: number, decimals = 2): string {
  if (!isFinite(n)) return '∞';
  const prefix = n < 0 ? '-$' : '$';
  return prefix + Math.abs(n).toLocaleString('en-US', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
}

export function formatNumber(n: number, decimals = 0): string {
  if (!isFinite(n)) return '∞';
  return n.toLocaleString('en-US', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
}

export function formatPercent(n: number, decimals = 1): string {
  if (!isFinite(n)) return '∞';
  return n.toLocaleString('en-US', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  }) + '%';
}

// ============================================================================
// PROJECTIONS
// ============================================================================

export function projectCostsForVolume(monthlyUsers: number, creditsPerUser = 500): EconomicsOutput {
  // Assume typical user behavior
  const avgActionsPerUser = {
    unlock_day: 3,      // 3 days unlocked
    swap_activity: 4,   // 4 swaps
    regenerate_day: 1,  // 1 regeneration
    restaurant_rec: 2,  // 2 restaurant recs
    ai_message: 5,      // 5 chat messages
  };
  
  const activityCounts: Record<string, number> = {};
  for (const [action, count] of Object.entries(avgActionsPerUser)) {
    activityCounts[action] = count * monthlyUsers;
  }
  
  // Assume 10% conversion to paid, average $35 purchase
  const paidUsers = Math.ceil(monthlyUsers * 0.1);
  const revenue = paidUsers * 35;
  
  return calculateUnitEconomics({
    creditsSpent: monthlyUsers * creditsPerUser,
    creditsPurchased: paidUsers * 500,
    revenueFromPurchases: revenue,
    totalUsers: monthlyUsers,
    paidUsers,
    activityCounts,
  });
}
