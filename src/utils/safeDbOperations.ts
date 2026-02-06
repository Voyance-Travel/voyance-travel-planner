/**
 * Safe Database Operations
 * 
 * Utilities to prevent silent failures from .update() calls when rows don't exist.
 * These functions use .upsert() internally and provide proper error handling.
 */

import { supabase } from '@/integrations/supabase/client';
import toast from './simpleToast';

export interface SafeDbResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Safe upsert for profiles table
 * Always succeeds or throws - never silently fails
 */
export async function safeUpdateProfile(
  userId: string,
  updates: {
    display_name?: string;
    avatar_url?: string;
    first_name?: string;
    last_name?: string;
    handle?: string;
    bio?: string;
    home_airport?: string;
    quiz_completed?: boolean;
    travel_dna?: unknown;
  }
): Promise<SafeDbResult<void>> {
  try {
    const payload = {
      id: userId,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('profiles')
      .upsert(payload as any, { onConflict: 'id' });

    if (error) {
      console.error('[SafeDB] Profile upsert failed:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[SafeDB] Profile upsert exception:', err);
    return { success: false, error: message };
  }
}

/**
 * Safe upsert for user_preferences table
 * Creates the row if it doesn't exist, updates if it does
 */
export async function safeUpdatePreferences(
  userId: string,
  updates: Record<string, unknown>
): Promise<SafeDbResult<void>> {
  try {
    const { error } = await supabase
      .from('user_preferences')
      .upsert(
        {
          user_id: userId,
          ...updates,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('[SafeDB] Preferences upsert failed:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[SafeDB] Preferences upsert exception:', err);
    return { success: false, error: message };
  }
}

/**
 * Safe upsert for travel_dna_profiles table
 * Creates the row if it doesn't exist, updates if it does
 */
export async function safeUpdateTravelDNA(
  userId: string,
  updates: Record<string, unknown>
): Promise<SafeDbResult<void>> {
  try {
    const { error } = await supabase
      .from('travel_dna_profiles')
      .upsert(
        {
          user_id: userId,
          ...updates,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('[SafeDB] TravelDNA upsert failed:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[SafeDB] TravelDNA upsert exception:', err);
    return { success: false, error: message };
  }
}

/**
 * Ensure a row exists in a user-linked table
 * Useful for tables that should have been created on signup but might not exist
 */
export async function ensureUserRowExists(
  table: 'user_preferences' | 'travel_dna_profiles',
  userId: string
): Promise<SafeDbResult<void>> {
  try {
    const userIdColumn = table === 'user_preferences' ? 'user_id' : 'user_id';
    
    const { error } = await supabase
      .from(table)
      .upsert(
        { [userIdColumn]: userId } as any,
        { onConflict: userIdColumn }
      );

    if (error) {
      console.error(`[SafeDB] ensureUserRowExists(${table}) failed:`, error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[SafeDB] ensureUserRowExists(${table}) exception:`, err);
    return { success: false, error: message };
  }
}

/**
 * Wrapper for database operations that shows toast on failure
 * Use this when you want automatic user feedback
 */
export async function withFeedback<T>(
  operation: () => Promise<SafeDbResult<T>>,
  errorMessage = 'Failed to save. Please try again.'
): Promise<SafeDbResult<T>> {
  const result = await operation();
  
  if (!result.success) {
    toast.error(errorMessage);
  }
  
  return result;
}

/**
 * Generic safe update that uses upsert pattern
 * For tables with user_id as the conflict column
 */
export async function safeUserTableUpdate<T extends Record<string, unknown>>(
  table: string,
  userId: string,
  updates: T,
  conflictColumn = 'user_id'
): Promise<SafeDbResult<void>> {
  try {
    const payload = {
      [conflictColumn]: userId,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from(table as any)
      .upsert(payload as any, { onConflict: conflictColumn });

    if (error) {
      console.error(`[SafeDB] ${table} upsert failed:`, error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[SafeDB] ${table} upsert exception:`, err);
    return { success: false, error: message };
  }
}
