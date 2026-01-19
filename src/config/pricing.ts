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

// Credit costs for wallet/top-up system (in cents)
export const CREDIT_COSTS = {
  BUILD_DAY: 399,          // $3.99
  BUILD_FULL_TRIP: 999,    // $9.99
  ROUTE_OPTIMIZE: 199,     // $1.99
  GROUP_BUDGET_SETUP: 299, // $2.99
} as const;

// Minimum top-up amount (in cents)
export const MIN_TOPUP_CENTS = 500; // $5.00

// Plan feature definitions
export const PLAN_FEATURES = {
  FREE: {
    id: 'free',
    name: 'Free',
    headline: 'Your first full itinerary is on us.',
    subheadline: 'Build one trip at full power. Save one draft. Plan manually after.',
    price: 0,
    priceDetail: 'forever',
    features: [
      '1 full itinerary build (full power)',
      'Save 1 draft trip at a time',
      'Keep your built itinerary forever',
      'Manual itinerary skeleton (DIY mode)',
      'Share your trip link (view-only)',
      'Activity locking',
    ],
    limits: {
      fullBuilds: 1,
      draftTrips: 1,
      dayRebuilds: 0,
      flightHotelOptimization: false,
      groupBudgeting: false,
      coEditCollaboration: false,
    },
    cta: 'Start Free',
  },
  TRIP_PASS: {
    id: 'trip_pass',
    name: 'Single Trip Pass',
    headline: 'Unlock everything for one trip.',
    subheadline: 'Best if you\'re planning one real trip right now.',
    price: 12.99,
    priceDetail: 'one-time',
    features: [
      'Unlimited itinerary rebuilds for this trip',
      'Unlimited day builds & rebuilds',
      'Transportation + route optimization',
      'Weather tracker',
      'Group budgeting tools',
      'Co-edit collaboration',
    ],
    limits: null, // Unlimited for purchased trip
    cta: 'Unlock This Trip',
  },
  MONTHLY: {
    id: 'monthly',
    name: 'Monthly',
    headline: 'Plan multiple trips + smarter flight/hotel picks.',
    subheadline: 'Best if you compare destinations or plan more than one trip.',
    price: 15.99,
    priceDetail: 'per month',
    features: [
      'Save up to 5 draft trips at once',
      'Flight + hotel optimization ("Voyance Picks")',
      'Trip versions (up to 4 per trip)',
      'Unlimited day builds & rebuilds',
      'Co-edit collaboration + group budgeting',
      'Transportation + route optimization',
      'Weather tracker',
    ],
    limits: {
      fullBuilds: -1, // Unlimited
      draftTrips: 5,
      tripVersions: 4,
      dayRebuilds: -1,
      flightHotelOptimization: true,
      groupBudgeting: true,
      coEditCollaboration: true,
    },
    cta: 'Go Monthly',
  },
  YEARLY: {
    id: 'yearly',
    name: 'Yearly',
    headline: 'Your travel planning home base.',
    subheadline: 'Unlimited drafts, deeper personalization over time, best value.',
    price: 99,
    priceDetail: 'per year',
    features: [
      'Everything in Monthly',
      'Unlimited draft trips ("Trip Vault")',
      'Unlimited trip versions',
      'Preference learning over time',
      'Saved presets & reusable templates',
      'Trip history archive',
    ],
    limits: {
      fullBuilds: -1,
      draftTrips: -1, // Unlimited
      tripVersions: -1,
      dayRebuilds: -1,
      flightHotelOptimization: true,
      groupBudgeting: true,
      coEditCollaboration: true,
      preferenceLearning: true,
    },
    cta: 'Go Yearly — Save 48%',
  },
} as const;

// Top-up options for wallet
export const TOPUP_OPTIONS = [
  { amount: 500, label: '$5' },
  { amount: 1000, label: '$10' },
  { amount: 2000, label: '$20' },
  { amount: 5000, label: '$50' },
] as const;

// Credit spend menu (what users can buy with credits)
export const CREDIT_MENU = [
  { 
    key: 'build_day',
    label: 'Build 1 day',
    cost: CREDIT_COSTS.BUILD_DAY,
    description: 'AI-generate activities for one day',
  },
  { 
    key: 'build_full_trip',
    label: 'Build full trip',
    cost: CREDIT_COSTS.BUILD_FULL_TRIP,
    description: 'AI-generate complete itinerary',
  },
  { 
    key: 'route_optimize',
    label: 'Route + transportation',
    cost: CREDIT_COSTS.ROUTE_OPTIMIZE,
    description: 'Optimize travel between activities',
  },
  { 
    key: 'group_budget_setup',
    label: 'Group budget setup',
    cost: CREDIT_COSTS.GROUP_BUDGET_SETUP,
    description: 'Auto-split expenses for your group',
  },
] as const;

// Helper to check if a feature is available for a plan
export function isPlanFeatureEnabled(
  planId: string, 
  feature: 'flightHotelOptimization' | 'groupBudgeting' | 'coEditCollaboration' | 'preferenceLearning'
): boolean {
  const plan = Object.values(PLAN_FEATURES).find(p => p.id === planId);
  if (!plan || !plan.limits) return false;
  return (plan.limits as Record<string, unknown>)[feature] === true;
}
