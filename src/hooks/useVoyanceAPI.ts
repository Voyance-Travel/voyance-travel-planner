/**
 * React Query hooks for Voyance API
 * All data fetching goes directly through Supabase
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// =============================================================================
// TYPES
// =============================================================================

export interface BackendTrip {
  id: string;
  user_id: string;
  name: string;
  destination: string;
  destination_country?: string;
  start_date: string;
  end_date: string;
  trip_type?: string;
  travelers?: number;
  budget_tier?: string;
  origin_city?: string;
  status: string;
  flight_selection?: unknown;
  hotel_selection?: unknown;
  itinerary_data?: unknown;
  metadata?: unknown;
  created_at: string;
  updated_at: string;
}

export interface CreateTripRequest {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  tripType?: string;
  travelers?: number;
  originCity?: string;
  budgetTier?: string;
  creationSource?: 'single_city' | 'multi_city' | 'chat' | 'manual_paste' | 'mystery_getaway';
}

export interface UpdateTripRequest {
  name?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  tripType?: string;
  travelers?: number;
  originCity?: string;
  budgetTier?: string;
  status?: string;
}

export interface ListTripsParams {
  status?: string;
  limit?: number;
}

// =============================================================================
// QUERY KEYS
// =============================================================================

export const queryKeys = {
  trips: {
    all: ['trips'] as const,
    list: (params?: ListTripsParams) => ['trips', 'list', params] as const,
    detail: (id: string) => ['trips', 'detail', id] as const,
  },
  itinerary: {
    all: ['itinerary'] as const,
    detail: (tripId: string) => ['itinerary', tripId] as const,
  },
  preferences: {
    all: ['preferences'] as const,
    user: () => ['preferences', 'user'] as const,
  },
  health: ['health'] as const,
};

// =============================================================================
// TRIPS HOOKS
// =============================================================================

export function useTrips(params: ListTripsParams = {}) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.trips.list(params),
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');
      
      // Fetch owned trips
      let ownQuery = supabase
        .from('trips')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (params.status) {
        ownQuery = ownQuery.eq('status', params.status as 'draft' | 'planning' | 'booked' | 'active' | 'completed' | 'cancelled');
      }
      if (params.limit) {
        ownQuery = ownQuery.limit(params.limit);
      }
      
      // Fetch collaborated trips (where user is an accepted collaborator)
      const { data: collabs } = await supabase
        .from('trip_collaborators')
        .select('trip_id')
        .eq('user_id', user.id)
        .not('accepted_at', 'is', null);
      
      const collabTripIds = (collabs || []).map(c => c.trip_id);
      
      const [ownResult, collabResult] = await Promise.all([
        ownQuery,
        collabTripIds.length > 0
          ? supabase
              .from('trips')
              .select('*')
              .in('id', collabTripIds)
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);
      
      if (ownResult.error) throw ownResult.error;
      
      // Merge and deduplicate
      const allTrips = [...(ownResult.data || [])];
      const ownIds = new Set(allTrips.map(t => t.id));
      for (const trip of (collabResult.data || [])) {
        if (!ownIds.has(trip.id)) {
          allTrips.push(trip);
        }
      }
      
      return { trips: allTrips, total: allTrips.length };
    },
    enabled: !!user,
    staleTime: 30 * 1000,
  });
}

export function useTrip(tripId: string | null) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.trips.detail(tripId || ''),
    queryFn: async () => {
      if (!tripId || !user) return null;
      
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!tripId && !!user,
    staleTime: 60 * 1000,
  });
}

export function useCreateTrip() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (input: CreateTripRequest) => {
      if (!user) throw new Error('Not authenticated');
      
      // Get user's current plan tier for ownership tracking
      const { data: entitlements } = await supabase.functions.invoke('get-entitlements');
      const ownerPlanTier = entitlements?.plans?.[0] || 'free';
      
      const { data, error } = await supabase
        .from('trips')
        .insert({
          user_id: user.id,
          name: input.name,
          destination: input.destination,
          start_date: input.startDate,
          end_date: input.endDate,
          trip_type: input.tripType,
          travelers: input.travelers,
          origin_city: input.originCity,
          budget_tier: input.budgetTier,
          owner_plan_tier: ownerPlanTier,
          creation_source: input.creationSource || 'single_city',
          is_multi_city: false,
          status: 'draft',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: async (data, input) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.all });
      toast.success('Trip created!');

      // Insert single trip_cities row for unified schema (single-city trips)
      // Multi-city flows handle their own trip_cities insertion separately
      if (!input.creationSource || input.creationSource !== 'multi_city') {
        try {
          const startMs = new Date(input.startDate).getTime();
          const endMs = new Date(input.endDate).getTime();
          const nights = Math.max(1, Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)));
          await supabase.from('trip_cities').insert({
            trip_id: data.id,
            city_order: 0,
            city_name: input.destination,
            arrival_date: input.startDate,
            departure_date: input.endDate,
            nights,
            generation_status: 'pending',
            days_total: nights + 1, // Inclusive day count: nights + 1
          } as any);
        } catch (e) {
          console.error('[useCreateTrip] trip_cities insert failed:', e);
        }
      }

      // Grant second_itinerary bonus if this is the user's 2nd trip
      try {
        if (!user) return;
        const { count } = await supabase
          .from('trips')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (count && count >= 2) {
          const { data: existing } = await supabase
            .from('user_credit_bonuses')
            .select('id')
            .eq('user_id', user.id)
            .eq('bonus_type', 'second_itinerary')
            .maybeSingle();

          if (!existing) {
            const result = await supabase.functions.invoke('grant-bonus-credits', {
              body: { bonusType: 'second_itinerary' },
            });
            if (!result.error) {
              toast.success('+50 credits earned for creating your second trip! ✈️');
              queryClient.invalidateQueries({ queryKey: ['credits', user.id] });
              queryClient.invalidateQueries({ queryKey: ['bonus-credits', user.id] });
            }
          }
        }
      } catch (e) {
        console.log('[useCreateTrip] Second trip bonus check failed:', e);
      }
    },
    onError: (error) => {
      toast.error('Failed to create trip');
      console.error('[useCreateTrip] Error:', error);
    },
  });
}

export function useUpdateTrip() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ tripId, updates }: { tripId: string; updates: UpdateTripRequest }) => {
      if (!user) throw new Error('Not authenticated');
      
      const dbUpdates: Record<string, unknown> = {};
      if (updates.name) dbUpdates.name = updates.name;
      if (updates.destination) dbUpdates.destination = updates.destination;
      if (updates.startDate) dbUpdates.start_date = updates.startDate;
      if (updates.endDate) dbUpdates.end_date = updates.endDate;
      if (updates.tripType) dbUpdates.trip_type = updates.tripType;
      if (updates.travelers) dbUpdates.travelers = updates.travelers;
      if (updates.originCity) dbUpdates.origin_city = updates.originCity;
      if (updates.budgetTier) dbUpdates.budget_tier = updates.budgetTier;
      if (updates.status) dbUpdates.status = updates.status;
      
      const { data, error } = await supabase
        .from('trips')
        .update(dbUpdates)
        .eq('id', tripId)
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.all });
      toast.success('Trip updated!');
    },
    onError: (error) => {
      toast.error('Failed to update trip');
      console.error('[useUpdateTrip] Error:', error);
    },
  });
}

export function useDeleteTrip() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (tripId: string) => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('trips')
        .delete()
        .eq('id', tripId)
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.all });
      toast.success('Trip deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete trip');
      console.error('[useDeleteTrip] Error:', error);
    },
  });
}

// =============================================================================
// ITINERARY HOOKS
// =============================================================================

export function useItinerary(tripId: string | null) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.itinerary.detail(tripId || ''),
    queryFn: async () => {
      if (!tripId || !user) return null;
      
      const { data, error } = await supabase
        .from('trips')
        .select('itinerary_data, itinerary_status')
        .eq('id', tripId)
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      return data?.itinerary_data;
    },
    enabled: !!tripId && !!user,
    staleTime: 60 * 1000,
  });
}

export function useGenerateItinerary() {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  
  const generate = useCallback(async (params: {
    tripId: string;
    destination: string;
    startDate: string;
    endDate: string;
    travelers?: number;
    tripType?: string;
    budgetTier?: string;
  }) => {
    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-itinerary', {
        body: params,
      });
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: queryKeys.itinerary.detail(params.tripId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(params.tripId) });
      
      return data;
    } finally {
      setIsGenerating(false);
    }
  }, [queryClient]);
  
  return { generate, isGenerating };
}

// =============================================================================
// PREFERENCES HOOKS
// =============================================================================

export function usePreferences() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.preferences.user(),
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSavePreferences() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (preferences: Record<string, unknown>) => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          ...preferences,
        }, { onConflict: 'user_id' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.preferences.all });
      toast.success('Preferences saved');
    },
    onError: (error) => {
      toast.error('Failed to save preferences');
      console.error('[useSavePreferences] Error:', error);
    },
  });
}

// =============================================================================
// UTILITY HOOKS
// =============================================================================

export function useBackendHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: async () => {
      // Just check if we can connect to Supabase
      const { error } = await supabase.from('destinations').select('id').limit(1);
      return { healthy: !error };
    },
    staleTime: 60 * 1000,
    retry: false,
  });
}

export function useIsAuthenticated() {
  const { user } = useAuth();
  return !!user;
}

// =============================================================================
// PREFETCH HELPERS
// =============================================================================

export function usePrefetchTrips() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useCallback(() => {
    if (!user) return;
    
    queryClient.prefetchQuery({
      queryKey: queryKeys.trips.list({}),
      queryFn: async () => {
        const { data, error } = await supabase
          .from('trips')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        return { trips: data || [], total: data?.length || 0 };
      },
    });
  }, [queryClient, user]);
}

export function usePrefetchTrip() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useCallback((tripId: string) => {
    if (!user) return;
    
    queryClient.prefetchQuery({
      queryKey: queryKeys.trips.detail(tripId),
      queryFn: async () => {
        const { data, error } = await supabase
          .from('trips')
          .select('*')
          .eq('id', tripId)
          .eq('user_id', user.id)
          .single();
        
        if (error) throw error;
        return data;
      },
    });
  }, [queryClient, user]);
}
