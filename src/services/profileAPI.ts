/**
 * Voyance Profile API Service
 * 
 * All profile operations go through Supabase directly.
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================================================
// Types
// ============================================================================

export interface TravelDNAArchetype {
  primary: string;
  secondary?: string;
  confidence?: number;
  rarity?: string;
}

export interface TravelDNAPreferences {
  pace?: string;
  budget?: string;
  accommodation?: string;
  activityLevel?: string;
  planning?: string;
}

export interface TravelDNA {
  type: string;
  archetype?: TravelDNAArchetype;
  traits?: string[];
  preferences?: TravelDNAPreferences;
  emotionalDrivers?: string[];
  travelPersona?: {
    travelerType?: string;
    identityClass?: string;
    planningPreference?: string;
  };
  fullProfile?: Record<string, unknown>;
  calculatedAt?: string;
}

export interface UserPreferences {
  id?: string;
  userId?: string;
  budget?: string;
  travelStyle?: string;
  pace?: string;
  hotelStyle?: string;
  vibe?: string;
  activities?: Record<string, number>;
  climate?: string[];
  preferredRegions?: string[];
  dietaryRestrictions?: string[];
  tripDuration?: string;
  ecoFriendly?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  emailVerified?: boolean;
  name?: string;
  display_name?: string;
  firstName?: string;
  lastName?: string;
  handle?: string;
  avatarUrl?: string;
  bio?: string;
  createdAt: string;
  preferences?: UserPreferences | null;
  travelDNA?: TravelDNA | null;
  quizCompleted?: boolean;
}

export interface ProfileResponse {
  success: boolean;
  authenticated: boolean;
  profile: UserProfile | null;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// API Functions
// ============================================================================

export async function getProfile(): Promise<ProfileResponse> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: true, authenticated: false, profile: null };
    }
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      return {
        success: false,
        authenticated: true,
        profile: null,
        error: { code: 'FETCH_ERROR', message: error.message },
      };
    }
    
    // Get preferences
    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    const userProfile: UserProfile = {
      id: user.id,
      email: user.email || '',
      name: profile?.display_name || user.user_metadata?.name,
      display_name: profile?.display_name,
      avatarUrl: profile?.avatar_url,
      bio: profile?.bio,
      handle: profile?.handle,
      quizCompleted: profile?.quiz_completed ?? false,
      travelDNA: profile?.travel_dna as TravelDNA | null,
      createdAt: profile?.created_at || user.created_at,
      preferences: preferences ? {
        id: preferences.id,
        userId: preferences.user_id,
        budget: preferences.budget_tier || undefined,
        travelStyle: preferences.travel_style || undefined,
        pace: preferences.travel_pace || undefined,
        hotelStyle: preferences.hotel_style || undefined,
        vibe: preferences.vibe || undefined,
        climate: preferences.climate_preferences || undefined,
        preferredRegions: preferences.preferred_regions || undefined,
        dietaryRestrictions: preferences.dietary_restrictions || undefined,
        tripDuration: preferences.trip_duration || undefined,
        ecoFriendly: preferences.eco_friendly ?? undefined,
      } : null,
    };
    
    return { success: true, authenticated: true, profile: userProfile };
  } catch (err) {
    return {
      success: false,
      authenticated: false,
      profile: null,
      error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Failed to fetch profile' },
    };
  }
}

export async function updateProfile(updates: {
  displayName?: string;
  bio?: string;
  handle?: string;
  avatarUrl?: string;
  homeAirport?: string;
}): Promise<ProfileResponse> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, authenticated: false, profile: null, error: { code: 'NOT_AUTH', message: 'Not authenticated' } };
    }
    
    const dbUpdates: Record<string, unknown> = {};
    if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName;
    if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
    if (updates.handle !== undefined) dbUpdates.handle = updates.handle;
    if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;
    if (updates.homeAirport !== undefined) dbUpdates.home_airport = updates.homeAirport;
    
    const { error } = await supabase
      .from('profiles')
      .update(dbUpdates)
      .eq('id', user.id);
    
    if (error) {
      return { success: false, authenticated: true, profile: null, error: { code: 'UPDATE_FAILED', message: error.message } };
    }
    
    return getProfile();
  } catch (err) {
    return {
      success: false,
      authenticated: false,
      profile: null,
      error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Failed to update profile' },
    };
  }
}

export async function updatePreferences(preferences: Partial<UserPreferences>): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    
    const dbUpdates: Record<string, unknown> = { user_id: user.id };
    if (preferences.budget !== undefined) dbUpdates.budget_tier = preferences.budget;
    if (preferences.travelStyle !== undefined) dbUpdates.travel_style = preferences.travelStyle;
    if (preferences.pace !== undefined) dbUpdates.travel_pace = preferences.pace;
    if (preferences.hotelStyle !== undefined) dbUpdates.hotel_style = preferences.hotelStyle;
    if (preferences.vibe !== undefined) dbUpdates.vibe = preferences.vibe;
    if (preferences.climate !== undefined) dbUpdates.climate_preferences = preferences.climate;
    if (preferences.preferredRegions !== undefined) dbUpdates.preferred_regions = preferences.preferredRegions;
    if (preferences.dietaryRestrictions !== undefined) dbUpdates.dietary_restrictions = preferences.dietaryRestrictions;
    if (preferences.tripDuration !== undefined) dbUpdates.trip_duration = preferences.tripDuration;
    if (preferences.ecoFriendly !== undefined) dbUpdates.eco_friendly = preferences.ecoFriendly;
    
    const { error } = await supabase
      .from('user_preferences')
      .upsert(dbUpdates, { onConflict: 'user_id' });
    
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update preferences' };
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updatePreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['preferences'] });
    },
  });
}

// ============================================================================
// Default Export
// ============================================================================

const profileAPI = {
  getProfile,
  updateProfile,
  updatePreferences,
};

export default profileAPI;
