/**
 * E2E Test Fixtures
 * 
 * Provides test data and helpers for E2E tests.
 * Uses unique identifiers per test run to avoid conflicts.
 */

// Generate unique test run ID to prevent conflicts between parallel tests
const TEST_RUN_ID = Date.now();

/**
 * Test user credentials for authentication tests
 */
export const TEST_USER = {
  email: `e2e-test-${TEST_RUN_ID}@voyance-test.local`,
  password: 'TestPassword123!',
  firstName: 'E2E',
  lastName: 'Tester',
  weakPassword: 'weak',
  invalidEmail: 'not-an-email',
};

/**
 * Generate a unique test user for isolated tests
 */
export function generateTestUser(suffix?: string) {
  const uniqueId = `${TEST_RUN_ID}-${suffix || Math.random().toString(36).substring(7)}`;
  return {
    email: `e2e-test-${uniqueId}@voyance-test.local`,
    password: 'TestPassword123!',
    firstName: 'E2E',
    lastName: 'Tester',
  };
}

/**
 * Test trip data for trip planning tests
 */
export const TEST_TRIP = {
  destination: 'Paris, France',
  destinationShort: 'Paris',
  // Use dates 30-37 days in the future
  startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  endDate: new Date(Date.now() + 37 * 24 * 60 * 60 * 1000),
  travelers: 2,
  tripType: 'romantic',
  budget: 'moderate',
};

/**
 * Format date for date picker input
 */
export function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format date for display comparison
 */
export function formatDateForDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Test quiz answers for Travel DNA quiz
 */
export const TEST_QUIZ_ANSWERS = {
  // Sample answers that would result in "Cultural Explorer" archetype
  step1: ['culture', 'history'],
  step2: ['moderate'],
  step3: ['immersive'],
};

/**
 * Test travel story for onboard conversation
 */
export const TEST_TRAVEL_STORY = `
I love exploring local markets and hidden cafes. 
My ideal trip involves wandering through historic neighborhoods, 
trying authentic local cuisine, and avoiding touristy spots.
I prefer a relaxed pace with plenty of time to soak in the atmosphere.
`;

/**
 * Edge function endpoints for health checks
 */
export const EDGE_FUNCTIONS = {
  generateItinerary: 'generate-itinerary',
  analyzePreferences: 'analyze-preferences',
  flights: 'flights',
  hotels: 'hotels',
  spendCredits: 'spend-credits',
  createBookingCheckout: 'create-booking-checkout',
  parseTravelStory: 'parse-travel-story',
  calculateTravelDna: 'calculate-travel-dna',
};

/**
 * Public routes that don't require authentication
 */
export const PUBLIC_ROUTES = [
  '/',
  '/explore',
  '/destinations',
  '/signin',
  '/signup',
  '/forgot-password',
  '/about',
  '/how-it-works',
  '/archetypes',
  '/pricing',
  '/privacy',
  '/terms',
];

/**
 * Protected routes that require authentication
 */
export const PROTECTED_ROUTES = [
  '/profile',
  '/profile/edit',
  '/profile/settings',
  '/trip/dashboard',
  '/start',
];

/**
 * Wait times for various operations (in ms)
 */
export const WAIT_TIMES = {
  pageLoad: 3000,
  apiCall: 5000,
  animation: 500,
  aiGeneration: 30000,
};
