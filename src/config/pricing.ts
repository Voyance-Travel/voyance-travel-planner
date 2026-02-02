// ============================================================
// Pricing Configuration - Credit-Based Model
// Single currency, single balance, single system
// ============================================================

// Credit Costs for Actions
export const CREDIT_COSTS = {
  UNLOCK_DAY: 150,          // Unlock 1 day of itinerary
  SWAP_ACTIVITY: 5,         // Swap an activity
  REGENERATE_DAY: 15,       // Regenerate a day
  RESTAURANT_REC: 10,       // AI restaurant recommendation
  AI_MESSAGE: 2,            // AI companion message
  ROUTE_OPTIMIZATION: 0,    // Free
  PDF_EXPORT: 0,            // Free
  SHARING: 0,               // Free
  REAL_TIME_MODE: 0,        // Free
} as const;

// Credit Packs - Stripe Products
export const STRIPE_PRODUCTS = {
  // Credit Packs
  CREDITS_200: {
    productId: 'prod_TuL4pcyakcLNzu',
    priceId: 'price_1SwWOnFYxIg9jcJU81hyigDW',
    name: 'Single',
    credits: 200,
    price: 12,
    description: '1 day + plenty of extras',
    mode: 'payment' as const,
  },
  CREDITS_500: {
    productId: 'prod_TuL48Mks27hy4a',
    priceId: 'price_1SwWOoFYxIg9jcJUauGZTqar',
    name: 'Starter',
    credits: 500,
    price: 29,
    description: '3-day trip',
    mode: 'payment' as const,
  },
  CREDITS_1200: {
    productId: 'prod_TuL4qskvbZ5ueo',
    priceId: 'price_1SwWOpFYxIg9jcJUP0YaWuz1',
    name: 'Explorer',
    credits: 1200,
    price: 55,
    description: '7-day trip',
    featured: true,
    mode: 'payment' as const,
  },
  CREDITS_2500: {
    productId: 'prod_TuL5EXmVj7x98W',
    priceId: 'price_1SwWOqFYxIg9jcJU0STDFvxw',
    name: 'Adventurer',
    credits: 2500,
    price: 89,
    description: '14-day trip',
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

// Free Tier
export const FREE_TIER = {
  signupBonus: 150,              // 150 credits = 1 free day
  monthlyFree: 150,              // 150 credits/month
  maxBankedFree: 750,            // Can accumulate up to 5 months worth
  freeExpirationMonths: 6,       // Free credits expire after 6 months
  referralBonus: 200,            // 200 credits per referral
} as const;

// Credit Pack Definitions for Display
export const CREDIT_PACKS = [
  {
    id: 'single' as const,
    ...STRIPE_PRODUCTS.CREDITS_200,
    perCredit: (12 / 200).toFixed(3), // ~$0.06
    featured: false,
  },
  {
    id: 'starter' as const,
    ...STRIPE_PRODUCTS.CREDITS_500,
    perCredit: (29 / 500).toFixed(3), // ~$0.058
    featured: false,
  },
  {
    id: 'explorer' as const,
    ...STRIPE_PRODUCTS.CREDITS_1200,
    perCredit: (55 / 1200).toFixed(3), // ~$0.046
    featured: true,
  },
  {
    id: 'adventurer' as const,
    ...STRIPE_PRODUCTS.CREDITS_2500,
    perCredit: (89 / 2500).toFixed(3), // ~$0.036
    featured: false,
  },
] as const;

// Trip cost examples (for pricing page)
export const TRIP_COST_EXAMPLES = {
  threeDay: {
    days: 3,
    swaps: 4,
    regenerates: 1,
    restaurants: 1,
    aiMessages: 5,
    total: 3 * 150 + 4 * 5 + 1 * 15 + 1 * 10 + 5 * 2, // ~505
  },
  fiveDay: {
    days: 5,
    swaps: 6,
    regenerates: 2,
    restaurants: 2,
    aiMessages: 10,
    total: 5 * 150 + 6 * 5 + 2 * 15 + 2 * 10 + 10 * 2, // ~850
  },
  sevenDay: {
    days: 7,
    swaps: 8,
    regenerates: 3,
    restaurants: 3,
    aiMessages: 15,
    total: 7 * 150 + 8 * 5 + 3 * 15 + 3 * 10 + 15 * 2, // ~1195
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
  return CREDIT_PACKS[CREDIT_PACKS.length - 1]; // Return largest if none fit
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

// Legacy helper for backwards compatibility
export function isPlanFeatureEnabled(
  planId: string, 
  feature: 'flightHotelOptimization' | 'groupBudgeting' | 'coEditCollaboration' | 'preferenceLearning' | 'budgetTracking'
): boolean {
  const plan = Object.values(PLAN_FEATURES).find(p => p.id === planId);
  if (!plan || !plan.limits) return false;
  return (plan.limits as Record<string, unknown>)[feature] === true;
}
