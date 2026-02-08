// ============================================================
// Pricing Configuration - Two-Tier Credit Model
// Flexible Credits (top-up) + Voyance Club (packs with perks)
// ============================================================

// Credit Costs for Actions
export const CREDIT_COSTS = {
  // Dynamic (variable cost, calculated at generation time)
  TRIP_GENERATION: 0,         // Placeholder: use tripCostCalculator for actual cost
  HOTEL_SEARCH: 40,           // Per city

  // Fixed per-action costs
  UNLOCK_DAY: 90,             // Unlock a full day of details (= day generation cost)
  REGENERATE_DAY: 90,         // Regenerate a day (same as unlock)
  SWAP_ACTIVITY: 15,          // Swap an activity (1 Places + 1 Photo call)
  RESTAURANT_REC: 15,         // Restaurant recommendation (1 Perplexity call)
  AI_MESSAGE: 10,             // AI companion message (1 Gemini call)
  HOTEL_OPTIMIZATION: 100,    // Approve hotel-based itinerary swaps
  MYSTERY_GETAWAY: 15,        // Mystery Getaway destination suggestions
  MYSTERY_LOGISTICS: 5,       // Flight estimate + hotel suggestions for mystery trip
  TRANSPORT_MODE_CHANGE: 5,   // Change transport mode for a route segment

  // Free actions
  ROUTE_OPTIMIZATION: 0,
  PDF_EXPORT: 0,
  SHARING: 0,
  REAL_TIME_MODE: 0,
} as const;

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
    productId: 'prod_TwRGf3nmLa70Ad',
    priceId: 'price_1SyYNdJytioXyqq9ffAGMFYc',
    name: 'Voyager',
    tier: 'voyager',
    baseCredits: 500,
    bonusCredits: 100,
    totalCredits: 600,
    credits: 600,
    price: 29.99,
    perCredit: '0.050',
    bonusExpirationMonths: 6,
    baseExpiresNever: true,
    mode: 'payment',
    type: 'club',
    perks: [
      'Voyance Club badge',
      'Credits never expire',
    ],
  },
  {
    id: 'explorer',
    productId: 'prod_TwV64eVEzBSLgC',
    priceId: 'price_1Syc6OJytioXyqq9YMJSNDyb',
    name: 'Explorer',
    tier: 'explorer',
    baseCredits: 1200,
    bonusCredits: 400,
    totalCredits: 1600,
    credits: 1600,
    price: 59.99,
    perCredit: '0.037',
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
    productId: 'prod_TwRGzFgQz5RIzr',
    priceId: 'price_1SyYNfJytioXyqq95k9ymT2X',
    name: 'Adventurer',
    tier: 'adventurer',
    baseCredits: 2500,
    bonusCredits: 700,
    totalCredits: 3200,
    credits: 3200,
    price: 99.99,
    perCredit: '0.031',
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

export const MONTHLY_CREDIT_GRANT = {
  monthlyCredits: 150,
  maxBankedFree: 300,
  freeExpirationMonths: 2,
  purchasedNeverExpire: true,
  appliesToAllUsers: true,
  referralBonus: 200,
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
    'Travel DNA quiz and archetype',
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
    productId: 'prod_TwRGf3nmLa70Ad',
    priceId: 'price_1SyYNdJytioXyqq9ffAGMFYc',
    name: 'Voyager',
    credits: 600,
    price: 29.99,
    mode: 'payment' as const,
  },
  EXPLORER: {
    productId: 'prod_TwV64eVEzBSLgC',
    priceId: 'price_1Syc6OJytioXyqq9YMJSNDyb',
    name: 'Explorer',
    credits: 1600,
    price: 59.99,
    mode: 'payment' as const,
  },
  ADVENTURER: {
    productId: 'prod_TwRGzFgQz5RIzr',
    priceId: 'price_1SyYNfJytioXyqq95k9ymT2X',
    name: 'Adventurer',
    credits: 3200,
    price: 99.99,
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
    total: 180,
  },
  fiveDay: {
    label: 'Tokyo, 5 days, standard',
    days: 5,
    cities: 1,
    tier: 'standard' as const,
    total: 450,
  },
  multiCity: {
    label: 'Tokyo → Kyoto, 7 days',
    days: 7,
    cities: 2,
    tier: 'standard' as const,
    total: 690,
  },
  custom: {
    label: 'Barcelona anniversary + vegan',
    days: 3,
    cities: 1,
    tier: 'custom' as const,
    total: 320,
  },
  curated: {
    label: 'Japan honeymoon, 3 cities, 10 days',
    days: 10,
    cities: 3,
    tier: 'highly_curated' as const,
    total: 1330,
  },
} as const;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

export function formatCredits(credits: number): string {
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
