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
    price: 129,
    mode: 'subscription' as const,
  },
} as const;

// Plan feature definitions with monthly usage limits
// NOTE: "edits" = AI-powered activity swaps (e.g., "find me another restaurant")
// Manual changes (rearranging, adding notes, changing times, deleting) are ALWAYS FREE
export const PLAN_FEATURES = {
  FREE: {
    id: 'free',
    name: 'Free',
    headline: 'Discover what Voyance can do.',
    subheadline: 'One full itinerary per month. Enough to fall in love.',
    price: 0,
    priceDetail: 'forever',
    features: [
      '1 AI-generated itinerary per month',
      '10 AI activity swaps per month',
      '3 route optimizations per month',
      '1 group budget setup per month',
      'Unlimited manual edits',
      'Save 1 draft trip at a time',
    ],
    limits: {
      fullBuildsPerMonth: 1,
      aiEditsPerMonth: 10,
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
    name: 'Trip Pass',
    headline: 'Go all-in on one trip.',
    subheadline: 'Perfect when you know exactly where you are going.',
    price: 12.99,
    priceDetail: 'one-time',
    features: [
      'Unlimited AI rebuilds for this trip',
      'Unlimited AI activity swaps',
      'Unlimited route optimizations',
      'Group budgeting and expense splitting',
      'Co-edit with travel companions',
      'Weather tracking and alerts',
    ],
    limits: null, // Unlimited for purchased trip
    cta: 'Unlock This Trip',
  },
  MONTHLY: {
    id: 'monthly',
    name: 'Monthly',
    headline: 'For the always-planning traveler.',
    subheadline: 'Multiple trips. Smarter recommendations. Zero limits.',
    price: 15.99,
    priceDetail: 'per month',
    features: [
      'Unlimited AI itinerary builds',
      'Unlimited AI activity swaps',
      'Unlimited route optimizations',
      'Save up to 5 trips at once',
      'Smart flight and hotel picks',
      'Group budgeting on every trip',
      'Co-edit collaboration',
    ],
    limits: {
      fullBuildsPerMonth: -1, // Unlimited
      aiEditsPerMonth: -1,
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
    headline: 'Your travel command center.',
    subheadline: 'Everything unlimited. Preferences that learn. Best value.',
    price: 129,
    priceDetail: 'per year',
    features: [
      'Everything in Monthly',
      'Unlimited draft trips',
      'Unlimited trip versions',
      'Preference learning over time',
      'Trip history archive',
      'Priority support',
    ],
    limits: {
      fullBuildsPerMonth: -1,
      aiEditsPerMonth: -1,
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
