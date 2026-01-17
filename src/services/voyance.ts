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
  getProfile as getAuthProfile,
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

// User API (profile, trips, onboarding, avatar, identity, preferences, GDPR)
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
  type UserIdentity,
  type UserIdentityResponse,
  type UserPreferences,
  type PreferencesResponse,
  type GDPRExportResponse,
  type GDPRDeleteResponse,
  
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
  
  // Identity
  getUserIdentity,
  
  // Preferences
  getUserPreferences,
  updateUserPreferences,
  
  // GDPR
  exportUserData,
  deleteUserAccount,
  
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
  useUserIdentity,
  useUserPreferences,
  useUpdateUserPreferences,
  useExportUserData,
  useDeleteUserAccount,
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

// Hotel Booking API
export { default as hotelBookingAPI } from './hotelBookingAPI';
export {
  // Types
  type GuestDetails,
  type CreateBookingInput,
  type ConfirmBookingInput,
  type CancelBookingInput,
  type CheckAvailabilityInput,
  type ProcessPaymentInput,
  type RefundPaymentInput,
  type BookingStatus,
  type HotelBooking,
  type BookingResponse,
  type AvailabilityResponse,
  type PaymentIntentResponse,
  
  // API functions
  createHotelBooking,
  confirmHotelBooking,
  cancelHotelBooking,
  getHotelBooking,
  getUserHotelBookings,
  checkHotelAvailability,
  createBookingPaymentIntent,
  processBookingPayment,
  refundBookingPayment,
  
  // React Query hooks
  useHotelBooking,
  useUserHotelBookings,
  useCreateHotelBooking,
  useConfirmHotelBooking,
  useCancelHotelBooking,
  useCheckHotelAvailability,
  useCreateBookingPaymentIntent,
  useProcessBookingPayment,
  useRefundBookingPayment,
} from './hotelBookingAPI';

// System Health API
export { default as systemHealthAPI } from './systemHealthAPI';
export {
  // Types
  type BasicHealthResponse,
  type DatabaseHealth,
  type AuthenticationHealth,
  type EnvironmentHealth,
  type SystemHealthResponse,
  type UserFlowHealthResponse,
  type RouteInfo,
  type RoutesResponse,
  
  // API functions
  getBasicHealth,
  getSystemHealth,
  getUserFlowHealth,
  getRegisteredRoutes,
  isBackendReachable,
  getBackendStatus,
  
  // React Query hooks
  useBasicHealth,
  useSystemHealth,
  useBackendStatus,
  useRegisteredRoutes,
} from './systemHealthAPI';

// Stripe API (test endpoints)
export { default as stripeAPI } from './stripeAPI';
export {
  // Types
  type StripeCustomerInfo,
  type StripeTestCustomerResponse,
  type StripeProduct,
  type StripePrice,
  type StripeTestProductsResponse,
  
  // API functions
  testStripeCustomer,
  getStripeProducts,
  
  // React Query hooks
  useStripeCustomer,
  useStripeProducts,
  useTestStripeCustomer,
} from './stripeAPI';

// Quiz API - Additional exports for debug/restore
export {
  // Additional types
  type QuizRestoreResponse,
  type QuizResponsesResponse,
  type QuizDebugInfo,
  type QuizForceUpdateResponse,
  type QuizTestStep11Response,
  type QuizFinalizeSimpleResponse,
  
  // Additional API functions
  restoreQuizSession,
  getQuizResponses,
  getQuizDebugInfo,
  forceCompleteQuiz,
  testQuizStep11,
  finalizeQuizSimple as finalizeQuizSimpleOld,
  
  // Additional hooks
  useRestoreQuizSession,
  useQuizResponses,
  useQuizDebugInfo,
  useFinalizeQuizSimple as useFinalizeQuizSimpleOld,
} from './quizAPI';

// Activity Alternatives API
export { default as activityAlternativesAPI } from './activityAlternativesAPI';
export {
  // Types
  type TimeSlot,
  type WeatherDependency,
  type ActivityLocation,
  type PreferenceProfile,
  type AlternativeActivity,
  type GetAlternativesInput,
  type AlternativesResponse,
  type SwapActivityInput,
  type SwapActivityResponse,
  type LockActivityInput,
  type LockActivityResponse,
  
  // API functions
  getActivityAlternatives,
  swapActivity,
  lockActivity,
  unlockActivity,
  
  // React Query hooks
  useActivityAlternatives,
  useSwapActivity,
  useLockActivity,
  useUnlockActivity,
} from './activityAlternativesAPI';

// Preview API (teaser itineraries)
export { default as previewAPI } from './previewAPI';
export {
  // Types
  type PreviewActivity,
  type PreviewHotel,
  type PreviewPricing,
  type PreviewData,
  type PreviewUpgrade,
  type GeneratePreviewInput,
  type PreviewResponse,
  type PreviewRemainingResponse,
  
  // API functions
  generatePreview,
  getPreviewRemaining,
  
  // React Query hooks
  usePreviewRemaining,
  useGeneratePreview,
} from './previewAPI';

// Trips Debug API
export { default as tripsDebugAPI } from './tripsDebugAPI';
export {
  // Types
  type StatusCount,
  type TripSample,
  type TripStatusRawResponse,
  type TripStatusAnalysisResponse,
  type DebugTrip,
  type DebugTripsResponseResult,
  type TableColumn,
  type TripsTableCheckResponse,
  
  // API functions
  getTripStatusRaw,
  getTripStatusAnalysis,
  getDebugTripsResponse,
  getTripsTableCheck,
  
  // React Query hooks
  useTripStatusRaw,
  useTripStatusAnalysis,
  useDebugTripsResponse,
  useTripsTableCheck,
} from './tripsDebugAPI';

// Airport Link API
export { default as airportLinkAPI } from './airportLinkAPI';
export {
  // Types
  type AirportLinkResponse,
  
  // API functions
  getAirportLink,
  
  // React Query hooks
  useAirportLink,
} from './airportLinkAPI';

// Admin API
export { default as adminAPI } from './adminAPI';
export {
  // Types
  type StripeTransaction,
  type AIMatch,
  type AuditLogEntry,
  type AdminStatusResponse,
  
  // API functions
  getAdminStatus,
  
  // React Query hooks
  useAdminStatus,
} from './adminAPI';

// BDQ (Background Discovery Queue) API
export { default as bdqAPI } from './bdqAPI';
export {
  // Types
  type JobStatus,
  type JobType,
  type BDQJob,
  type ListJobsParams,
  type ListJobsResponse,
  type CreateJobInput,
  type CreateJobResponse,
  type JobDetailsResponse,
  type CancelJobResponse,
  type QueueStats,
  type QueueStatsResponse,
  
  // API functions
  listBDQJobs,
  createBDQJob,
  getBDQJob,
  cancelBDQJob,
  getBDQStats,
  
  // React Query hooks
  useBDQJobs,
  useBDQJob,
  useBDQStats,
  useCreateBDQJob,
  useCancelBDQJob,
} from './bdqAPI';

// DreamBuilder API
export { default as dreamBuilderAPI } from './dreamBuilderAPI';
export {
  // Types
  type DreamBuilderInput,
  type DreamMatchDestination,
  type DreamMatchResult,
  type DreamBuilderSubmitResponse,
  type DreamMatchResponse,
  type DreamBuilderHealthResponse,
  
  // API functions
  getDreamBuilderHealth,
  submitDreamBuilder,
  getDreamMatch,
  
  // React Query hooks
  useDreamBuilderHealth,
  useDreamMatch,
  useSubmitDreamBuilder,
} from './dreamBuilderAPI';

// Disruption API
export { default as disruptionAPI } from './disruptionAPI';
export {
  // Types
  type DisruptionSeverity,
  type DisruptionChannel,
  type DisruptionType,
  type DisruptionPrediction,
  type PredictDisruptionInput,
  type PredictDisruptionResponse,
  type SubscribeInput,
  type SubscribeResponse,
  type UnsubscribeResponse,
  type DisruptionHistoryItem,
  type DisruptionHistoryResponse,
  
  // API functions
  predictDisruptions,
  subscribeToDisruptions,
  unsubscribeFromDisruptions,
  getDisruptionHistory,
  getSeverityColor,
  getSeverityLabel,
  
  // React Query hooks
  useDisruptionPredictions,
  useDisruptionHistory,
  usePredictDisruptions,
  useSubscribeToDisruptions,
  useUnsubscribeFromDisruptions,
} from './disruptionAPI';

// Destination Scoring API
export { default as destinationScoringAPI } from './destinationScoringAPI';
export {
  // Types
  type PricingTier,
  type ActivityLevel,
  type DestinationToScore,
  type ScoredDestination,
  type ScoreDestinationsInput,
  type ScoreDestinationsResponse,
  
  // API functions
  scoreDestinations,
  sortByScore,
  getTopDestinations,
  filterByMinScore,
  
  // React Query hooks
  useScoreDestinations,
} from './destinationScoringAPI';

// Dashboard API
export { default as dashboardAPI } from './dashboardAPI';
export {
  // Types
  type SavedTrip,
  type ActiveSession,
  type DashboardResponse,
  type BudgetZone,
  type BudgetZoneThreshold,
  type BudgetZoneResponse,
  
  // API functions
  getDashboard,
  getBudgetZone,
  getBudgetZoneColor,
  getBudgetZoneLabel,
  
  // React Query hooks
  useDashboard,
  useBudgetZone,
} from './dashboardAPI';

// Emotional Tags API
export { default as emotionalTagsAPI } from './emotionalTagsAPI';
export {
  type EmotionalTag,
  type AddTagInput,
  type RemoveTagInput,
  type TagsResponse,
  type AddTagResponse,
  getEmotionalTags,
  addEmotionalTag,
  removeEmotionalTag,
  parseTagString,
  formatTagString,
  useEmotionalTags,
  useAddEmotionalTag,
  useRemoveEmotionalTag,
} from './emotionalTagsAPI';

// Must-Haves API
export { default as mustHavesAPI } from './mustHavesAPI';
export {
  type MustHave,
  type CreateMustHaveInput,
  type UpdateMustHaveInput,
  type DeleteMustHaveInput,
  type MustHavesResponse,
  type MustHaveResponse,
  getMustHaves,
  createMustHave,
  updateMustHave,
  deleteMustHave,
  useMustHaves,
  useCreateMustHave,
  useUpdateMustHave,
  useDeleteMustHave,
} from './mustHavesAPI';

// Meal Plans API
export { default as mealPlansAPI } from './mealPlansAPI';
export {
  type MealPlanPrice,
  type MealPlan,
  type CreateMealPlanInput,
  type UpdateMealPlanInput,
  type DeleteMealPlanInput,
  type SyncMealPlansInput,
  type MealPricing,
  type SyncMealPricingInput,
  getMealPlans,
  createMealPlan,
  updateMealPlan,
  deleteMealPlan,
  syncMealPlans,
  syncMealPricing,
  useMealPlans,
  useCreateMealPlan,
  useUpdateMealPlan,
  useDeleteMealPlan,
  useSyncMealPlans,
  useSyncMealPricing,
} from './mealPlansAPI';

// Maps API
export { default as mapsAPI } from './mapsAPI';
export {
  type MapsDetailsInput,
  type MapsReview,
  type MapsDetailsResponse,
  getMapsDetails,
  useGetMapsDetails,
} from './mapsAPI';

// Manual Bookings API
export { default as manualBookingsAPI } from './manualBookingsAPI';
export {
  type ManualBooking,
  type CreateManualBookingInput,
  type UpdateManualBookingInput,
  type DeleteManualBookingInput,
  getManualBookings,
  createManualBooking,
  updateManualBooking,
  deleteManualBooking,
  useManualBookings,
  useCreateManualBooking,
  useUpdateManualBooking,
  useDeleteManualBooking,
} from './manualBookingsAPI';

// Itinerary Preview API
export { default as itineraryPreviewAPI } from './itineraryPreviewAPI';
export {
  type BudgetTier as ItineraryBudgetTier,
  type ActivityBlock,
  type DayBlock,
  type ItineraryPreviewInput,
  type ItineraryPreviewResponse,
  generateItineraryPreview,
  calculateTotalCost,
  getBudgetTierLabel,
  getBudgetTierColor,
  useGenerateItineraryPreview,
} from './itineraryPreviewAPI';

// Preferences V1 API
export { default as preferencesV1API } from './preferencesV1API';
export {
  type BudgetTier as PreferencesBudgetTier,
  type TravelPace,
  type PlanningPreference,
  type AccommodationStyle,
  type SeatPreference,
  type MobilityLevel,
  type PreferenceSource,
  type PreferencesSource,
  type FullPreferences,
  type PreferencesUpdate,
  type PreferencesSection,
  type TripOption,
  type TripContext,
  type ApplyPreferencesInput,
  type ScoredTripOption,
  type ApplyPreferencesResponse,
  getFullPreferences,
  getPreferencesSection,
  updatePreferences,
  applyPreferences,
  useFullPreferences,
  usePreferencesSection,
  useUpdatePreferences,
  useApplyPreferences,
} from './preferencesV1API';

// Profile API
export { default as profileAPI } from './profileAPI';
export {
  type TravelDNAArchetype,
  type TravelDNAPreferences,
  type TravelDNA as ProfileTravelDNA,
  type UserPreferences as ProfileUserPreferences,
  type UserProfile,
  type ProfileResponse,
  type ProfileLite,
  type ProfileLiteResponse,
  type TravelDNADetails,
  type TravelDNADetailsResponse,
  type ProfileUpdateInput,
  type ProfileUpdateResponse,
  type ProfileFieldUpdateInput,
  type ProfileDataResponse,
  type SessionVerifyResponse,
  getProfile,
  getStableProfile,
  getProfileLite,
  getTravelDNADetails,
  getProfileData,
  updateProfile,
  updateProfileField,
  verifySession,
  useProfile,
  useStableProfile,
  useProfileLite,
  useTravelDNADetails,
  useProfileData,
  useVerifySession,
  useUpdateProfile,
  useUpdateProfileField,
} from './profileAPI';

// Timeline Blocks API
export { default as timelineBlocksAPI } from './timelineBlocksAPI';
export {
  type ActivityBlock as TimelineActivityBlock,
  type TransportMode,
  type TimelineBlock,
  type CreateTimelineBlockInput,
  type UpdateTimelineBlockInput,
  getTimelineBlocks,
  addTimelineBlock,
  updateTimelineBlock,
  deleteTimelineBlock,
  useTimelineBlocks,
  useAddTimelineBlock,
  useUpdateTimelineBlock,
  useDeleteTimelineBlock,
} from './timelineBlocksAPI';

// Transport API
export { default as transportAPI } from './transportAPI';
export {
  type TransportModeType,
  type TransportOptionsResponse,
  getTransportOptions,
  getTransportModeLabel,
  getTransportModeIcon,
  useTransportOptions,
} from './transportAPI';

// Quiz Extended API
export { default as quizExtendedAPI } from './quizExtendedAPI';
export {
  type TravelDNAAnswers,
  type QuizCompleteFrontendResponse,
  type QuizFinalizeRequest,
  type QuizFinalizeResponse as QuizExtendedFinalizeResponse,
  type QuizDiagnosticStatus,
  type SimpleQuizFinalizeResponse,
  completeQuizFrontend,
  finalizeQuizProfile,
  finalizeQuizSimple,
  getQuizDiagnosticStatus,
  echoQuizData,
  useQuizDiagnosticStatus,
  useCompleteQuizFrontend,
  useFinalizeQuizProfile,
  useFinalizeQuizSimple,
} from './quizExtendedAPI';

// User Dashboard API
export { default as userDashboardAPI } from './userDashboardAPI';
export {
  type DashboardCounts,
  type DashboardTrip,
  type DashboardData,
  type DashboardResponse as UserDashboardResponse,
  type MinimalDashboardUser,
  type MinimalDashboardResponse,
  type DashboardTestResponse,
  getDashboard as getUserDashboard,
  getMinimalDashboard,
  testDashboard,
  useDashboard as useUserDashboard,
  useMinimalDashboard,
} from './userDashboardAPI';

// Price Drift API
export { default as priceDriftAPI } from './priceDriftAPI';
export {
  type PriceItemType,
  type TrackPriceInput,
  type TrackPriceResponse,
  type PriceHistoryEntry,
  type DriftAnalysis,
  type PriceStatusResponse,
  type StopTrackingResponse,
  trackPrice,
  getPriceStatus,
  stopTracking,
  getDriftDirectionLabel,
  getDriftDirectionColor,
  formatPriceChange,
  usePriceStatus,
  useTrackPrice,
  useStopTracking,
} from './priceDriftAPI';

// Guides API
export { default as guidesAPI } from './guidesAPI';
export {
  type Guide,
  type FullGuide,
  type GuidesFilters,
  type GuidesPagination,
  type GuidesResponse,
  type FeaturedGuide,
  type RelatedGuide,
  getGuides,
  getGuide,
  getFeaturedGuides,
  getRelatedGuides,
  useGuides,
  useGuide,
  useFeaturedGuides,
  useRelatedGuides,
} from './guidesAPI';

// Budget Aggregation API
export { default as budgetAPI } from './budgetAPI';
export {
  type CostCategory,
  type CostSource,
  type CostItem,
  type AggregateBudgetInput,
  type CategoryBreakdown,
  type AggregateBudgetResponse,
  type BudgetOverrideInput,
  type BudgetOverrideResponse,
  type TripBudgetData,
  aggregateBudget,
  overrideBudget,
  getTripBudget as getBudgetData,
  formatBudgetAmount,
  getCategoryLabel,
  getCategoryIcon,
  getCategoryPercentage,
  useTripBudget as useBudgetData,
  useAggregateBudget,
  useOverrideBudget,
} from './budgetAPI';

// Trip Activities API
export { default as tripActivitiesAPI } from './tripActivitiesAPI';
export {
  type ActivityLocation as TripActivityLocation,
  type Activity,
  type UpdateActivityInput,
  type MoveActivityInput,
  type ActivityUpdateResponse,
  type AlternativeActivity as TripAlternativeActivity,
  type AlternativesResponse as TripAlternativesResponse,
  updateActivity,
  deleteActivity,
  moveActivity,
  lockActivity as lockTripActivity,
  unlockActivity as unlockTripActivity,
  getActivityAlternatives as getTripActivityAlternatives,
  formatActivityTime,
  getActivityTypeIcon,
  useActivityAlternatives as useTripActivityAlternatives,
  useUpdateActivity,
  useDeleteActivity,
  useMoveActivity,
  useLockActivity as useLockTripActivity,
  useUnlockActivity as useUnlockTripActivity,
} from './tripActivitiesAPI';

// Weather API
export { default as weatherAPI } from './weatherAPI';
export {
  type WeatherForecast,
  type WeatherData,
  type WeatherResponse,
  getWeather,
  getWeatherIcon,
  formatTemperature,
  getSeasonColor,
  parseTemperatureRange,
  useWeather,
} from './weatherAPI';

// Checkout API
export { default as checkoutAPI } from './checkoutAPI';
export {
  type CreateCheckoutInput,
  type CheckoutSessionResponse,
  type CheckoutStatusResponse,
  createCheckoutSession as createTripCheckout,
  getCheckoutStatus,
  checkoutAndRedirect,
  generateIdempotencyKey,
  calculateNights,
  formatCheckoutAmount,
  isSessionValid,
  getSessionTimeRemaining,
  useCheckoutStatus,
  useCreateCheckoutSession,
  useCheckoutAndRedirect,
} from './checkoutAPI';

// Trip Save/Resume API (aliased to avoid conflicts)
export {
  saveTripProgress,
  resumeTrip,
  getTripSaveStatus,
  getSessionStatus,
  listSavedTrips as listSavedTripProgress,
  deleteSavedTrip as deleteSavedTripProgress,
  cleanupSavedTrips,
  useSaveTripProgress,
  useResumeTrip,
  useTripSaveStatus,
  useSessionStatus,
  useSavedTrips as useSavedTripProgress,
  useDeleteSavedTrip as useDeleteSavedTripProgress,
  useCleanupSavedTrips,
} from './tripSaveResumeAPI';

// Saved Trips API
export {
  saveTrip,
  unsaveTrip,
  getSavedTrips as getUserSavedTrips,
  isTripSaved,
  bulkCheckSavedStatus,
  updateSavedTrip,
  useSaveTrip,
  useUnsaveTrip,
  useUserSavedTrips,
  useTripSavedStatus,
  useBulkSavedStatus,
  useUpdateSavedTrip,
  useToggleTripSave,
} from './savedTripsAPI';

// Trip Context API
export * from './tripContextAPI';

// User Billing API
export * from './userBillingAPI';

// Activities API
export * from './activitiesAPI';

// Venues API
export * from './venuesAPI';

// Featured Destinations API
export * from './featuredDestinationsAPI';

// Price Drift Extended API (aliased to avoid conflicts with priceDriftAPI)
export {
  trackPrice as trackPriceExtended,
  getPriceStatus as getPriceStatusExtended,
  stopPriceTracking,
  subscribeToPriceAlerts,
  useTrackPrice as useTrackPriceExtended,
  usePriceStatus as usePriceStatusExtended,
  useStopPriceTracking,
} from './priceDriftExtendedAPI';

// Audit Logs API
export * from './auditLogsAPI';

// Feature Flags API
export * from './featureFlagsAPI';

// Tags API
export * from './tagsAPI';

// Trip Budget & Companions API
export * from './tripBudgetCompanionsAPI';

// Booking API
export * from './bookingAPI';

// Connections Assessment API
export * from './connectionsAssessmentAPI';

// Destinations Extended API
export * from './destinationsExtendedAPI';

// Planner Flights API
export * from './plannerFlightsAPI';

// Price Monitor API
export * from './priceMonitorAPI';

// Save Trip API
export * from './saveTripAPI';

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
import hotelBookingAPI from './hotelBookingAPI';
import systemHealthAPI from './systemHealthAPI';
import stripeAPI from './stripeAPI';
import activityAlternativesAPI from './activityAlternativesAPI';
import previewAPI from './previewAPI';
import tripsDebugAPI from './tripsDebugAPI';
import airportLinkAPI from './airportLinkAPI';
import adminAPI from './adminAPI';
import bdqAPI from './bdqAPI';
import dreamBuilderAPI from './dreamBuilderAPI';
import disruptionAPI from './disruptionAPI';
import destinationScoringAPI from './destinationScoringAPI';
import dashboardAPI from './dashboardAPI';
import emotionalTagsAPI from './emotionalTagsAPI';
import mustHavesAPI from './mustHavesAPI';
import mealPlansAPI from './mealPlansAPI';
import mapsAPI from './mapsAPI';
import manualBookingsAPI from './manualBookingsAPI';
import itineraryPreviewAPI from './itineraryPreviewAPI';
import preferencesV1API from './preferencesV1API';
import profileAPI from './profileAPI';
import timelineBlocksAPI from './timelineBlocksAPI';
import transportAPI from './transportAPI';
import quizExtendedAPI from './quizExtendedAPI';
import userDashboardAPI from './userDashboardAPI';
import priceDriftAPI from './priceDriftAPI';
import guidesAPI from './guidesAPI';
import budgetAPI from './budgetAPI';
import tripActivitiesAPI from './tripActivitiesAPI';
import weatherAPI from './weatherAPI';
import checkoutAPI from './checkoutAPI';
import * as tripSaveResumeAPI from './tripSaveResumeAPI';
import * as savedTripsAPIModule from './savedTripsAPI';
import * as tripContextAPI from './tripContextAPI';
import * as userBillingAPI from './userBillingAPI';
import * as activitiesAPI from './activitiesAPI';
import * as venuesAPI from './venuesAPI';
import * as featuredDestinationsAPI from './featuredDestinationsAPI';
import * as priceDriftExtendedAPI from './priceDriftExtendedAPI';
import * as auditLogsAPI from './auditLogsAPI';
import * as featureFlagsAPI from './featureFlagsAPI';
import * as tagsAPI from './tagsAPI';
import * as tripBudgetCompanionsAPI from './tripBudgetCompanionsAPI';
import * as bookingAPI from './bookingAPI';
import * as connectionsAssessmentAPI from './connectionsAssessmentAPI';
import * as destinationsExtendedAPI from './destinationsExtendedAPI';
import * as plannerFlightsAPI from './plannerFlightsAPI';
import * as priceMonitorAPI from './priceMonitorAPI';
import * as saveTripAPI from './saveTripAPI';

const voyance = {
  auth: voyanceAuth,
  quiz: quizAPI,
  quizSections: quizSectionsAPI,
  quizExtended: quizExtendedAPI,
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
  hotelBookings: hotelBookingAPI,
  systemHealth: systemHealthAPI,
  stripe: stripeAPI,
  activityAlternatives: activityAlternativesAPI,
  preview: previewAPI,
  tripsDebug: tripsDebugAPI,
  airportLink: airportLinkAPI,
  admin: adminAPI,
  bdq: bdqAPI,
  dreamBuilder: dreamBuilderAPI,
  disruption: disruptionAPI,
  destinationScoring: destinationScoringAPI,
  dashboard: dashboardAPI,
  emotionalTags: emotionalTagsAPI,
  mustHaves: mustHavesAPI,
  mealPlans: mealPlansAPI,
  maps: mapsAPI,
  manualBookings: manualBookingsAPI,
  itineraryPreview: itineraryPreviewAPI,
  preferencesV1: preferencesV1API,
  profile: profileAPI,
  timelineBlocks: timelineBlocksAPI,
  transport: transportAPI,
  userDashboard: userDashboardAPI,
  priceDrift: priceDriftAPI,
  guides: guidesAPI,
  budget: budgetAPI,
  tripActivities: tripActivitiesAPI,
  weather: weatherAPI,
  checkout: checkoutAPI,
  tripSaveResume: tripSaveResumeAPI,
  savedTrips: savedTripsAPIModule,
  tripContext: tripContextAPI,
  billing: userBillingAPI,
  activities: activitiesAPI,
  venues: venuesAPI,
  featuredDestinations: featuredDestinationsAPI,
  priceDriftExtended: priceDriftExtendedAPI,
  auditLogs: auditLogsAPI,
  featureFlags: featureFlagsAPI,
  tags: tagsAPI,
  tripBudgetCompanions: tripBudgetCompanionsAPI,
  booking: bookingAPI,
  connectionsAssessment: connectionsAssessmentAPI,
  destinationsExtended: destinationsExtendedAPI,
  plannerFlights: plannerFlightsAPI,
  priceMonitor: priceMonitorAPI,
  saveTrip: saveTripAPI,
};

// New API Services (from latest backend routes) - imported with aliases to avoid conflicts
export * from './destinationImagesAPI';
export * from './bundlesAPI';
export * from './usersSearchAPI';
export { 
  getDestinations as getDestinationsUnified,
  getTrendingDestinations as getTrendingDestinationsUnified,
  getSurpriseDestination as getSurpriseDestinationUnified,
  getDestinationsByTag as getDestinationsByTagUnified,
  useDestinations as useDestinationsUnified,
  useTrendingDestinations as useTrendingDestinationsUnified,
  useSurpriseDestination as useSurpriseDestinationUnified,
  useDestinationsByTag as useDestinationsByTagUnified,
  getGuides as getGuidesUnified,
  getGuideBySlug as getGuideBySlugUnified,
  useGuides as useGuidesUnified,
  useGuide as useGuideUnified,
  type Destination as UnifiedDestination,
  type Guide as UnifiedGuide,
  type GuideDetail as UnifiedGuideDetail,
} from './destinationsUnifiedAPI';
export {
  createCheckoutSession as createCheckoutSessionV1,
  getBookingStatus as getBookingStatusV1,
  confirmBooking as confirmBookingV1,
  cancelBooking as cancelBookingV1,
  generateIdempotencyKey as generateIdempotencyKeyV1,
  useCreateCheckoutSession as useCreateCheckoutSessionV1,
  useBookingStatus as useBookingStatusV1,
  useConfirmBooking as useConfirmBookingV1,
  useCancelBooking as useCancelBookingV1,
  type CheckoutSessionParams as CheckoutSessionParamsV1,
  type CheckoutSessionResponse as CheckoutSessionResponseV1,
  type BookingStatusResponse as BookingStatusResponseV1,
  type ConfirmBookingParams as ConfirmBookingParamsV1,
  type ConfirmBookingResponse as ConfirmBookingResponseV1,
} from './bookingsV1API';

export default voyance;
