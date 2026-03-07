// ============================================================
// Pricing Configuration - Two-Tier Credit Model
// Flexible Credits (top-up) + Voyance Club (packs with perks)
// ============================================================

// Credit Costs for Actions
export const CREDIT_COSTS = {
  // GUARD: TRIP_GENERATION is a PLACEHOLDER. Actual cost is calculated dynamically
  // by tripCostCalculator.calculateTripCredits(). Do NOT read this value for display.
  // Use voyanceFlowController re-export of calculateTripCredits() instead.
  TRIP_GENERATION: 0,  // Placeholder only - see guard comment above
  HOTEL_SEARCH: 40,           // Per city
  // GUARD: REGENERATE_TRIP is a PLACEHOLDER. Actual cost = days × 30 (half of generation rate).
  REGENERATE_TRIP: 0,         // Variable cost — see guard comment above

  // Fixed per-action costs
  UNLOCK_DAY: 60,             // Unlock a full day of details
  SMART_FINISH: 50,           // Smart Finish for manual/imported trips
  REGENERATE_DAY: 10,         // Regenerate a day (after 5 free/trip)
  SWAP_ACTIVITY: 5,           // Swap an activity (after 10 free/trip)
  ADD_ACTIVITY: 5,            // Add a new activity to a day
  RESTAURANT_REC: 5,          // Restaurant recommendation (after 5 free/trip)
  AI_MESSAGE: 5,              // AI companion message (after 20 free/trip)
  HOTEL_OPTIMIZATION: 100,    // Approve hotel-based itinerary swaps
  MYSTERY_GETAWAY: 15,        // Mystery Getaway destination suggestions
  MYSTERY_LOGISTICS: 5,       // Flight estimate + hotel suggestions for mystery trip
  TRANSPORT_MODE_CHANGE: 5,   // Change transport mode for a route segment

  // Route optimization (credit-gated with re-optimization discount)
  ROUTE_OPTIMIZATION: 20,
  NEARBY_SUGGESTIONS: 0,
  LOCAL_EVENTS: 0,
  PDF_EXPORT: 0,
  SHARING: 0,
  REAL_TIME_MODE: 0,
} as const;

// Route optimization re-optimization discount schedules (per-trip sliding scale)
// Index = number of completed optimizations on this trip (0 = first time)
export const ROUTE_OPT_STANDARD_SCHEDULE = [20, 15, 10, 5] as const;
export const ROUTE_OPT_CLUB_SCHEDULE = [10, 8, 6, 3] as const;

// Tier-based free action caps per trip
export type UserTier = 'free' | 'flex' | 'voyager' | 'explorer' | 'adventurer';

export interface TierCaps {
  swaps: number;
  adds: number;
  regenerates: number;
  ai_messages: number;
  restaurant_recs: number;
  total: number;
}

export const TIER_FREE_CAPS: Record<UserTier, TierCaps> = {
  free:       { swaps: 3,  adds: 2, regenerates: 1, ai_messages: 5,  restaurant_recs: 1, total: 12 },
  flex:       { swaps: 3,  adds: 2, regenerates: 1, ai_messages: 5,  restaurant_recs: 1, total: 12 },
  voyager:    { swaps: 6,  adds: 4, regenerates: 2, ai_messages: 10, restaurant_recs: 2, total: 24 },
  explorer:   { swaps: 9,  adds: 6, regenerates: 3, ai_messages: 15, restaurant_recs: 3, total: 36 },
  adventurer: { swaps: 15, adds: 10, regenerates: 5, ai_messages: 25, restaurant_recs: 5, total: 60 },
};

// Trip length scaling for Free/Flex users only
export const FLEX_CAPS_BY_DAYS: Record<number, TierCaps> = {
  2:  { swaps: 3,  adds: 2, regenerates: 1, ai_messages: 5,  restaurant_recs: 1, total: 12 },
  4:  { swaps: 5,  adds: 3, regenerates: 2, ai_messages: 10, restaurant_recs: 2, total: 22 },
  6:  { swaps: 7,  adds: 4, regenerates: 3, ai_messages: 15, restaurant_recs: 3, total: 32 },
  8:  { swaps: 10, adds: 6, regenerates: 4, ai_messages: 20, restaurant_recs: 4, total: 44 },
};

// Group unlock credit costs
export const GROUP_UNLOCK_CREDITS: Record<string, number> = {
  small: 150,
  medium: 300,
  large: 500,
};

// Group shared free caps (shared by all collaborators)
export const GROUP_FREE_CAPS = {
  swaps: 10,
  regenerates: 5,
  ai_messages: 20,
  restaurant_recs: 5,
  total: 40,
};

// Legacy flat caps (backward compat)
export const FREE_ACTION_CAPS: Record<string, number> = {
  swap_activity: 3,
  add_activity: 2,
  regenerate_day: 1,
  ai_message: 5,
  restaurant_rec: 1,
};

// ============================================================
// FLEXIBLE CREDITS — Quick Top-Up (transactional, no perks)
// ============================================================

export type FlexibleCreditPack = {
  id: string;
  productId: string;
  priceId: string;
  name: string;
  credits: number;
  price: number;
  perCredit: string;
  expirationMonths: 12;
  mode: 'payment';
  type: 'flexible';
};

export const FLEXIBLE_CREDITS: FlexibleCreditPack[] = [
  {
    id: 'flex_100',
    productId: 'prod_TwV6DLU2wY20SS',
    priceId: 'price_1Syc68JytioXyqq9KfhrbugR',
    name: 'Top-Up 100',
    credits: 100,
    price: 9,
    perCredit: '0.090',
    expirationMonths: 12,
    mode: 'payment',
    type: 'flexible',
  },
  {
    id: 'flex_300',
    productId: 'prod_TwV6R1eib5j9Wq',
    priceId: 'price_1Syc69JytioXyqq9RyuXQAQm',
    name: 'Top-Up 300',
    credits: 300,
    price: 25,
    perCredit: '0.083',
    expirationMonths: 12,
    mode: 'payment',
    type: 'flexible',
  },
  {
    id: 'flex_500',
    productId: 'prod_TwV6Z5Bmoox7SK',
    priceId: 'price_1Syc6AJytioXyqq98l10fqXn',
    name: 'Top-Up 500',
    credits: 500,
    price: 39,
    perCredit: '0.078',
    expirationMonths: 12,
    mode: 'payment',
    type: 'flexible',
  },
];

// ============================================================
// VOYANCE CLUB — Premium Packs (perks, bonus, identity)
// ============================================================

export type ClubTier = 'voyager' | 'explorer' | 'adventurer';

export type VoyanceClubPack = {
  id: string;
  productId: string;
  priceId: string;
  name: string;
  tier: ClubTier;
  baseCredits: number;
  bonusCredits: number;
  totalCredits: number;
  credits: number; // alias for totalCredits (backward compat)
  price: number;
  perCredit: string;
  bonusExpirationMonths: 6;
  baseExpiresNever: true;
  mode: 'payment';
  type: 'club';
  featured?: boolean;
  perks: string[];
};

export const VOYANCE_CLUB_PACKS: VoyanceClubPack[] = [
  {
    id: 'voyager',
    productId: 'prod_TwpdsFwCQpA4ew',
    priceId: 'price_1SyvxsJytioXyqq9Gzy5m2Hv',
    name: 'Voyager',
    tier: 'voyager',
    baseCredits: 500,
    bonusCredits: 100,
    totalCredits: 600,
    credits: 600,
    price: 49.99,
    perCredit: '0.083',
    bonusExpirationMonths: 6,
    baseExpiresNever: true,
    mode: 'payment',
    type: 'club',
    perks: [
      'Voyance Club badge',
      'Credits never expire',
      'Priority support',
    ],
  },
  {
    id: 'explorer',
    productId: 'prod_TwpdzBlDJuJfbS',
    priceId: 'price_1SyvxtJytioXyqq9Zlgc9GJ6',
    name: 'Explorer',
    tier: 'explorer',
    baseCredits: 1200,
    bonusCredits: 400,
    totalCredits: 1600,
    credits: 1600,
    price: 89.99,
    perCredit: '0.056',
    bonusExpirationMonths: 6,
    baseExpiresNever: true,
    mode: 'payment',
    type: 'club',
    featured: true,
    perks: [
      'Everything in Voyager',
      'Priority support',
      'Early feature access',
    ],
  },
  {
    id: 'adventurer',
    productId: 'prod_TwpdxFwT7d6EIc',
    priceId: 'price_1SyvxuJytioXyqq9Ora5nFBS',
    name: 'Adventurer',
    tier: 'adventurer',
    baseCredits: 2500,
    bonusCredits: 700,
    totalCredits: 3200,
    credits: 3200,
    price: 149.99,
    perCredit: '0.047',
    bonusExpirationMonths: 6,
    baseExpiresNever: true,
    mode: 'payment',
    type: 'club',
    perks: [
      'Everything in Explorer',
      'Founding Member badge (first 1,000)',
      'Beta access',
    ],
  },
];

// ============================================================
// GROUP UNLOCKS — Per-trip shared editing for collaborators
// ============================================================

export type GroupUnlockTier = 'small' | 'medium' | 'large';

export type GroupUnlockPack = {
  id: string;
  productId: string;
  priceId: string;
  name: string;
  tier: GroupUnlockTier;
  maxTravelers: number;
  price: number;
  creditCost: number;
  mode: 'payment';
  type: 'group_unlock';
  caps: {
    swap_activity: number;
    regenerate_day: number;
    ai_message: number;
    restaurant_rec: number;
  };
};

export const GROUP_UNLOCK_TIERS: GroupUnlockPack[] = [
  {
    id: 'group_small',
    productId: 'prod_TwpdLWc2OUADWF',
    priceId: 'price_1SyvxvJytioXyqq9qU0SubDW',
    name: 'Small Group',
    tier: 'small',
    maxTravelers: 3,
    price: 19.99,
    creditCost: 150,
    mode: 'payment',
    type: 'group_unlock',
    caps: {
      swap_activity: 15,
      regenerate_day: 8,
      ai_message: 30,
      restaurant_rec: 10,
    },
  },
  {
    id: 'group_medium',
    productId: 'prod_TwpdnmZV4SWa88',
    priceId: 'price_1SyvxwJytioXyqq90haUDm6h',
    name: 'Medium Group',
    tier: 'medium',
    maxTravelers: 6,
    price: 34.99,
    creditCost: 300,
    mode: 'payment',
    type: 'group_unlock',
    caps: {
      swap_activity: 25,
      regenerate_day: 12,
      ai_message: 50,
      restaurant_rec: 15,
    },
  },
  {
    id: 'group_large',
    productId: 'prod_TwpdEoxWuAKPOB',
    priceId: 'price_1SyvxxJytioXyqq96wrOYhKc',
    name: 'Large Group',
    tier: 'large',
    maxTravelers: 99,
    price: 79.99,
    creditCost: 500,
    mode: 'payment',
    type: 'group_unlock',
    caps: {
      swap_activity: 50,
      regenerate_day: 20,
      ai_message: 100,
      restaurant_rec: 25,
    },
  },
];

// Group caps config for edge function reference
export const GROUP_CAPS = {
  small: { swap_activity: 15, regenerate_day: 8, ai_message: 30, restaurant_rec: 10 },
  medium: { swap_activity: 25, regenerate_day: 12, ai_message: 50, restaurant_rec: 15 },
  large: { swap_activity: 50, regenerate_day: 20, ai_message: 100, restaurant_rec: 25 },
} as const;

// ============================================================
// BACKWARD-COMPATIBLE EXPORTS
// ============================================================

/** All purchasable packs (both flexible + club) */
export const CREDIT_PACKS = [...FLEXIBLE_CREDITS, ...VOYANCE_CLUB_PACKS] as const;
export const ALL_CREDIT_PACKS = CREDIT_PACKS;

/** Smallest quick top-up (replaces old BOOST_PACK / TOPUP_PACK) */
export const BOOST_PACK = FLEXIBLE_CREDITS[0];
export const TOPUP_PACK = FLEXIBLE_CREDITS[0];

// ============================================================
// MONTHLY CREDIT GRANT
// ============================================================

// GUARD: Free credit expiration policy.
// Free credits (signup bonus + monthly grants) expire after freeExpirationMonths months.
// Purchased credits NEVER expire.
// The UI should surface this distinction wherever credit balances are shown.
export const MONTHLY_CREDIT_GRANT = {
  monthlyCredits: 150,
  maxBankedFree: 300,
  freeExpirationMonths: 2,
  purchasedNeverExpire: true,
  appliesToAllUsers: true,
  referralBonus: 200,
} as const;

// GUARD: Signup bonus amounts. Edge functions (grant-bonus-credits) must match these values.
// If you change these, update the edge function AND run scripts/check-edge-constants.ts.
export const SIGNUP_CREDITS = {
  welcomeBonus: 150,
  earlyAdopterBonus: 500,
  earlyAdopterEnabled: true,
  get totalSignupCredits() {
    return this.welcomeBonus + (this.earlyAdopterEnabled ? this.earlyAdopterBonus : 0);
  },
} as const;

/**
 * Human-readable credit expiration messages for UI display.
 * Use these in balance displays, tooltips, and purchase confirmations.
 */
export const CREDIT_EXPIRATION_COPY = {
  freeCreditsNotice: 'Free credits expire after 2 months if unused.',
  purchasedCreditsNotice: 'Purchased credits never expire.',
  balanceTooltip: 'Your balance includes both free and purchased credits. Free credits are used first and expire after 2 months.',
} as const;

// Free Tier
export const FREE_TIER = {
  signupBonus: 150,
  monthlyFree: 150,
  maxBankedFree: 300,
  freeExpirationMonths: 2,
  referralBonus: 200,

  freeFeatures: [
    'Complete itinerary with real venue names',
    'Personalized timing and reasoning',
    'Travel DNA quiz and travel type',
    'Full day-by-day structure preview',
    'DNA alignment explanations',
    '150 free credits every month',
  ],

  paidFeatures: [
    'Full addresses + Google Maps',
    'Hours of operation',
    'High-quality venue photos',
    'Booking links & reservations',
    'Insider tips for each stop',
    'Offline PDF export',
    'Optimized routing',
    'Hotel recommendations',
    'Activity swaps & regeneration',
  ],

  internalCosts: {
    previewCost: 0.12,
    fullDayCost: 0.263,
    perDayIncrement: 0.100,
    tripBaseCost: 0.163,
  },
} as const;

// ============================================================
// STRIPE PRODUCTS (raw reference — kept for edge function lookups)
// ============================================================

export const STRIPE_PRODUCTS = {
  // Flexible Credits
  FLEX_100: {
    productId: 'prod_TwV6DLU2wY20SS',
    priceId: 'price_1Syc68JytioXyqq9KfhrbugR',
    name: 'Top-Up 100',
    credits: 100,
    price: 9,
    mode: 'payment' as const,
  },
  FLEX_300: {
    productId: 'prod_TwV6R1eib5j9Wq',
    priceId: 'price_1Syc69JytioXyqq9RyuXQAQm',
    name: 'Top-Up 300',
    credits: 300,
    price: 25,
    mode: 'payment' as const,
  },
  FLEX_500: {
    productId: 'prod_TwV6Z5Bmoox7SK',
    priceId: 'price_1Syc6AJytioXyqq98l10fqXn',
    name: 'Top-Up 500',
    credits: 500,
    price: 39,
    mode: 'payment' as const,
  },
  // Voyance Club
  VOYAGER: {
    productId: 'prod_TwpdsFwCQpA4ew',
    priceId: 'price_1SyvxsJytioXyqq9Gzy5m2Hv',
    name: 'Voyager',
    credits: 600,
    price: 49.99,
    mode: 'payment' as const,
  },
  EXPLORER: {
    productId: 'prod_TwpdzBlDJuJfbS',
    priceId: 'price_1SyvxtJytioXyqq9Zlgc9GJ6',
    name: 'Explorer',
    credits: 1600,
    price: 89.99,
    mode: 'payment' as const,
  },
  ADVENTURER: {
    productId: 'prod_TwpdxFwT7d6EIc',
    priceId: 'price_1SyvxuJytioXyqq9Ora5nFBS',
    name: 'Adventurer',
    credits: 3200,
    price: 149.99,
    mode: 'payment' as const,
  },
  // Group Unlocks
  GROUP_SMALL: {
    productId: 'prod_TwpdLWc2OUADWF',
    priceId: 'price_1SyvxvJytioXyqq9qU0SubDW',
    name: 'Group Unlock - Small',
    price: 19.99,
    mode: 'payment' as const,
  },
  GROUP_MEDIUM: {
    productId: 'prod_TwpdnmZV4SWa88',
    priceId: 'price_1SyvxwJytioXyqq90haUDm6h',
    name: 'Group Unlock - Medium',
    price: 34.99,
    mode: 'payment' as const,
  },
  GROUP_LARGE: {
    productId: 'prod_TwpdEoxWuAKPOB',
    priceId: 'price_1SyvxxJytioXyqq96wrOYhKc',
    name: 'Group Unlock - Large',
    price: 79.99,
    mode: 'payment' as const,
  },
  // Legacy - Travel Agent (unchanged)
  TRAVEL_AGENT: {
    productId: 'prod_TravelAgent',
    priceId: 'price_TravelAgent',
    name: 'Travel Agent',
    price: 79,
    mode: 'subscription' as const,
  },
} as const;

// ============================================================
// TRIP COST EXAMPLES
// ============================================================

export const TRIP_COST_EXAMPLES = {
  twoDay: {
    label: 'Paris, 2 days, standard',
    days: 2,
    cities: 1,
    tier: 'standard' as const,
    total: 120,
  },
  fiveDay: {
    label: 'Tokyo, 5 days, standard',
    days: 5,
    cities: 1,
    tier: 'standard' as const,
    total: 300,
  },
  multiCity: {
    label: 'Tokyo → Kyoto, 7 days',
    days: 7,
    cities: 2,
    tier: 'standard' as const,
    total: 480,
  },
  custom: {
    label: 'Barcelona anniversary + vegan',
    days: 3,
    cities: 1,
    tier: 'custom' as const,
    total: 210,
  },
  curated: {
    label: 'Japan honeymoon, 3 cities, 10 days',
    days: 10,
    cities: 3,
    tier: 'highly_curated' as const,
    total: 900,
  },
} as const;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const MAX_REASONABLE_CREDITS = 100_000;

let _formatCreditsWarned = false;

export function formatCredits(credits: number): string {
  if (credits > MAX_REASONABLE_CREDITS) {
    if (!_formatCreditsWarned) {
      _formatCreditsWarned = true;
      console.warn(`[formatCredits] Unreasonable credit value detected: ${credits}. Subsequent warnings suppressed.`);
    }
    return '-';
  }
  return credits.toLocaleString();
}

export function canAfford(balance: number, cost: number): boolean {
  return balance >= cost;
}

/** Recommend the best pack for a given credit need — prefers Club packs for value */
export function getRecommendedPack(creditsNeeded: number): (FlexibleCreditPack | VoyanceClubPack) | null {
  // First check if any flexible pack covers it
  const flexMatch = FLEXIBLE_CREDITS.find(p => p.credits >= creditsNeeded);
  // Then check club packs
  const clubMatch = VOYANCE_CLUB_PACKS.find(p => p.totalCredits >= creditsNeeded);

  if (!flexMatch && !clubMatch) {
    return VOYANCE_CLUB_PACKS[VOYANCE_CLUB_PACKS.length - 1]; // Largest
  }
  if (!flexMatch) return clubMatch!;
  if (!clubMatch) return flexMatch;

  // If both cover it, prefer club if price-per-credit is better
  const flexPpc = flexMatch.price / flexMatch.credits;
  const clubPpc = clubMatch.price / clubMatch.totalCredits;
  return clubPpc <= flexPpc ? clubMatch : flexMatch;
}

// ============================================
// TRAVEL AGENT TIERS - Professional Plans
// ============================================
export const PLAN_FEATURES = {
  AGENT_STARTER: {
    id: 'agent_starter',
    name: 'Starter',
    badge: 'Solo Advisors',
    headline: 'Build & share trips in minutes.',
    subheadline: 'Beautiful itineraries, confirmations attached, no more email chaos.',
    bestFor: 'Solo advisors starting out or managing a small client base.',
    price: 49,
    priceDetail: 'per month',
    features: [
      'Up to 5 active trips',
      'Client-ready itinerary links + PDF',
      'Booking confirmations attached to trips',
      'Payment deadline reminders',
      'Basic client profiles',
      'Email templates',
    ],
    limits: {
      activeTrips: 5,
      clientManagement: true,
      itineraryBuilder: true,
      pdfExport: true,
      basicReminders: true,
      emailTemplates: true,
      smartImport: false,
      quoteBuilder: false,
      commissionTracking: false,
      teamSeats: 1,
    },
    cta: 'Start Free Trial',
  },
  AGENT_PRO: {
    id: 'agent_pro',
    name: 'Pro',
    badge: 'Most Popular',
    headline: 'Never drop the ball again.',
    subheadline: 'Smart import, quote versioning, commission tracking. Everything attached to the trip.',
    bestFor: 'Growing advisors who need automation and faster workflows.',
    price: 149,
    priceDetail: 'per month',
    features: [
      'Up to 20 active trips',
      'Everything in Starter, plus:',
      'Smart Import (email → bookings)',
      'Quote builder with versioning',
      'Client approval workflow',
      'Commission tracking',
      'Custom branding on exports',
      'Itinerary templates library',
      'Automated task reminders',
    ],
    limits: {
      activeTrips: 20,
      clientManagement: true,
      itineraryBuilder: true,
      pdfExport: true,
      smartImport: true,
      quoteBuilder: true,
      commissionTracking: true,
      customBranding: true,
      templateLibrary: true,
      automatedReminders: true,
      teamSeats: 1,
    },
    cta: 'Start Free Trial',
  },
  AGENT_AGENCY: {
    id: 'agent_agency',
    name: 'Agency',
    badge: 'Teams',
    headline: 'Everything your agency needs.',
    subheadline: 'Multi-seat, permissioning, reconciliation exports, and everything your agency needs.',
    bestFor: 'Agencies and teams needing full workflow automation.',
    price: 499,
    priceDetail: 'per month',
    features: [
      'Unlimited active trips',
      'Everything in Pro, plus:',
      'Unlimited team seats',
      'Role-based permissions',
      'Commission reconciliation exports',
      'Supplier management',
      'Client portal access',
      'API access',
      'Priority support',
    ],
    limits: {
      activeTrips: -1,
      clientManagement: true,
      itineraryBuilder: true,
      pdfExport: true,
      smartImport: true,
      quoteBuilder: true,
      commissionTracking: true,
      customBranding: true,
      templateLibrary: true,
      automatedReminders: true,
      reconciliationExports: true,
      supplierManagement: true,
      clientPortal: true,
      apiAccess: true,
      teamSeats: -1,
    },
    cta: 'Contact Sales',
  },
  TRAVEL_AGENT: {
    id: 'travel_agent',
    name: 'Travel Agent',
    badge: 'For Professionals',
    headline: 'Build trips faster, track everything.',
    subheadline: 'Build and revise trips in minutes. Keep confirmations, payments, tasks, and commissions attached to the trip.',
    bestFor: 'Travel agents and advisors managing client trips.',
    price: 79,
    priceDetail: 'per month',
    features: [
      'Client & Account Management',
      'Traveler Profiles (passport, preferences, loyalty)',
      'Trip Pipeline (Inquiry → Completed)',
      'Booking Segments (flights, hotels, tours, transfers)',
      'Quote Builder with Versioning',
      'Client Approvals & Audit Trail',
      'Invoice Generation & Payment Tracking',
      'Commission & Fee Management',
      'Deadline Engine (final payments, ticketing, visa)',
      'Document Storage & Client Portal',
      'Automated Reminder Emails',
      'Unlimited Itinerary Builds',
      'Unlimited Client Trips',
      'Export Itineraries (PDF)',
      'Email Templates & Communication Log',
    ],
    limits: {
      fullBuildsPerMonth: -1,
      refinementsPerMonth: -1,
      routeOptimizationsPerMonth: -1,
      groupBudgetSetupsPerMonth: -1,
      draftTrips: -1,
      mysteryTripDrafts: -1,
      tripVersions: -1,
      flightHotelOptimization: true,
      groupBudgeting: true,
      coEditCollaboration: true,
      budgetTracking: true,
      preferenceLearning: true,
      mysteryTrips: true,
      canPrint: true,
      canExport: true,
      canDownload: true,
      canCollaborate: true,
      agentCRM: true,
      clientManagement: true,
      quoteBuilder: true,
      invoicing: true,
      commissionTracking: true,
      deadlineEngine: true,
      documentPortal: true,
      emailTemplates: true,
      unlimitedClients: true,
    },
    cta: 'Start Agent Plan',
  },
} as const;

// Legacy helper
export function isPlanFeatureEnabled(
  planId: string, 
  feature: 'flightHotelOptimization' | 'groupBudgeting' | 'coEditCollaboration' | 'preferenceLearning' | 'budgetTracking'
): boolean {
  const plan = Object.values(PLAN_FEATURES).find(p => p.id === planId);
  if (!plan || !plan.limits) return false;
  return (plan.limits as Record<string, unknown>)[feature] === true;
}
