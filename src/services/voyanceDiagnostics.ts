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

/**
 * Run full system test
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
  runSystemTest,
  getSystemTestStatus,
  
  // OAuth debug
  getGoogleOAuthConfig,
};

export default voyanceDiagnostics;
