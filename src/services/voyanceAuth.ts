/**
 * Voyance Auth Service
 * 
 * All authentication now goes through Supabase Auth.
 * This service provides a unified interface for auth operations.
 */

import { supabase } from '@/integrations/supabase/client';

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

// ============================================================================
// Token Management (Supabase handles this internally)
// ============================================================================

export function getStoredToken(): string | null {
  // Supabase handles token storage automatically
  return null;
}

export function setStoredToken(_token: string): void {
  // Supabase handles token storage automatically
}

export function setRefreshToken(_token: string): void {
  // Supabase handles token storage automatically
}

export function clearTokens(): void {
  // Supabase handles token clearing on sign out
}

// ============================================================================
// Auth Header
// ============================================================================

export async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }
  return { 'Content-Type': 'application/json' };
}

// ============================================================================
// Auth Operations
// ============================================================================

export async function signUp(email: string, password: string, name?: string | { firstName: string; lastName: string }): Promise<AuthResponse> {
  try {
    // Support both legacy string name and new object format
    const firstName = typeof name === 'object' ? name.firstName : name || email.split('@')[0];
    const lastName = typeof name === 'object' ? name.lastName : '';
    const fullName = typeof name === 'object' ? `${name.firstName} ${name.lastName}` : name || email.split('@')[0];
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          name: fullName,
          display_name: fullName,
        },
      },
    });
    
    if (error) {
      return { success: false, error: error.message, code: 'SIGNUP_FAILED' };
    }
    
    if (data.user) {
      return {
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email || email,
          provider: 'email',
          createdAt: data.user.created_at,
        },
        token: data.session?.access_token,
        refreshToken: data.session?.refresh_token,
      };
    }
    
    return { success: false, error: 'No user returned', code: 'SIGNUP_FAILED' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Signup failed', code: 'NETWORK_ERROR' };
  }
}

export async function signIn(email: string, password: string): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      return { success: false, error: error.message, code: 'LOGIN_FAILED' };
    }
    
    if (data.user) {
      return {
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email || email,
          provider: 'email',
          createdAt: data.user.created_at,
        },
        token: data.session?.access_token,
        refreshToken: data.session?.refresh_token,
      };
    }
    
    return { success: false, error: 'No user returned', code: 'LOGIN_FAILED' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Login failed', code: 'NETWORK_ERROR' };
  }
}

export async function signOut(): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Logout failed' };
  }
}

export async function getCurrentUser(): Promise<AuthResponse> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' };
    }
    
    // Get profile from database
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email || '',
        provider: user.app_metadata.provider === 'google' ? 'google' : 'email',
        createdAt: user.created_at,
      },
      profile: profile ? {
        id: profile.id,
        userId: profile.id,
        email: user.email || '',
        name: profile.display_name,
        avatarUrl: profile.avatar_url,
        bio: profile.bio,
        handle: profile.handle,
        quizCompleted: profile.quiz_completed,
        travelDNA: profile.travel_dna as Record<string, unknown> | null,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      } : undefined,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to get user', code: 'FETCH_ERROR' };
  }
}

export async function resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to send reset email' };
  }
}

export async function updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update password' };
  }
}

export async function signInWithGoogle(): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Google sign in failed' };
  }
}

// ============================================================================
// Health Check
// ============================================================================

export async function checkAuthHealth(): Promise<{ healthy: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.getSession();
    return { healthy: !error };
  } catch (err) {
    return { healthy: false, error: err instanceof Error ? err.message : 'Health check failed' };
  }
}

// ============================================================================
// Export default object for backward compatibility
// ============================================================================

const voyanceAuth = {
  signUp,
  signIn,
  signOut,
  getCurrentUser,
  resetPassword,
  updatePassword,
  signInWithGoogle,
  getAuthHeader,
  getStoredToken,
  setStoredToken,
  clearTokens,
  checkAuthHealth,
};

export default voyanceAuth;
