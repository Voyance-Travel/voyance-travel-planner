/**
 * Voyance Backend Services - Unified Export
 * 
 * Central entry point for all Voyance backend integrations.
 * Import from here for cleaner imports across the app.
 * 
 * Usage:
 *   import { voyanceAuth, quizAPI, voyanceDiagnostics } from '@/services/voyance';
 *   // or
 *   import voyance from '@/services/voyance';
 */

// Auth Service
export { default as voyanceAuth } from './voyanceAuth';
export {
  // Types
  type BackendUser,
  type BackendProfile,
  type AuthResponse,
  type GoogleAuthUrlResponse,
  type PasswordResetResponse,
  type DiagnosticsResponse,
  
  // Token management
  getStoredToken,
  getStoredRefreshToken,
  setTokens,
  clearTokens,
  getAuthHeader,
  
  // Auth operations
  signup,
  login,
  logout,
  getCurrentUser,
  verifyToken,
  getGoogleAuthUrl,
  googleCallback,
  refreshAccessToken,
  getProfile,
  checkAuth,
  
  // Debug
  debugAuthStatus,
  debugCurrentSession,
  
  // Diagnostics
  checkNeonAuthDiagnostics,
  checkAuthHealth,
  authHealthCheck,
  
  // Password reset
  requestPasswordReset,
  resetPassword,
  changePassword,
} from './voyanceAuth';

// Quiz API Service (step-based)
export { default as quizAPI } from './quizAPI';
export {
  // Types
  type QuizField,
  type QuizSession,
  type QuizStartResponse,
  type QuizSaveStepResponse,
  type QuizProgressResponse,
  type QuizSessionStatusResponse,
  type QuizFinalizeResponse,
  
  // API functions
  startQuiz,
  saveQuizStep,
  updateQuizProgress,
  getQuizSession,
  finalizeQuiz,
  getTravelDNA,
  
  // React Query hooks
  useQuizSession,
  useStartQuiz,
  useSaveQuizStep,
  useUpdateQuizProgress,
  useFinalizeQuiz,
  useTravelDNA,
  
  // Local storage helpers
  saveQuizSessionLocally,
  getLocalQuizSession,
  saveQuizAnswersLocally,
  getLocalQuizAnswers,
  clearLocalQuizData,
} from './quizAPI';

// Quiz Sections API (section-based alternative)
export { default as quizSectionsAPI } from './quizSectionsAPI';
export {
  // Types
  type QuizSection,
  type QuizProgress,
  type QuizSectionsResponse,
  type SaveSectionResponse,
  type ResetQuizResponse,
  type CompleteQuizResponse,
  
  // API functions
  getQuizSections,
  saveQuizSection,
  getQuizProgress,
  resetQuiz,
  completeQuizFinal,
  
  // React Query hooks
  useQuizSections,
  useQuizProgress,
  useSaveQuizSection,
  useResetQuiz,
  useCompleteQuizFinal,
} from './quizSectionsAPI';

// Diagnostics Service
export { default as voyanceDiagnostics } from './voyanceDiagnostics';
export {
  // Types
  type AuthDebugInfo,
  type SessionDebugInfo,
  type UserDebugInfo,
  type NeonAuthDiagnostics,
  type AuthHealthInfo,
  type JwtTestInfo,
  type SystemTestResult,
  type QuizFlowTestResult,
  
  // Debug endpoints
  getAuthDebugStatus,
  getCurrentSessionDebug,
  debugUserByEmail,
  debugUsersBatch,
  
  // Diagnostics
  getNeonAuthDiagnostics,
  getAuthHealthDiagnostics,
  getJwtTestDiagnostics,
  checkAuthHealthSimple,
  
  // System test
  runUserSystemTest,
  testQuizFlow,
  runSystemTest,
  getSystemTestStatus,
  
  // OAuth debug
  getGoogleOAuthConfig,
} from './voyanceDiagnostics';

// Connection Risk API
export { default as connectionRiskAPI } from './connectionRiskAPI';
export {
  // Types
  type FlightInfo,
  type ConnectionInfo,
  type RiskAssessmentInput,
  type RiskLevel,
  type RiskAssessmentResult,
  type RiskAssessmentResponse,
  type RiskyConnectionsResponse,
  type ConnectionStatsResponse,
  
  // API functions
  assessConnectionRisk,
  findRiskyConnections,
  getConnectionStats,
  getRiskLevelColor,
  getRiskLevelLabel,
  
  // React Query hooks
  useConnectionStats,
  useRiskyConnections,
  useAssessConnectionRisk,
} from './connectionRiskAPI';

// Content API (static content)
export { default as contentAPI } from './contentAPI';
export {
  // Types
  type HomeHeroResponse,
  type FeatureCard,
  type FeatureCardsResponse,
  type HowItWorksStep,
  type HowItWorksResponse,
  
  // API functions
  getHomeHeroImage,
  getFeatureCards,
  getHowItWorks,
  
  // React Query hooks
  useHomeHeroImage,
  useFeatureCards,
  useHowItWorks,
} from './contentAPI';

// User API (profile, trips, onboarding, avatar)
export { default as userAPI } from './userAPI';
export {
  // Types
  type TripStats,
  type TripStatsSummary,
  type TripProfileData,
  type TripCard,
  type TripStatistics,
  type TripMilestones,
  type Achievements,
  type OnboardingStatus,
  type AvatarUpdateResponse,
  
  // Trip stats
  getTripStats,
  getTripSummary,
  
  // Profile trips
  getProfileTrips,
  getProfileTripStatistics,
  getNextTrip,
  getRecentTrips,
  getTripMilestones,
  
  // Onboarding
  getOnboardingStatus,
  completeProfileGuide,
  trackMilestone,
  
  // Avatar
  getAvatar,
  updateAvatar,
  deleteAvatar,
  
  // React Query hooks
  useTripStats,
  useTripSummary,
  useProfileTrips,
  useProfileTripStatistics,
  useNextTrip,
  useRecentTrips,
  useTripMilestones,
  useOnboardingStatus,
  useCompleteProfileGuide,
  useTrackMilestone,
  useAvatar,
  useUpdateAvatar,
  useDeleteAvatar,
} from './userAPI';

// Explore API (destinations, airports, photos)
export { default as exploreAPI } from './exploreAPI';
export {
  // Types
  type AlternateAirport,
  type AlternateAirportsResponse,
  type AlternateAirportsParams,
  type ExploreDestination,
  type ExploreBundle,
  type DestinationsBundle,
  
  // Airports
  findAlternateAirports,
  
  // Bundles
  getExploreBundle,
  getStaticExploreBundle,
  getDestinationsBundle,
  checkDestinationsBundleHealth,
  
  // Photo proxy
  getProxiedPhotoUrl,
  getStaticMapUrl,
  
  // React Query hooks
  useAlternateAirports,
  useFindAlternateAirports,
  useExploreBundle,
  useStaticExploreBundle,
  useDestinationsBundle,
} from './exploreAPI';

// Contact API
export { default as contactAPI } from './contactAPI';
export {
  // Types & Schemas
  type SimpleContactInput,
  type ContactFormInput,
  type ContactResponse,
  SimpleContactSchema,
  ContactFormSchema,
  
  // API functions
  submitSimpleContact,
  submitContactForm,
  
  // React Query hooks
  useSubmitSimpleContact,
  useSubmitContactForm,
} from './contactAPI';

// Voyance API (trips, itinerary, preferences)
export { default as voyanceAPI } from './voyanceAPI';

// Planner API
export { default as plannerAPI } from './plannerAPI';
export {
  // Types
  type TripDestination,
  type TripCreateInput,
  type TripUpdateInput,
  type PlannerTrip,
  type CreateTripResponse,
  
  // API functions
  createPlannerTrip,
  updatePlannerTrip,
  getPlannerTrip,
  
  // React Query hooks
  usePlannerTrip,
  useCreatePlannerTrip,
  useUpdatePlannerTrip,
} from './plannerAPI';

// Hotel API
export { default as hotelAPI } from './hotelAPI';
export {
  // Types
  type HotelSearchParams,
  type HotelOption,
  type HotelDestination,
  type HotelSearchResponse,
  type HotelDetailResponse,
  type HotelHoldInput,
  type HotelHoldResponse,
  
  // API functions
  searchHotels,
  preloadHotels,
  batchSearchHotels,
  getHotelDetails,
  createHotelHold,
  
  // React Query hooks
  useHotelSearch,
  useHotelPreload,
  useHotelDetails,
  useSearchHotels,
  useCreateHotelHold,
} from './hotelAPI';

// Trip Sharing API
export { default as tripSharingAPI } from './tripSharingAPI';
export {
  // Types
  type TravelerPermission,
  type TravelerProfile,
  type GroupProfile,
  type TravelersResponse,
  type SavedActivity,
  type GroupFavorite,
  type SharedTrip,
  
  // API functions
  addTravelers,
  getTravelers,
  removeTraveler,
  updateTravelerPermissions,
  saveActivity,
  getSavedActivities,
  getGroupFavorites,
  acceptTripInvitation,
  getSharedTrips,
  
  // React Query hooks
  useTravelers,
  useAddTravelers,
  useRemoveTraveler,
  useUpdateTravelerPermissions,
  useSavedActivities,
  useSaveActivity,
  useGroupFavorites,
  useSharedTrips,
  useAcceptTripInvitation,
} from './tripSharingAPI';

// Multi-City API
export { default as multiCityAPI } from './multiCityAPI';
export {
  // Types
  type PotentialCity,
  type AddCitiesPreferences,
  type MultiCitySegment,
  type MultiCityOption,
  type MultiCityOptionsResponse,
  type CityAllocation,
  type MultiCityPricingStructure,
  type TierInfo,
  type PopularRoute,
  
  // API functions
  generateMultiCityOptions,
  getMultiCityOptions,
  adjustCityNights,
  confirmMultiCity,
  getMultiCityPricing,
  getPopularRoutes,
  
  // React Query hooks
  useMultiCityOptions,
  useGenerateMultiCityOptions,
  useAdjustCityNights,
  useConfirmMultiCity,
  useMultiCityPricing,
  usePopularRoutes,
} from './multiCityAPI';

// Flight Ranking API
export { default as flightRankingAPI } from './flightRankingAPI';
export {
  // Types
  type FlightRankingPreferences,
  type AlternateAirports,
  type FlightLayover,
  type RankedFlight,
  type FlightRankingMetadata,
  type FlightRankingResponse,
  type FlightRankingQueryParams,
  type FlightRankingBodyParams,
  
  // API functions
  getRankedFlights,
  rankFlights,
  
  // React Query hooks
  useRankedFlights,
  useRankFlights,
} from './flightRankingAPI';

// Hotel Ranking API
export { default as hotelRankingAPI } from './hotelRankingAPI';
export {
  // Types
  type HotelUserPreferences,
  type HotelLocation,
  type RankedHotel,
  type HotelRankingPagination,
  type HotelRankingMetadata,
  type HotelRankingResponse,
  type HotelRankingQueryParams,
  type HotelRankingBodyParams,
  
  // API functions
  getRankedHotels,
  rankHotels,
  
  // React Query hooks
  useRankedHotels,
  useInfiniteRankedHotels,
  useRankHotels,
} from './hotelRankingAPI';

// Price Lock API
export { default as priceLockAPI } from './priceLockAPI';
export {
  // Types
  type PriceLockItemType,
  type PriceLockStatus,
  type CreatePriceLockInput,
  type PriceLockData,
  type PriceLockResponse,
  type PriceLockStatusResponse,
  
  // API functions
  createPriceLock,
  getPriceLockStatus,
  cancelPriceLock,
  calculateTimeRemaining,
  
  // React Query hooks
  usePriceLockStatus,
  useCreatePriceLock,
  useCancelPriceLock,
} from './priceLockAPI';

// Trip Intelligence API
export { default as tripIntelligenceAPI } from './tripIntelligenceAPI';
export {
  // Types
  type InsightType,
  type TripEventType,
  type BudgetInsight,
  type PreferenceWeight,
  type Disruption,
  type AirportOption,
  type TripIntelligence,
  type TripIntelligenceResponse,
  type BudgetActionInput,
  type DisruptionActionInput,
  
  // API functions
  getTripIntelligence,
  refreshTripIntelligence,
  getTripBudget,
  performBudgetAction,
  getTripDisruptions,
  handleDisruption,
  
  // React Query hooks
  useTripIntelligence,
  useRefreshTripIntelligence,
  useTripBudget,
  useBudgetAction,
  useTripDisruptions,
  useHandleDisruption,
} from './tripIntelligenceAPI';

// Flight API (with holds and Amadeus config)
export { flightAPI } from './flightAPI';
export {
  // Types
  type FlightSegment,
  type FlightPassengers,
  type FlightPrice,
  type FlightBaggage,
  type FlightPriceLock,
  type FlightSearchParams,
  type FlightOption,
  type FlightSearchResponse,
  type FlightHoldInput,
  type FlightHoldResponse,
  
  // API functions
  searchFlights,
  getFlightDetails,
  createFlightHold,
  releaseFlightHold,
  getAmadeusConfig,
  
  // React Query hooks
  useFlightSearch,
  useFlightDetails,
  useCreateFlightHold,
  useReleaseFlightHold,
  useAmadeusConfig,
} from './flightAPI';

// ============================================================================
// Unified Default Export
// ============================================================================

import voyanceAuth from './voyanceAuth';
import quizAPI from './quizAPI';
import quizSectionsAPI from './quizSectionsAPI';
import voyanceDiagnostics from './voyanceDiagnostics';
import connectionRiskAPI from './connectionRiskAPI';
import contentAPI from './contentAPI';
import userAPI from './userAPI';
import exploreAPI from './exploreAPI';
import contactAPI from './contactAPI';
import voyanceAPI from './voyanceAPI';
import plannerAPI from './plannerAPI';
import hotelAPI from './hotelAPI';
import tripSharingAPI from './tripSharingAPI';
import multiCityAPI from './multiCityAPI';
import flightRankingAPI from './flightRankingAPI';
import hotelRankingAPI from './hotelRankingAPI';
import priceLockAPI from './priceLockAPI';
import tripIntelligenceAPI from './tripIntelligenceAPI';
import { flightAPI } from './flightAPI';

const voyance = {
  auth: voyanceAuth,
  quiz: quizAPI,
  quizSections: quizSectionsAPI,
  diagnostics: voyanceDiagnostics,
  connections: connectionRiskAPI,
  content: contentAPI,
  user: userAPI,
  explore: exploreAPI,
  contact: contactAPI,
  api: voyanceAPI,
  planner: plannerAPI,
  hotels: hotelAPI,
  sharing: tripSharingAPI,
  multiCity: multiCityAPI,
  flightRanking: flightRankingAPI,
  hotelRanking: hotelRankingAPI,
  priceLock: priceLockAPI,
  tripIntelligence: tripIntelligenceAPI,
  flights: flightAPI,
};

export default voyance;
