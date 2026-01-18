// Route configuration for Voyance
export const ROUTES = {
  // Public routes
  HOME: '/',
  EXPLORE: '/explore',
  DESTINATIONS: '/destinations',
  DESTINATION_DETAIL: '/destination/:slug',
  GUIDES: '/guides',
  ABOUT: '/about',
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
  
  // Profile
  PROFILE: {
    VIEW: '/profile',
    EDIT: '/profile/edit',
    SETTINGS: '/profile/settings',
    COMPLETE: '/profile/complete',
  },
  
  // Trip Planning
  PLANNER: {
    ROOT: '/planner',
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
  
  // Legal
  PRIVACY: '/privacy',
  TERMS: '/terms',
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
