// Pricing configuration - Single source of truth for all pricing data
// Aligned with Stripe products

export const STRIPE_PRODUCTS = {
  // One-time purchases
  TRIP_PASS: {
    productId: 'prod_ToywVnpso9UJJy',
    priceId: 'price_1SrKykFYxIg9jcJUblEmckuq',
    name: 'Trip Pass',
    price: 12.99,
    mode: 'payment' as const,
  },
  
  // Subscriptions
  MONTHLY: {
    productId: 'prod_Toyw6Gw8394rU4',
    priceId: 'price_1SrKz2FYxIg9jcJUVbrbOfFl',
    name: 'Monthly',
    price: 15.99,
    mode: 'subscription' as const,
  },
  YEARLY: {
    productId: 'prod_ToywY2JIGIaU7e',
    priceId: 'price_1SrKz4FYxIg9jcJU8kMbZDSk',
    name: 'Yearly',
    price: 129,
    mode: 'subscription' as const,
  },
} as const;

// Top-up products (pay-per-action)
export const TOPUP_PRODUCTS = {
  ROUTE_OPTIMIZATION: {
    name: 'Route optimization',
    price: 1.99,
    description: 'Reorder your day for less walking and waiting',
  },
  BUILD_ONE_DAY: {
    name: 'Build one day',
    price: 3.99,
    description: 'Generate a single day of activities',
  },
  GROUP_BUDGET_SETUP: {
    name: 'Group budget setup',
    price: 2.99,
    description: 'Split expenses and track payments with companions',
  },
  BUILD_ENTIRE_TRIP: {
    name: 'Build full trip',
    price: 9.99,
    description: 'Generate a complete multi-day itinerary',
  },
} as const;

export const TOPUP_MINIMUM = 5;

// Plan feature definitions - outcome-focused copy
// "Finish, polish, perfect, compare, keep, take it with you"
export const PLAN_FEATURES = {
  FREE: {
    id: 'free',
    name: 'Free',
    headline: 'A full itinerary each month — on us.',
    subheadline: 'Perfect for trying Voyance and building a great first draft.',
    bestFor: 'Testing Voyance + drafting one trip.',
    price: 0,
    priceDetail: 'forever',
    features: [
      '1 Premium Itinerary Build / month',
      'Smart Refinements (up to 10 per trip)',
      'Route Preview (up to 3/month)',
      'Manual editing always free',
      'Save 1 draft trip at a time',
    ],
    notIncluded: [
      'No trip versioning',
      'No budget tracking',
      'No collaboration',
      'No export / print',
    ],
    limits: {
      fullBuildsPerMonth: 1,
      refinementsPerMonth: 10,
      routeOptimizationsPerMonth: 3,
      groupBudgetSetupsPerMonth: 0,
      draftTrips: 1,
      tripVersions: 0,
      flightHotelOptimization: false,
      coEditCollaboration: false,
      viewOnlySharing: true,
      budgetTracking: false,
      canPrint: false,
      canExport: false,
      canDownload: false,
      canCollaborate: false,
    },
    cta: 'Start Free',
  },
  TRIP_PASS: {
    id: 'trip_pass',
    name: 'Trip Pass',
    headline: 'Finish one trip like a pro.',
    subheadline: 'Everything unlocked for a single trip — perfect when you\'re ready to lock it in.',
    bestFor: 'A single upcoming trip you want to perfect.',
    price: 12.99,
    priceDetail: 'one-time',
    features: [
      'Unlimited Refinements (keep polishing)',
      'Budget Tracking (see costs as you tweak)',
      'Route + Map Layer (efficient plans)',
      'Trip Versions (compare without losing)',
      'Group Budget + Collaboration',
      'Export (PDF)',
    ],
    limits: {
      // Unlimited for purchased trip
      refinementsPerTrip: -1,
      budgetTracking: true,
      routeOptimization: true,
      tripVersions: -1,
      canPrint: true,
      canExport: true,
      canDownload: true,
      canCollaborate: true,
    },
    cta: 'Unlock This Trip',
  },
  MONTHLY: {
    id: 'monthly',
    name: 'Monthly',
    headline: 'Your travel planning rhythm.',
    subheadline: 'Plan multiple trips, iterate faster, and keep everything organized.',
    bestFor: 'People planning more than one trip, or refining over time.',
    price: 15.99,
    priceDetail: 'per month',
    features: [
      'Unlimited Refinements',
      'Route + Map Layer for every trip',
      'Budget Tracking for every trip',
      'Trip Versions (up to 4 per trip)',
      'Save up to 5 draft trips',
      'Collaboration + Group Budgeting',
      'Voyance Picks (smarter flight/hotel)',
      'Export (PDF)',
    ],
    limits: {
      fullBuildsPerMonth: -1,
      refinementsPerMonth: -1,
      routeOptimizationsPerMonth: -1,
      groupBudgetSetupsPerMonth: -1,
      draftTrips: 5,
      mysteryTripDrafts: 5,
      tripVersions: 4,
      flightHotelOptimization: true,
      groupBudgeting: true,
      coEditCollaboration: true,
      budgetTracking: true,
      mysteryTrips: true,
      canPrint: true,
      canExport: true,
      canDownload: true,
      canCollaborate: true,
    },
    cta: 'Go Monthly',
  },
  YEARLY: {
    id: 'yearly',
    name: 'Yearly',
    headline: 'Your planning home base.',
    subheadline: 'Best value for travelers who plan often — and want a trip archive over time.',
    bestFor: 'Frequent travelers and serious planners.',
    price: 129,
    priceDetail: 'per year',
    features: [
      'Everything in Monthly, plus:',
      'Unlimited draft trips (Trip Vault)',
      'Unlimited trip versions',
      'Preference learning over time',
      'Trip history archive',
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
    },
    cta: 'Go Yearly',
  },
} as const;

// Comparison table data for visual display
export const COMPARISON_TABLE = {
  headers: ['Feature', 'Free', 'Trip Pass', 'Monthly', 'Yearly'],
  rows: [
    { feature: 'Premium Itinerary Build', free: '1/month', tripPass: 'Unlimited (trip)', monthly: 'Unlimited', yearly: 'Unlimited' },
    { feature: 'Smart Refinements', free: 'Limited', tripPass: 'Unlimited (trip)', monthly: 'Unlimited', yearly: 'Unlimited' },
    { feature: 'Route + Map Layer', free: 'Preview', tripPass: 'Full', monthly: 'Full', yearly: 'Full' },
    { feature: 'Budget Tracking', free: '—', tripPass: '✓', monthly: '✓', yearly: '✓' },
    { feature: 'Trip Versions', free: '—', tripPass: '✓', monthly: 'Up to 4', yearly: 'Unlimited' },
    { feature: 'Draft Trips', free: '1', tripPass: '1', monthly: '5', yearly: 'Unlimited' },
    { feature: 'Export (PDF)', free: '—', tripPass: '✓', monthly: '✓', yearly: '✓' },
    { feature: 'Collaboration', free: '—', tripPass: '✓ (trip)', monthly: '✓', yearly: '✓' },
  ],
} as const;

// Helper to check if a feature is available for a plan
export function isPlanFeatureEnabled(
  planId: string, 
  feature: 'flightHotelOptimization' | 'groupBudgeting' | 'coEditCollaboration' | 'preferenceLearning' | 'budgetTracking'
): boolean {
  const plan = Object.values(PLAN_FEATURES).find(p => p.id === planId);
  if (!plan || !plan.limits) return false;
  return (plan.limits as Record<string, unknown>)[feature] === true;
}
