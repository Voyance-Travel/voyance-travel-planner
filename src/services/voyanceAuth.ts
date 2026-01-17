/**
 * Voyance Backend Auth Service
 * 
 * Integrates with Railway backend auth endpoints:
 * - /api/v1/auth/signup - Email registration
 * - /api/v1/auth/register - Alias for signup
 * - /api/v1/auth/login - Email login
 * - /api/v1/auth/me - Get current user
 * - /api/v1/auth/verify - Verify token
 * - /api/v1/auth/refresh - Token refresh
 * - /api/v1/auth/logout - Logout and clear cookies
 * - /api/v1/auth/change-password - Change password (authenticated)
 * - /api/v1/auth/password/request - Request password reset
 * - /api/v1/auth/password/reset - Reset password with token
 * - /api/v1/auth/google - Google OAuth
 * - /api/v1/auth/google/callback - Google OAuth callback
 * - /api/v1/auth/profile-safe - Get user profile (safe endpoint)
 * - /api/v1/auth/auth-health - Health check
 * - /api/v1/auth/diagnostics/* - Diagnostic endpoints
 * - /api/v1/auth/debug/* - Debug endpoints
 */

import { supabase } from '@/integrations/supabase/client';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface BackendUser {
  id: string;
  email: string;
  username?: string;
  provider: 'email' | 'google';
  isAdmin?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BackendProfile {
  id: string;
  userId: string;
  email: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  handle?: string | null;
  preferredCurrency?: string;
  preferredLanguage?: string;
  newsletterOptIn?: boolean;
  dataCollectionOptIn?: boolean;
  budgetPreference?: string;
  pacePreference?: string;
  accommodationPreference?: string;
  transportPreference?: string[];
  quizCompleted?: boolean;
  quizProgress?: number;
  travelDNA?: Record<string, unknown> | null;
  primaryArchetypeName?: string | null;
  secondaryArchetypeName?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: BackendUser;
  profile?: BackendProfile;
  token?: string;
  refreshToken?: string;
  error?: string;
  code?: string;
}

export interface GoogleAuthUrlResponse {
  success: boolean;
  authUrl?: string;
  redirectUri?: string;
  error?: string;
  code?: string;
}

// ============================================================================
// Token Management
// ============================================================================

const TOKEN_KEY = 'voyance_access_token';
const REFRESH_TOKEN_KEY = 'voyance_refresh_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setTokens(accessToken: string, refreshToken?: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, accessToken);
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
  } catch (error) {
    console.error('[VoyanceAuth] Failed to store tokens:', error);
  }
}

export function clearTokens(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('[VoyanceAuth] Failed to clear tokens:', error);
  }
}

// ============================================================================
// API Helpers
// ============================================================================

export async function getAuthHeader(): Promise<Record<string, string>> {
  // Try Supabase JWT first (preferred for Lovable Cloud)
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }
  
  // Fall back to stored backend token
  const token = getStoredToken();
  if (token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }
  
  return {
    'Content-Type': 'application/json',
  };
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
    credentials: 'include', // Include cookies for refresh token
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// Auth API
// ============================================================================

/**
 * Register a new user with email/password
 */
export async function signup(data: {
  email: string;
  password: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  handle?: string;
  acceptedTerms?: boolean;
}): Promise<AuthResponse> {
  try {
    const response = await apiRequest<AuthResponse>('/api/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    if (response.success && response.token) {
      setTokens(response.token, response.refreshToken);
    }
    
    return response;
  } catch (error) {
    console.error('[VoyanceAuth] Signup error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Signup failed',
    };
  }
}

/**
 * Login with email/password
 */
export async function login(email: string, password: string): Promise<AuthResponse> {
  try {
    const response = await apiRequest<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (response.success && response.token) {
      setTokens(response.token, response.refreshToken);
    }
    
    return response;
  } catch (error) {
    console.error('[VoyanceAuth] Login error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Login failed',
    };
  }
}

/**
 * Get Google OAuth URL
 */
export async function getGoogleAuthUrl(): Promise<GoogleAuthUrlResponse> {
  try {
    const response = await apiRequest<GoogleAuthUrlResponse>('/api/v1/auth/google', {
      method: 'GET',
    });
    return response;
  } catch (error) {
    console.error('[VoyanceAuth] Google auth URL error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get Google auth URL',
    };
  }
}

/**
 * Exchange Google OAuth code for tokens
 */
export async function googleCallback(code: string, redirectUri?: string): Promise<AuthResponse> {
  try {
    const response = await apiRequest<AuthResponse>('/api/v1/auth/google/callback', {
      method: 'POST',
      body: JSON.stringify({ 
        code, 
        redirect_uri: redirectUri || `${window.location.origin}/auth/callback/google`,
        mode: 'login',
      }),
    });
    
    if (response.success && response.token) {
      setTokens(response.token, response.refreshToken);
    }
    
    return response;
  } catch (error) {
    console.error('[VoyanceAuth] Google callback error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Google authentication failed',
    };
  }
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(): Promise<AuthResponse> {
  try {
    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) {
      return { success: false, error: 'No refresh token available' };
    }
    
    const response = await fetch(`${BACKEND_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ refreshToken }),
    });
    
    const data = await response.json();
    
    if (data.success && data.token) {
      setTokens(data.token, data.refreshToken);
    }
    
    return data;
  } catch (error) {
    console.error('[VoyanceAuth] Token refresh error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Token refresh failed',
    };
  }
}

/**
 * Get current user profile from backend
 */
export async function getProfile(): Promise<{ success: boolean; user?: BackendUser; profile?: BackendProfile; error?: string }> {
  try {
    const response = await apiRequest<{
      success: boolean;
      authenticated: boolean;
      user?: BackendUser;
      profile?: BackendProfile;
    }>('/api/v1/auth/profile-safe', {
      method: 'GET',
    });
    
    return {
      success: response.success,
      user: response.user,
      profile: response.profile,
    };
  } catch (error) {
    console.error('[VoyanceAuth] Get profile error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get profile',
    };
  }
}

/**
 * Logout - clear tokens
 */
export async function logout(): Promise<void> {
  try {
    // Try to call backend logout endpoint
    await apiRequest('/api/v1/auth/logout', { method: 'POST' }).catch(() => {});
  } finally {
    clearTokens();
  }
}

/**
 * Check if user is authenticated with backend
 */
export async function checkAuth(): Promise<boolean> {
  try {
    const response = await getProfile();
    return response.success && !!response.user;
  } catch {
    return false;
  }
}

/**
 * Get current user (canonical /me endpoint)
 */
export async function getCurrentUser(): Promise<{ success: boolean; user?: BackendUser; error?: string; code?: string }> {
  try {
    const response = await apiRequest<{
      success: boolean;
      user?: BackendUser;
      code?: string;
    }>('/api/v1/auth/me', { method: 'GET' });
    return response;
  } catch (error) {
    console.error('[VoyanceAuth] Get current user error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get user',
    };
  }
}

/**
 * Verify a token
 */
export async function verifyToken(token: string): Promise<{ valid: boolean; userId?: string; error?: string }> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return response.json();
  } catch (error) {
    console.error('[VoyanceAuth] Verify token error:', error);
    return { valid: false, error: error instanceof Error ? error.message : 'Verification failed' };
  }
}

/**
 * Debug auth status (for development)
 */
export async function debugAuthStatus(): Promise<Record<string, unknown>> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/auth/debug/auth-status`, {
      method: 'GET',
      headers: await getAuthHeader(),
      credentials: 'include',
    });
    return response.json();
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Debug failed' };
  }
}

/**
 * Debug current session (for development)
 */
export async function debugCurrentSession(): Promise<Record<string, unknown>> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/auth/debug/current-session`, {
      method: 'GET',
      headers: await getAuthHeader(),
      credentials: 'include',
    });
    return response.json();
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Session debug failed' };
  }
}

// ============================================================================
// Diagnostics
// ============================================================================

export interface DiagnosticsResponse {
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
  timestamp: string;
  error?: string;
}

/**
 * Check Neon database auth diagnostics
 */
export async function checkNeonAuthDiagnostics(): Promise<DiagnosticsResponse> {
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
export async function checkAuthHealth(): Promise<{
  status: string;
  endpoints?: Array<{ path: string; method: string; registered: boolean }>;
  features?: Record<string, unknown>;
  timestamp: string;
  error?: string;
}> {
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
 * Simple auth health check endpoint
 */
export async function authHealthCheck(): Promise<{ success: boolean; status: string; timestamp: string }> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/auth/auth-health`, {
      method: 'GET',
    });
    return response.json();
  } catch (error) {
    return {
      success: false,
      status: 'error',
      timestamp: new Date().toISOString(),
    };
  }
}

// ============================================================================
// Password Reset
// ============================================================================

export interface PasswordResetResponse {
  success?: boolean;
  status?: string;
  message?: string;
  error?: string;
}

/**
 * Request a password reset email
 */
export async function requestPasswordReset(email: string): Promise<PasswordResetResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/auth/password/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    
    return response.json();
  } catch (error) {
    console.error('[VoyanceAuth] Password reset request error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to request password reset',
    };
  }
}

/**
 * Reset password with token
 */
export async function resetPassword(
  userId: string,
  token: string,
  newPassword: string
): Promise<PasswordResetResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/auth/password/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, token, newPassword }),
    });
    
    return response.json();
  } catch (error) {
    console.error('[VoyanceAuth] Password reset error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reset password',
    };
  }
}

/**
 * Change password (when already logged in)
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<PasswordResetResponse> {
  try {
    const response = await apiRequest<PasswordResetResponse>('/api/v1/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    
    return response;
  } catch (error) {
    console.error('[VoyanceAuth] Change password error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to change password',
    };
  }
}

// ============================================================================
// Export
// ============================================================================

const voyanceAuth = {
  // Token management
  getStoredToken,
  getStoredRefreshToken,
  setTokens,
  clearTokens,
  
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
};

export default voyanceAuth;
