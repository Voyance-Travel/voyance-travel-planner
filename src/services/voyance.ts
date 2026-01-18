/**
 * Voyance Backend Services - Unified Export
 * 
 * All backend calls now go through Supabase directly or Edge Functions.
 */

// Auth Service
export { default as voyanceAuth } from './voyanceAuth';
export {
  type BackendUser,
  type BackendProfile,
  type AuthResponse,
  getStoredToken,
  setStoredToken as setTokens,
  clearTokens,
  getAuthHeader,
  signUp as signup,
  signIn as login,
  signOut as logout,
  getCurrentUser,
  resetPassword,
  updatePassword as changePassword,
  signInWithGoogle,
  checkAuthHealth,
} from './voyanceAuth';

// Voyance API
export { default as voyanceAPI } from './voyanceAPI';
export {
  type BackendTrip,
  type UserPreferences,
  type BudgetPreference,
  type PacePreference,
  type TripStatus,
  getTrips,
  getTrip,
  createTrip,
  updateTrip,
  deleteTrip,
  getPreferences,
  updatePreferences,
} from './voyanceAPI';

// Profile API
export { default as profileAPI } from './profileAPI';
export {
  type UserProfile,
  type TravelDNA,
  type ProfileResponse,
  getProfile,
  updateProfile,
  useProfile,
  useUpdateProfile,
} from './profileAPI';

// User API
export { default as userAPI } from './userAPI';
export {
  type TripStats,
  type TripStatsSummary,
  type OnboardingStatus,
  getTripStats,
  getOnboardingStatus,
  useTripStats,
  useOnboardingStatus,
} from './userAPI';

// Planner API
export { default as plannerAPI } from './plannerAPI';
export {
  type PlannerTrip,
  type TripCreateInput,
  createPlannerTrip,
  getPlannerTrip,
  updatePlannerTrip,
  usePlannerTrip,
  useCreatePlannerTrip,
} from './plannerAPI';

// Quiz API
export { default as quizAPI } from './quizAPI';

// Diagnostics (stub for compatibility)
export const voyanceDiagnostics = {
  checkHealth: async () => ({ healthy: true }),
};

// Default export
const voyance = {
  auth: {} as typeof import('./voyanceAuth').default,
  api: {} as typeof import('./voyanceAPI').default,
  profile: {} as typeof import('./profileAPI').default,
  user: {} as typeof import('./userAPI').default,
  planner: {} as typeof import('./plannerAPI').default,
};

export default voyance;
