/**
 * Voyance Backend Diagnostics Service
 * 
 * Debug and diagnostic endpoints for the Voyance backend:
 * - /api/v1/auth/debug/auth-status - Auth status debug
 * - /api/v1/auth/debug/current-session - Current session debug
 * - /api/v1/auth/debug/users/:email - User lookup debug
 * - /api/v1/auth/debug/users/batch - Batch user lookup
 * - /api/v1/auth/diagnostics/neon-auth - Neon database diagnostics
 * - /api/v1/auth/diagnostics/auth-health - Auth endpoints health
 * - /api/v1/auth/diagnostics/jwt-test - JWT configuration test
 * - /api/v1/auth/system-test/* - System test endpoints
 */

import { getAuthHeader } from './voyanceAuth';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface AuthDebugInfo {
  timestamp: string;
  tokenPresent: boolean;
  tokenLength: number;
  tokenPrefix: string | null;
  headers: {
    authorization: string | null;
    userAgent: string;
    platform?: string;
    appVersion?: string;
  };
  cookies: Record<string, string>;
  tokenValidation: unknown;
  decodedToken: unknown;
  userLookup: unknown;
}

export interface SessionDebugInfo {
  timestamp: string;
  requestId: string;
  tokenPresent: boolean;
  tokenLength: number;
  tokenPrefix: string | null;
  headers: Record<string, unknown>;
  cookies: Record<string, string>;
  tokenValidation: unknown;
  userLookup: unknown;
}

export interface UserDebugInfo {
  success: boolean;
  data?: {
    email: string;
    exactMatches: Array<Record<string, unknown>>;
    similarMatches: Array<Record<string, unknown>>;
    matchCount: number;
    similarCount: number;
  };
  error?: string;
}

export interface NeonAuthDiagnostics {
  status: string;
  database?: {
    connected: boolean;
    type: string;
  };
  users?: {
    totalCount: number;
    recentSignups: Array<{
      id: string;
      email: string;
      provider: string;
      createdAt: string;
    }>;
  };
  schema?: {
    columns: Array<{
      name: string;
      type: string;
    }>;
  };
  timestamp: string;
  error?: string;
}

export interface AuthHealthInfo {
  status: string;
  endpoints?: Array<{
    path: string;
    method: string;
    registered: boolean;
    rateLimit?: string;
  }>;
  features?: {
    passwordHashing: string;
    tokenType: string;
    tokenExpiry: string;
    providers: string[];
  };
  timestamp: string;
  error?: string;
}

export interface JwtTestInfo {
  jwtSecretConfigured: boolean;
  jwtSecretLength: number;
  jwtSecretPreview: string;
  nodeEnv?: string;
  tokenGenerationWorks?: boolean;
  sampleTokenLength?: number;
  tokenError?: string;
  timestamp: string;
}

// ============================================================================
// Auth Debug Endpoints
// ============================================================================

/**
 * Get current auth status (debug)
 */
export async function getAuthDebugStatus(): Promise<AuthDebugInfo | { error: string }> {
  try {
    const headers = await getAuthHeader();
    const response = await fetch(`${BACKEND_URL}/api/v1/auth/debug/auth-status`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    return response.json();
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Auth debug failed' };
  }
}

/**
 * Get current session info (debug)
 */
export async function getCurrentSessionDebug(): Promise<SessionDebugInfo | { error: string }> {
  try {
    const headers = await getAuthHeader();
    const response = await fetch(`${BACKEND_URL}/api/v1/auth/debug/current-session`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    return response.json();
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Session debug failed' };
  }
}

/**
 * Look up user by email (debug)
 */
export async function debugUserByEmail(email: string): Promise<UserDebugInfo> {
  try {
    const headers = await getAuthHeader();
    const response = await fetch(`${BACKEND_URL}/api/v1/auth/debug/users/${encodeURIComponent(email)}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    return response.json();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'User lookup failed' };
  }
}

/**
 * Batch user lookup (debug)
 */
export async function debugUsersBatch(emails: string[]): Promise<{
  success: boolean;
  data?: {
    results: Array<{ email: string; users: unknown[]; count: number }>;
    totalUsers: number;
    duplicateIds?: string[];
  };
  error?: string;
}> {
  try {
    const headers = await getAuthHeader();
    const response = await fetch(`${BACKEND_URL}/api/v1/auth/debug/users/batch`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ emails }),
    });
    return response.json();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Batch lookup failed' };
  }
}

// ============================================================================
// Diagnostics Endpoints
// ============================================================================

/**
 * Check Neon database auth diagnostics
 */
export async function getNeonAuthDiagnostics(): Promise<NeonAuthDiagnostics> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/auth/diagnostics/neon-auth`, {
      method: 'GET',
    });
    return response.json();
  } catch (error) {
    return {
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Diagnostics failed',
    };
  }
}

/**
 * Check auth endpoints health
 */
export async function getAuthHealthDiagnostics(): Promise<AuthHealthInfo> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/auth/diagnostics/auth-health`, {
      method: 'GET',
    });
    return response.json();
  } catch (error) {
    return {
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Health check failed',
    };
  }
}

/**
 * Test JWT configuration
 */
export async function getJwtTestDiagnostics(): Promise<JwtTestInfo> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/auth/diagnostics/jwt-test`, {
      method: 'GET',
    });
    return response.json();
  } catch (error) {
    return {
      jwtSecretConfigured: false,
      jwtSecretLength: 0,
      jwtSecretPreview: 'ERROR',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Simple auth health check
 */
export async function checkAuthHealthSimple(): Promise<{
  success: boolean;
  status: string;
  service: string;
  timestamp: string;
}> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/auth/auth-health`, {
      method: 'GET',
    });
    return response.json();
  } catch (error) {
    return {
      success: false,
      status: 'error',
      service: 'auth',
      timestamp: new Date().toISOString(),
    };
  }
}

// ============================================================================
// System Test Endpoints
// ============================================================================

export interface SystemTestResult {
  success: boolean;
  userId?: string;
  systemHealth?: 'HEALTHY' | 'ISSUES_DETECTED';
  summary?: {
    hasQuizSession: boolean;
    hasQuizResponses: boolean;
    hasTravelDNA: boolean;
    hasUserProfile: boolean;
    isQuizComplete: boolean;
  };
  details?: {
    sessions: {
      count: number;
      latest: {
        id: string;
        percentage: number;
        isComplete: boolean;
        questionsAnswered: number;
      } | null;
    };
    responses: {
      total: number;
      stepsWithResponses: number;
      badResponses: number;
    };
    travelDNA: Record<string, unknown> | null;
    userProfile: Record<string, unknown> | null;
    preferenceTables: Record<string, boolean>;
  };
  error?: string;
}

export interface QuizFlowTestResult {
  success: boolean;
  recentActivity?: Array<{
    email: string;
    session_id: string;
    percentage: number;
    is_complete: boolean;
    completed_at: string | null;
    response_count: number;
  }>;
  potentialIssues?: Array<{
    issue: string;
    count: number;
  }>;
  timestamp: string;
  error?: string;
}

/**
 * Run full system test for a user
 */
export async function runUserSystemTest(userId: string): Promise<SystemTestResult> {
  try {
    const headers = await getAuthHeader();
    const response = await fetch(`${BACKEND_URL}/api/v1/auth/test/system/${userId}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    return response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'System test failed',
    };
  }
}

/**
 * Test quiz flow endpoints
 */
export async function testQuizFlow(): Promise<QuizFlowTestResult> {
  try {
    const headers = await getAuthHeader();
    const response = await fetch(`${BACKEND_URL}/api/v1/auth/test/quiz-flow`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    return response.json();
  } catch (error) {
    return {
      success: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Quiz flow test failed',
    };
  }
}

/**
 * Run full system test (legacy)
 */
export async function runSystemTest(): Promise<{
  success: boolean;
  tests?: Record<string, unknown>;
  summary?: {
    total: number;
    passed: number;
    failed: number;
  };
  error?: string;
}> {
  try {
    const headers = await getAuthHeader();
    const response = await fetch(`${BACKEND_URL}/api/v1/auth/system-test/run`, {
      method: 'POST',
      headers,
      credentials: 'include',
    });
    return response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'System test failed',
    };
  }
}

/**
 * Get system test status
 */
export async function getSystemTestStatus(): Promise<{
  success: boolean;
  status?: string;
  lastRun?: string;
  results?: Record<string, unknown>;
  error?: string;
}> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/auth/system-test/status`, {
      method: 'GET',
    });
    return response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Status check failed',
    };
  }
}

// ============================================================================
// Google OAuth Config Debug
// ============================================================================

/**
 * Get Google OAuth configuration (debug)
 */
export async function getGoogleOAuthConfig(): Promise<{
  configured: boolean;
  hasClientId: boolean;
  hasClientSecret: boolean;
  clientIdLength: number;
  clientSecretLength: number;
  clientIdPreview: string;
  redirectUri: string;
  frontendUrl?: string;
  dbConnected: boolean;
  userTableExists: boolean;
  envVars?: Record<string, unknown>;
}> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/auth/google/config`, {
      method: 'GET',
    });
    return response.json();
  } catch (error) {
    return {
      configured: false,
      hasClientId: false,
      hasClientSecret: false,
      clientIdLength: 0,
      clientSecretLength: 0,
      clientIdPreview: 'ERROR',
      redirectUri: 'ERROR',
      dbConnected: false,
      userTableExists: false,
    };
  }
}

// ============================================================================
// Frontend-Backend Audit Endpoints
// ============================================================================

export interface SchemaComparisonAudit {
  timestamp: string;
  '1_BACKEND_ACTUAL_RESPONSE': {
    description: string;
    structure: {
      user: { hasData: boolean; fields: string[]; sampleData: unknown };
      profile: { isNull: boolean; value: unknown };
      quizStatus: { hasData: boolean; fields: string[]; sampleData: unknown };
      travelDna: { hasData: boolean; fields: string[]; sampleData: unknown };
    };
  };
  '2_FRONTEND_SHOULD_USE': Record<string, unknown>;
  '3_FRONTEND_CURRENT_BEHAVIOR': Record<string, unknown>;
  '4_EXACT_CODE_CHANGES': Record<string, unknown>;
  '5_VALIDATION_CHECKLIST': Record<string, boolean>;
  '6_COMMON_FRONTEND_MISTAKES': string[];
  '7_DEBUG_STEPS': string[];
}

export interface FrontendTestData {
  instruction: string;
  testData: {
    user: { displayName: string; name: string };
    profile: null;
    quizStatus: { hasCompleted: boolean; wrongField: boolean };
    travelDna: { primaryArchetype: string; wrongField: string };
  };
  correctCode: string;
  whatYouShouldSee: Record<string, string>;
}

/**
 * Get schema comparison audit for frontend debugging
 */
export async function getSchemaComparisonAudit(): Promise<SchemaComparisonAudit | { error: string }> {
  try {
    const headers = await getAuthHeader();
    const response = await fetch(`${BACKEND_URL}/api/v1/debug/audit/schema-comparison`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    return response.json();
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Audit failed' };
  }
}

/**
 * Get frontend test data for field verification
 */
export async function getFrontendTestData(): Promise<FrontendTestData | { error: string }> {
  try {
    const headers = await getAuthHeader();
    const response = await fetch(`${BACKEND_URL}/api/v1/debug/audit/frontend-test`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    return response.json();
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Test data fetch failed' };
  }
}

// ============================================================================
// Dev Tools Endpoints
// ============================================================================

export interface RateLimitStatus {
  userId: string;
  rateLimitActive: boolean;
  limits: Record<string, {
    value: string | null;
    ttl: number;
    expiresIn: string;
  }>;
}

export interface ClearRateLimitResponse {
  success: boolean;
  message: string;
  clearedKeys: number;
}

/**
 * Clear rate limit for current user (dev only)
 */
export async function clearRateLimit(): Promise<ClearRateLimitResponse | { error: string }> {
  try {
    const headers = await getAuthHeader();
    const response = await fetch(`${BACKEND_URL}/api/v1/dev/clear-rate-limit`, {
      method: 'POST',
      headers,
      credentials: 'include',
    });
    return response.json();
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Clear rate limit failed' };
  }
}

/**
 * Get rate limit status for current user (dev only)
 */
export async function getRateLimitStatus(): Promise<RateLimitStatus | { error: string }> {
  try {
    const headers = await getAuthHeader();
    const response = await fetch(`${BACKEND_URL}/api/v1/dev/rate-limit-status`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    return response.json();
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Rate limit status failed' };
  }
}

// ============================================================================
// Export
// ============================================================================

const voyanceDiagnostics = {
  // Auth debug
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
  
  // Frontend-backend audit
  getSchemaComparisonAudit,
  getFrontendTestData,
  
  // Dev tools
  clearRateLimit,
  getRateLimitStatus,
};

export default voyanceDiagnostics;
