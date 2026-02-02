// Pricing configuration - Single source of truth for all pricing data
// Updated: Day-based model with Essential/Complete packages

export const STRIPE_PRODUCTS = {
  // À la carte days
  DAY_1: {
    productId: 'prod_TuJ6uEsn9JZwFR',
    priceId: 'price_1SwUUAFYxIg9jcJUIOZ30X3V',
    name: '1 Day',
    price: 9,
    days: 1,
    mode: 'payment' as const,
  },
  DAY_2: {
    productId: 'prod_TuJ67oBTCaXbwK',
    priceId: 'price_1SwUUBFYxIg9jcJU6OjLZWlW',
    name: '2 Days',
    price: 16,
    days: 2,
    savings: 2,
    mode: 'payment' as const,
  },
  
  // Escape packages (3 days)
  ESCAPE_ESSENTIAL: {
    productId: 'prod_TuJ6sVstk0s35i',
    priceId: 'price_1SwUUDFYxIg9jcJUZtZqNFrv',
    name: 'Escape Essential',
    price: 29,
    days: 3,
    tier: 'essential' as const,
    mode: 'payment' as const,
  },
  ESCAPE_COMPLETE: {
    productId: 'prod_TuJ6PqaalAiPnm',
    priceId: 'price_1SwUUEFYxIg9jcJUJZMHE06i',
    name: 'Escape Complete',
    price: 49,
    days: 3,
    tier: 'complete' as const,
    mode: 'payment' as const,
  },
  
  // Week packages (7 days)
  WEEK_ESSENTIAL: {
    productId: 'prod_TuJ6nEdTRdKMH3',
    priceId: 'price_1SwUUFFYxIg9jcJUDD0YDlvQ',
    name: 'Week Essential',
    price: 49,
    days: 7,
    tier: 'essential' as const,
    mode: 'payment' as const,
  },
  WEEK_COMPLETE: {
    productId: 'prod_TuJ6UVJV9jAdgn',
    priceId: 'price_1SwUUGFYxIg9jcJUM0RrP76m',
    name: 'Week Complete',
    price: 79,
    days: 7,
    tier: 'complete' as const,
    featured: true,
    mode: 'payment' as const,
  },
  
  // Extended packages (12 days)
  EXTENDED_ESSENTIAL: {
    productId: 'prod_TuJ6x93fokmK50',
    priceId: 'price_1SwUUHFYxIg9jcJUZmRQzSoQ',
    name: 'Extended Essential',
    price: 69,
    days: 12,
    tier: 'essential' as const,
    mode: 'payment' as const,
  },
  EXTENDED_COMPLETE: {
    productId: 'prod_TuJ6UizkY38Qsq',
    priceId: 'price_1SwUUIFYxIg9jcJUB9oWn90L',
    name: 'Extended Complete',
    price: 109,
    days: 12,
    tier: 'complete' as const,
    mode: 'payment' as const,
  },

  // Legacy products (for existing customers - not shown in UI)
  TRIP_PASS: {
    productId: 'prod_TrNlzMhbWMadTG',
    priceId: 'price_1StezbFYxIg9jcJUpN3X01Ox',
    name: 'Trip Pass',
    price: 24.99,
    days: 7, // Convert to 7 days for migration
    mode: 'payment' as const,
    deprecated: true,
  },
  CREDITS_5: {
    productId: 'prod_TrNllJjO44rfTT',
    priceId: 'price_1StezcFYxIg9jcJUJMy5waSO',
    name: '5 Credits',
    price: 79,
    days: 35, // 5 credits × 7 days each
    mode: 'payment' as const,
    deprecated: true,
  },
  CREDITS_10: {
    productId: 'prod_TrNlRyHAG5CPaL',
    priceId: 'price_1StezdFYxIg9jcJUeoYoMEEI',
    name: '10 Credits',
    price: 149,
    days: 70, // 10 credits × 7 days each
    mode: 'payment' as const,
    deprecated: true,
  },
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
  TRAVEL_AGENT: {
    productId: 'prod_TravelAgent',
    priceId: 'price_TravelAgent',
    name: 'Travel Agent',
    price: 79,
    mode: 'subscription' as const,
  },
} as const;

// Free tier limits - 1 day/month (banks up to 5), expires after 6 months
export const FREE_TIER_LIMITS = {
  daysPerMonth: 1,                 // 1 free day per month
  maxBankedDays: 5,               // Can accumulate up to 5 free days
  freeExpirationMonths: 6,        // Free days expire after 6 months
  maxActivitySwaps: 3,            // 3 swaps per month
  maxRegenerates: 1,              // 1 regenerate per month
  canExport: false,
  canShare: false,
  // Legacy compatibility
  maxVisibleDays: 1,
  maxItinerariesPerMonth: 5,
  canRegenerateDay: true,
  canBuildFullTrip: true,
} as const;

// Essential tier limits
export const ESSENTIAL_LIMITS = {
  activitySwaps: 5,
  regenerates: 2,
  canExport: true,
  canShare: true,
  routeOptimization: false,
  aiCompanion: false,
  restaurantAI: false,
  realTimeMode: false,
  companionSync: false,
  priorityGeneration: false,
} as const;

// Complete tier limits
export const COMPLETE_LIMITS = {
  activitySwaps: -1, // Unlimited
  regenerates: -1,   // Unlimited
  canExport: true,
  canShare: true,
  routeOptimization: true,
  aiCompanion: true,
  restaurantAI: true,
  realTimeMode: true,
  companionSync: true,
  priorityGeneration: true,
} as const;

// Package definitions for display
export const PACKAGES = {
  ESCAPE: {
    id: 'escape',
    name: 'Escape',
    days: 3,
    essential: STRIPE_PRODUCTS.ESCAPE_ESSENTIAL,
    complete: STRIPE_PRODUCTS.ESCAPE_COMPLETE,
  },
  WEEK: {
    id: 'week',
    name: 'Week',
    days: 7,
    essential: STRIPE_PRODUCTS.WEEK_ESSENTIAL,
    complete: STRIPE_PRODUCTS.WEEK_COMPLETE,
    featured: true,
  },
  EXTENDED: {
    id: 'extended',
    name: 'Extended',
    days: 12,
    essential: STRIPE_PRODUCTS.EXTENDED_ESSENTIAL,
    complete: STRIPE_PRODUCTS.EXTENDED_COMPLETE,
  },
} as const;

// Features included in each tier
export const TIER_FEATURES = {
  essential: [
    'Full personalized itinerary',
    'All days unlocked',
    '5 activity swaps',
    '2 day regenerates',
    'PDF export',
    'Share with companions',
  ],
  complete: [
    'Everything in Essential',
    'Unlimited swaps & regenerates',
    'Route optimization',
    'AI trip companion',
    'Restaurant AI',
    'Real-time trip mode',
    'Companion sync',
    'Priority generation',
  ],
} as const;

// Comparison table for pricing page
export const COMPARISON_TABLE = {
  headers: ['Feature', 'Free', 'Essential', 'Complete'],
  rows: [
    { feature: 'Travel DNA Quiz', free: '✓', essential: '✓', complete: '✓' },
    { feature: 'Days Visible', free: 'Day 1 only', essential: 'All days', complete: 'All days' },
    { feature: 'Activity Swaps', free: '3/month', essential: '5 per package', complete: 'Unlimited' },
    { feature: 'Regenerate Days', free: '1/month', essential: '2 per package', complete: 'Unlimited' },
    { feature: 'Export (PDF)', free: '-', essential: '✓', complete: '✓' },
    { feature: 'Share with Companions', free: '-', essential: '✓', complete: '✓' },
    { feature: 'Route Optimization', free: '-', essential: '-', complete: '✓' },
    { feature: 'AI Trip Companion', free: '-', essential: '-', complete: '✓' },
    { feature: 'Restaurant AI', free: '-', essential: '-', complete: '✓' },
    { feature: 'Real-time Trip Mode', free: '-', essential: '-', complete: '✓' },
  ],
} as const;

// Plan feature definitions (for legacy compatibility and detailed displays)
export const PLAN_FEATURES = {
  FREE: {
    id: 'free',
    name: 'Free',
    headline: 'Discover your Travel DNA.',
    subheadline: 'Get 1 free day per month (banks up to 5). See Day 1 of your trip—unlock more when ready.',
    bestFor: 'Exploring what personalized travel planning feels like.',
    price: 0,
    priceDetail: 'forever',
    features: [
      'Travel DNA quiz & archetype',
      '1 free day per month (accumulates)',
      'Preview your arrival day',
      '3 activity swaps per month',
      '1 day regenerate per month',
    ],
    notIncluded: [
      'Days 2+ (blurred until upgrade)',
      'More swaps & regenerates',
      'Export / print',
      'Collaboration',
    ],
    limits: FREE_TIER_LIMITS,
    cta: 'Start Free',
  },
  ESSENTIAL: {
    id: 'essential',
    name: 'Essential',
    headline: 'Your full personalized trip.',
    subheadline: 'All days unlocked with swaps, regenerates, and export.',
    bestFor: 'Standard trips with full itinerary access.',
    features: TIER_FEATURES.essential,
    limits: ESSENTIAL_LIMITS,
  },
  COMPLETE: {
    id: 'complete',
    name: 'Complete',
    headline: 'The ultimate travel experience.',
    subheadline: 'Unlimited modifications plus AI companion features.',
    bestFor: 'Travelers who want maximum flexibility and AI assistance.',
    features: TIER_FEATURES.complete,
    limits: COMPLETE_LIMITS,
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

// Helper to calculate per-day price
export function getPerDayPrice(price: number, days: number): string {
  return (price / days).toFixed(2);
}

// Helper to check if a feature is available for a tier
export function isTierFeatureEnabled(
  tier: 'free' | 'essential' | 'complete', 
  feature: keyof typeof COMPLETE_LIMITS
): boolean {
  if (tier === 'free') return false;
  if (tier === 'essential') return ESSENTIAL_LIMITS[feature] === true || (typeof ESSENTIAL_LIMITS[feature] === 'number' && ESSENTIAL_LIMITS[feature] > 0);
  return COMPLETE_LIMITS[feature] === true || COMPLETE_LIMITS[feature] === -1;
}

// Legacy helper for backwards compatibility
export function isPlanFeatureEnabled(
  planId: string, 
  feature: 'flightHotelOptimization' | 'groupBudgeting' | 'coEditCollaboration' | 'preferenceLearning' | 'budgetTracking'
): boolean {
  const plan = Object.values(PLAN_FEATURES).find(p => p.id === planId);
  if (!plan || !plan.limits) return false;
  return (plan.limits as Record<string, unknown>)[feature] === true;
}

// Migration helpers for legacy purchases
export const LEGACY_CONVERSION = {
  TRIP_PASS: { days: 7, tier: 'essential' as const },
  CREDITS_5: { days: 35, tier: 'essential' as const }, // 5 × 7
  CREDITS_10: { days: 70, tier: 'essential' as const }, // 10 × 7
} as const;
