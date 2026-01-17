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

// Quiz API Service
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
  runSystemTest,
  getSystemTestStatus,
  
  // OAuth debug
  getGoogleOAuthConfig,
} from './voyanceDiagnostics';

// Voyance API (trips, itinerary, preferences)
export { default as voyanceAPI } from './voyanceAPI';

// ============================================================================
// Unified Default Export
// ============================================================================

import voyanceAuth from './voyanceAuth';
import quizAPI from './quizAPI';
import voyanceDiagnostics from './voyanceDiagnostics';
import voyanceAPI from './voyanceAPI';

const voyance = {
  auth: voyanceAuth,
  quiz: quizAPI,
  diagnostics: voyanceDiagnostics,
  api: voyanceAPI,
};

export default voyance;
