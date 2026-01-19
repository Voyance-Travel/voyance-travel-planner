// Pricing configuration - Single source of truth for all pricing data
// Aligned with Stripe products

export const STRIPE_PRODUCTS = {
  // One-time purchases
  TRIP_PASS: {
    productId: 'prod_ToywVnpso9UJJy',
    priceId: 'price_1SrKykFYxIg9jcJUblEmckuq',
    name: 'Single Trip Pass',
    price: 12.99,
    mode: 'payment' as const,
  },
  
  // Subscriptions
  MONTHLY: {
    productId: 'prod_Toyw6Gw8394rU4',
    priceId: 'price_1SrKz2FYxIg9jcJUVbrbOfFl',
    name: 'Voyager Monthly',
    price: 15.99,
    mode: 'subscription' as const,
  },
  YEARLY: {
    productId: 'prod_ToywY2JIGIaU7e',
    priceId: 'price_1SrKz4FYxIg9jcJU8kMbZDSk',
    name: 'Voyager Yearly',
    price: 99,
    mode: 'subscription' as const,
  },
} as const;

// Plan feature definitions with monthly usage limits
export const PLAN_FEATURES = {
  FREE: {
    id: 'free',
    name: 'Free',
    headline: 'Try Voyance with one full itinerary.',
    subheadline: 'Build one trip per month at full power. Limited route and budget tools.',
    price: 0,
    priceDetail: 'forever',
    features: [
      '1 full itinerary build per month',
      '3 route optimizations per month',
      '1 group budget setup per month',
      'Save 1 draft trip at a time',
      'Keep your built itinerary forever',
      'Share view-only links',
    ],
    limits: {
      fullBuildsPerMonth: 1,
      routeOptimizationsPerMonth: 3,
      groupBudgetSetupsPerMonth: 1,
      draftTrips: 1,
      flightHotelOptimization: false,
      coEditCollaboration: false,
    },
    cta: 'Start Free',
  },
  TRIP_PASS: {
    id: 'trip_pass',
    name: 'Single Trip Pass',
    headline: 'Unlock everything for one trip.',
    subheadline: 'Best for planning a specific trip right now.',
    price: 12.99,
    priceDetail: 'one-time',
    features: [
      'Unlimited itinerary rebuilds for this trip',
      'Unlimited route optimizations',
      'Group budgeting tools',
      'Co-edit collaboration',
      'Weather tracking',
    ],
    limits: null, // Unlimited for purchased trip
    cta: 'Unlock This Trip',
  },
  MONTHLY: {
    id: 'monthly',
    name: 'Monthly',
    headline: 'Plan multiple trips with smarter tools.',
    subheadline: 'Best for comparing destinations or planning several trips.',
    price: 15.99,
    priceDetail: 'per month',
    features: [
      'Save up to 5 draft trips at once',
      'Unlimited itinerary builds and rebuilds',
      'Unlimited route optimizations',
      'Unlimited group budget setups',
      'Smart flight and hotel picks',
      'Co-edit collaboration',
    ],
    limits: {
      fullBuildsPerMonth: -1, // Unlimited
      routeOptimizationsPerMonth: -1,
      groupBudgetSetupsPerMonth: -1,
      draftTrips: 5,
      mysteryTripDrafts: 5,
      tripVersions: 4,
      flightHotelOptimization: true,
      groupBudgeting: true,
      coEditCollaboration: true,
      mysteryTrips: true,
    },
    cta: 'Go Monthly',
  },
  YEARLY: {
    id: 'yearly',
    name: 'Yearly',
    headline: 'Your travel planning home base.',
    subheadline: 'Unlimited everything. Best value for frequent planners.',
    price: 99,
    priceDetail: 'per year',
    features: [
      'Everything in Monthly',
      'Unlimited draft trips',
      'Unlimited trip versions',
      'Preference learning over time',
      'Trip history archive',
    ],
    limits: {
      fullBuildsPerMonth: -1,
      routeOptimizationsPerMonth: -1,
      groupBudgetSetupsPerMonth: -1,
      draftTrips: -1, // Unlimited
      mysteryTripDrafts: -1,
      tripVersions: -1,
      flightHotelOptimization: true,
      groupBudgeting: true,
      coEditCollaboration: true,
      preferenceLearning: true,
      mysteryTrips: true,
    },
    cta: 'Go Yearly',
  },
} as const;

// Helper to check if a feature is available for a plan
export function isPlanFeatureEnabled(
  planId: string, 
  feature: 'flightHotelOptimization' | 'groupBudgeting' | 'coEditCollaboration' | 'preferenceLearning'
): boolean {
  const plan = Object.values(PLAN_FEATURES).find(p => p.id === planId);
  if (!plan || !plan.limits) return false;
  return (plan.limits as Record<string, unknown>)[feature] === true;
}
