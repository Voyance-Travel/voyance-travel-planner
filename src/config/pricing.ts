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

// Top-up products (pay-per-action) for free users
// Minimum top-up: $5
export const TOPUP_PRODUCTS = {
  ROUTE_OPTIMIZATION: {
    name: 'Route Optimization',
    price: 1.99,
    description: 'Reorder your day for less walking and waiting',
  },
  BUILD_ONE_DAY: {
    name: 'Build One Day',
    price: 3.99,
    description: 'Generate a single day of activities',
  },
  GROUP_BUDGET_SETUP: {
    name: 'Group Budget Setup',
    price: 2.99,
    description: 'Split expenses and track payments with companions',
  },
  BUILD_ENTIRE_TRIP: {
    name: 'Build Entire Trip',
    price: 9.99,
    description: 'Generate a complete multi-day itinerary',
  },
} as const;

export const TOPUP_MINIMUM = 5; // Minimum add: $5

// Plan feature definitions with monthly usage limits
// NOTE: "Smart Refinements" = AI-powered changes (swap a restaurant, adjust vibe, optimize a block)
// Manual changes (move, delete, reorder, notes) are ALWAYS FREE
export const PLAN_FEATURES = {
  FREE: {
    id: 'free',
    name: 'Free',
    headline: 'Discover what Voyance can do.',
    subheadline: 'One full itinerary per month. Enough to fall in love.',
    price: 0,
    priceDetail: 'forever',
    features: [
      '1 Premium AI Itinerary per month',
      '10 Smart Refinements per month',
      'Unlimited manual edits',
      'Share view-only links',
      'No export or download',
    ],
    limits: {
      fullBuildsPerMonth: 1,
      refinementsPerMonth: 10,
      routeOptimizationsPerMonth: 3,
      groupBudgetSetupsPerMonth: 1,
      draftTrips: 1,
      flightHotelOptimization: false,
      coEditCollaboration: false,
      viewOnlySharing: true,
      // Free tier restrictions
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
    headline: 'Go all-in on one trip.',
    subheadline: 'Perfect when you know exactly where you are going.',
    price: 12.99,
    priceDetail: 'one-time',
    features: [
      'Unlimited itinerary rebuilds',
      'Unlimited Smart Refinements',
      'Group budgeting and expense splitting',
      'Co-edit with travel companions',
      'Export, print, and download',
    ],
    limits: {
      // Unlimited for purchased trip
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
    headline: 'For the always-planning traveler.',
    subheadline: 'Multiple trips. Smarter recommendations. Zero limits.',
    price: 15.99,
    priceDetail: 'per month',
    features: [
      'Unlimited Premium Itineraries',
      'Unlimited Smart Refinements',
      'Save up to 5 trips at once',
      'Smart flight and hotel picks',
      'Group budgeting on every trip',
      'Export, print, and download',
    ],
    limits: {
      fullBuildsPerMonth: -1, // Unlimited
      refinementsPerMonth: -1,
      routeOptimizationsPerMonth: -1,
      groupBudgetSetupsPerMonth: -1,
      draftTrips: 5,
      mysteryTripDrafts: 5,
      tripVersions: 4,
      flightHotelOptimization: true,
      groupBudgeting: true,
      coEditCollaboration: true,
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
      refinementsPerMonth: -1,
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
      canPrint: true,
      canExport: true,
      canDownload: true,
      canCollaborate: true,
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
