// Route configuration for Voyance
export const ROUTES = {
  // Public routes
  HOME: '/',
  DEMO: '/demo',
  EXPLORE: '/explore',
  DESTINATIONS: '/destinations',
  DESTINATION_DETAIL: '/destination/:slug',
  GUIDES: '/guides',
  TRAVEL_TIPS: '/travel-tips',
  ABOUT: '/about',
  ARCHETYPES: '/archetypes',
  ARCHETYPE_DETAIL: '/archetypes/:slug',
  HOW_IT_WORKS: '/how-it-works',
  CAREERS: '/careers',
  PRESS: '/press',
  
  // Support pages
  CONTACT: '/contact',
  FAQ: '/faq',
  HELP_CENTER: '/help',
  
  // Auth routes
  SIGNIN: '/signin',
  SIGNUP: '/signup',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  
  // Onboarding
  WELCOME: '/welcome',
  START: '/start',
  QUIZ: '/quiz',
  ONBOARD_CONVERSATION: '/onboard/conversation',
  
  // Profile
  PROFILE: {
    VIEW: '/profile',
    EDIT: '/profile/edit',
    SETTINGS: '/profile/settings',
    CREDITS: '/profile/credits',
    COMPLETE: '/profile/complete',
  },
  
  // Trip Planning
  PLANNER: {
    ROOT: '/planner',
    MULTI_CITY: '/planner/multi-city',
    FLIGHT: '/planner/flight',
    HOTEL: '/planner/hotel',
    SUMMARY: '/planner/summary',
    ITINERARY: '/planner/itinerary',
    BOOKING: '/planner/booking',
  },
  
  // Trip Management
  TRIP: {
    DASHBOARD: '/trip/dashboard',
    DETAIL: '/trip/:tripId',
    NEW: '/trip/new',
    GUIDE: '/trip/:tripId/guide',
  },
  
  // Itinerary
  ITINERARY: {
    VIEW: '/itinerary/:id',
    EDIT: '/itinerary/:id/edit',
    SAMPLE: '/sample-itinerary',
  },
  
  // Booking
  CONFIRMATION: '/trips/:tripId/confirmation',
  PURCHASE_COMPLETE: '/purchase-complete/:tripId',
  
  // Blog
  BLOG: {
    PUBLIC: '/blog/:slug',
    LIST: '/blog',
    CREATE: '/blog/create/:tripId',
    EDIT: '/blog/edit/:blogId',
  },
  
  // Legal
  PRIVACY: '/privacy',
  TERMS: '/terms',
  LEGAL_PRIVACY: '/legal/privacy',
  LEGAL_TERMS: '/legal/terms',
  PRICING: '/pricing',
  PAYMENT_SUCCESS: '/payment-success',
  
  // Agent CRM
  AGENT: {
    DASHBOARD: '/agent',
    CLIENTS: '/agent/clients',
    CLIENT_NEW: '/agent/clients/new',
    CLIENT_DETAIL: '/agent/clients/:clientId',
    TRIPS: '/agent/trips',
    TRIP_NEW: '/agent/trips/new',
    TRIP_DETAIL: '/agent/trips/:tripId',
    TASKS: '/agent/tasks',
    LIBRARY: '/agent/library',
    SETTINGS: '/agent/settings',
    DOCUMENTS: '/agent/documents',
    PAYOUTS: '/agent/payouts',
  },
} as const;

// Helper to build dynamic routes
export const buildRoute = {
  destination: (slug: string) => `/destination/${slug}`,
  trip: (tripId: string) => `/trip/${tripId}`,
  itinerary: (id: string) => `/itinerary/${id}`,
  itineraryEdit: (id: string) => `/itinerary/${id}/edit`,
  confirmation: (tripId: string) => `/trips/${tripId}/confirmation`,
  purchaseComplete: (tripId: string) => `/purchase-complete/${tripId}`,
};
