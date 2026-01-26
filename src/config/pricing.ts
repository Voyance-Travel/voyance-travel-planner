// Pricing configuration - Single source of truth for all pricing data
// Updated: Trip Pass $24.99, 5 Credits $79, 10 Credits $149

export const STRIPE_PRODUCTS = {
  // One-time purchases
  TRIP_PASS: {
    productId: 'prod_TrNlzMhbWMadTG',
    priceId: 'price_1StezbFYxIg9jcJUpN3X01Ox',
    name: 'Trip Pass',
    price: 24.99,
    mode: 'payment' as const,
  },
  CREDITS_5: {
    productId: 'prod_TrNllJjO44rfTT',
    priceId: 'price_1StezcFYxIg9jcJUJMy5waSO',
    name: '5 Credits',
    price: 79,
    credits: 5,
    mode: 'payment' as const,
  },
  CREDITS_10: {
    productId: 'prod_TrNlRyHAG5CPaL',
    priceId: 'price_1StezdFYxIg9jcJUeoYoMEEI',
    name: '10 Credits',
    price: 149,
    credits: 10,
    mode: 'payment' as const,
  },
  
  // Legacy - keeping for existing customers but not shown in UI
  MONTHLY: {
    productId: 'prod_Toyw6Gw8394rU4',
    priceId: 'price_1SrKz2FYxIg9jcJUVbrbOfFl',
    name: 'Monthly',
    price: 15.99,
    mode: 'subscription' as const,
    deprecated: true,
  },
  YEARLY: {
    productId: 'prod_ToywY2JIGIaU7e',
    priceId: 'price_1SrKz4FYxIg9jcJU8kMbZDSk',
    name: 'Yearly',
    price: 129,
    mode: 'subscription' as const,
    deprecated: true,
  },
  // Travel Agent subscription
  TRAVEL_AGENT: {
    productId: 'prod_TravelAgent',
    priceId: 'price_TravelAgent',
    name: 'Travel Agent',
    price: 79,
    mode: 'subscription' as const,
  },
} as const;

// Credit costs - what each action costs in credits
export const CREDIT_COSTS = {
  BUILD_FULL_TRIP: 1,      // 1 credit to build a full trip
  REGENERATE_DAY: 1,       // 1 credit to regenerate a day
  SWAP_ACTIVITY: 1,        // 1 credit to swap an activity
} as const;

// Free tier limits
export const FREE_TIER_LIMITS = {
  maxVisibleDays: 1,           // Can only see Day 1 of itinerary
  maxActivitySwaps: 3,         // Can only swap 3 activities total
  canRegenerateDay: false,     // Cannot regenerate days
  canBuildFullTrip: true,      // Can build one trip (to see Day 1)
  canExport: false,
  canShare: false,
} as const;

// Plan feature definitions
export const PLAN_FEATURES = {
  FREE: {
    id: 'free',
    name: 'Free',
    headline: 'Preview your perfect trip.',
    subheadline: 'Build any itinerary and see Day 1 for free. Upgrade to unlock the full experience.',
    bestFor: 'Trying Voyance before you commit.',
    price: 0,
    priceDetail: 'forever',
    features: [
      'Build unlimited itineraries',
      'See Day 1 of any trip',
      'Swap up to 3 activities',
      'Manual editing always free',
    ],
    notIncluded: [
      'View Days 2+ (requires upgrade)',
      'Regenerate days',
      'Export / print',
      'Collaboration',
    ],
    limits: FREE_TIER_LIMITS,
    cta: 'Start Free',
  },
  TRIP_PASS: {
    id: 'trip_pass',
    name: 'Trip Pass',
    headline: 'Unlock your entire trip.',
    subheadline: 'Full access to one complete itinerary — all days, unlimited swaps, and export.',
    bestFor: 'Planning a single upcoming trip.',
    price: 24.99,
    priceDetail: 'one-time',
    features: [
      'See all days of your itinerary',
      'Unlimited activity swaps',
      'Regenerate any day',
      'Export to PDF',
      'Share with travel companions',
      'Route optimization',
    ],
    limits: {
      maxVisibleDays: -1, // Unlimited
      maxActivitySwaps: -1,
      canRegenerateDay: true,
      canExport: true,
      canShare: true,
    },
    cta: 'Unlock Trip — $24.99',
  },
  CREDITS_5: {
    id: 'credits_5',
    name: '5 Credits',
    headline: 'Credits for the road.',
    subheadline: 'Use credits to build trips, regenerate days, or swap activities across any itinerary.',
    bestFor: 'Flexible planning across multiple trips.',
    price: 79,
    priceDetail: 'one-time',
    credits: 5,
    features: [
      '5 credits to use anytime',
      '1 credit = build a trip, regenerate a day, or swap an activity',
      'Credits never expire',
      'Use across multiple trips',
    ],
    limits: {
      credits: 5,
    },
    cta: 'Buy 5 Credits — $79',
  },
  CREDITS_10: {
    id: 'credits_10',
    name: '10 Credits',
    headline: 'Best value for frequent planners.',
    subheadline: 'More credits, more trips, more flexibility.',
    bestFor: 'Travelers who plan multiple trips.',
    price: 149,
    priceDetail: 'one-time',
    credits: 10,
    features: [
      '10 credits to use anytime',
      '1 credit = build a trip, regenerate a day, or swap an activity',
      'Credits never expire',
      'Use across multiple trips',
      'Save ~15% vs 5 credits',
    ],
    limits: {
      credits: 10,
    },
    cta: 'Buy 10 Credits — $149',
  },
  // ============================================
  // TRAVEL AGENT TIERS - Professional Plans
  // ============================================
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
  // Legacy single agent tier (for backwards compatibility)
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

// Comparison table data for visual display
export const COMPARISON_TABLE = {
  headers: ['Feature', 'Free', 'Trip Pass', '5 Credits', '10 Credits'],
  rows: [
    { feature: 'Build Itineraries', free: '✓', tripPass: '✓', credits5: '✓', credits10: '✓' },
    { feature: 'View All Days', free: 'Day 1 only', tripPass: 'All days', credits5: 'All days', credits10: 'All days' },
    { feature: 'Activity Swaps', free: '3 total', tripPass: 'Unlimited', credits5: '1 credit each', credits10: '1 credit each' },
    { feature: 'Regenerate Days', free: '-', tripPass: 'Unlimited', credits5: '1 credit each', credits10: '1 credit each' },
    { feature: 'Export (PDF)', free: '-', tripPass: '✓', credits5: '✓', credits10: '✓' },
    { feature: 'Route Optimization', free: '-', tripPass: '✓', credits5: '✓', credits10: '✓' },
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
