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
  
  // API functions
  getHomeHeroImage,
  getFeatureCards,
  
  // React Query hooks
  useHomeHeroImage,
  useFeatureCards,
} from './contentAPI';

// Voyance API (trips, itinerary, preferences)
export { default as voyanceAPI } from './voyanceAPI';

// ============================================================================
// Unified Default Export
// ============================================================================

import voyanceAuth from './voyanceAuth';
import quizAPI from './quizAPI';
import quizSectionsAPI from './quizSectionsAPI';
import voyanceDiagnostics from './voyanceDiagnostics';
import connectionRiskAPI from './connectionRiskAPI';
import contentAPI from './contentAPI';
import voyanceAPI from './voyanceAPI';

const voyance = {
  auth: voyanceAuth,
  quiz: quizAPI,
  quizSections: quizSectionsAPI,
  diagnostics: voyanceDiagnostics,
  connections: connectionRiskAPI,
  content: contentAPI,
  api: voyanceAPI,
};

export default voyance;
