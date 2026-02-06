// ============================================================
// Pricing Configuration - Credit-Based Model (v2)
// Dynamic trip pricing: roundUpTo10((Days × 90 + MultiCityFee) × TierMultiplier)
// ============================================================

// Credit Costs for Actions
export const CREDIT_COSTS = {
  // Dynamic (variable cost, calculated at generation time)
  TRIP_GENERATION: 0,         // Placeholder: use tripCostCalculator for actual cost
  HOTEL_SEARCH: 40,           // Per city

  // Fixed per-action costs
  UNLOCK_DAY: 150,            // Unlock a full day of details
  REGENERATE_DAY: 20,         // Regenerate a day
  SWAP_ACTIVITY: 10,          // Swap an activity
  RESTAURANT_REC: 15,         // Restaurant recommendation
  AI_MESSAGE: 10,             // AI companion message

  // Free actions
  ROUTE_OPTIMIZATION: 0,
  PDF_EXPORT: 0,
  SHARING: 0,
  REAL_TIME_MODE: 0,
} as const;

// Credit Packs - Stripe Products (Live)
export const STRIPE_PRODUCTS = {
  // Boost (convenience pack - upsell)
  CREDITS_100: {
    productId: 'prod_TvoDemv6UvLUc4',
    priceId: 'price_1SxwbFJytioXyqq9iuHKTXQS',
    name: 'Boost',
    credits: 100,
    price: 8.99,
    description: 'Quick boost for swaps & extras',
    mode: 'payment' as const,
  },
  // Credit Packs
  CREDITS_200: {
    productId: 'prod_TuvcrwliHJ0mph',
    priceId: 'price_1Sx5knJytioXyqq900832qhf',
    name: 'Starter',
    credits: 200,
    price: 15.99,
    description: '~2 days of itinerary',
    mode: 'payment' as const,
  },
  CREDITS_500: {
    productId: 'prod_Tuvc6zstLq6b4V',
    priceId: 'price_1Sx5koJytioXyqq9nkJeDte1',
    name: 'Weekend',
    credits: 500,
    price: 29.99,
    description: '3-5 day trip',
    mode: 'payment' as const,
  },
  CREDITS_1200: {
    productId: 'prod_TvoD2IYQGay8FB',
    priceId: 'price_1SxwbGJytioXyqq9szNt1OP3',
    name: 'Explorer',
    credits: 1200,
    price: 65.99,
    description: 'Week+ trip or multi-trip',
    featured: true,
    mode: 'payment' as const,
  },
  CREDITS_2500: {
    productId: 'prod_TuvcYuWNk7Tayn',
    priceId: 'price_1Sx5kqJytioXyqq9Jpejl02u',
    name: 'Adventurer',
    credits: 2500,
    price: 99.99,
    description: 'Multiple vacations',
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

// Free Tier - "FULL PREVIEW, NO DETAILS" MODEL
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

// Boost Pack
export const BOOST_PACK = {
  id: 'boost' as const,
  ...STRIPE_PRODUCTS.CREDITS_100,
  perCredit: (8.99 / 100).toFixed(3),
} as const;

// Legacy alias
export const TOPUP_PACK = BOOST_PACK;

// Credit Pack Definitions for Display
export const CREDIT_PACKS = [
  {
    id: 'single' as const,
    ...STRIPE_PRODUCTS.CREDITS_200,
    perCredit: (15.99 / 200).toFixed(3),
    featured: false,
  },
  {
    id: 'weekend' as const,
    ...STRIPE_PRODUCTS.CREDITS_500,
    perCredit: (29.99 / 500).toFixed(3),
    featured: false,
  },
  {
    id: 'explorer' as const,
    ...STRIPE_PRODUCTS.CREDITS_1200,
    perCredit: (65.99 / 1200).toFixed(3),
    featured: true,
  },
  {
    id: 'adventurer' as const,
    ...STRIPE_PRODUCTS.CREDITS_2500,
    perCredit: (99.99 / 2500).toFixed(3),
    featured: false,
  },
] as const;

export const ALL_CREDIT_PACKS = [
  ...CREDIT_PACKS,
  BOOST_PACK,
] as const;

// Trip cost examples (for pricing page — formula-based)
export const TRIP_COST_EXAMPLES = {
  threeDay: {
    label: 'Paris, 3 days, standard',
    days: 3,
    cities: 1,
    tier: 'standard' as const,
    total: 270, // 3×90 = 270, ×1.0 = 270
  },
  fiveDay: {
    label: 'Tokyo, 5 days, standard',
    days: 5,
    cities: 1,
    tier: 'standard' as const,
    total: 450, // 5×90 = 450
  },
  multiCity: {
    label: 'Tokyo → Kyoto, 7 days',
    days: 7,
    cities: 2,
    tier: 'standard' as const,
    total: 690, // 7×90+60 = 690
  },
  custom: {
    label: 'Barcelona anniversary + vegan',
    days: 3,
    cities: 1,
    tier: 'custom' as const,
    total: 320, // 3×90=270, ×1.15=310.5, roundUp10=320
  },
  curated: {
    label: 'Japan honeymoon, 3 cities, 10 days',
    days: 10,
    cities: 3,
    tier: 'highly_curated' as const,
    total: 1330, // (10×90+120)×1.3=1326, roundUp10=1330
  },
} as const;

// Helper functions
export function formatCredits(credits: number): string {
  return credits.toLocaleString();
}

export function canAfford(balance: number, cost: number): boolean {
  return balance >= cost;
}

export function getRecommendedPack(creditsNeeded: number): typeof CREDIT_PACKS[number] | null {
  for (const pack of CREDIT_PACKS) {
    if (pack.credits >= creditsNeeded) {
      return pack;
    }
  }
  return CREDIT_PACKS[CREDIT_PACKS.length - 1];
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
