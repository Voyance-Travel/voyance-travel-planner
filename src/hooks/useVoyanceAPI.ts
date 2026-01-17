/**
 * React Query hooks for Voyance Backend API
 * Provides data fetching, caching, and mutations for trips, itineraries, and preferences
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  voyanceAPI,
  tripsAPI,
  itineraryAPI,
  preferencesAPI,
  type BackendTrip,
  type CreateTripRequest,
  type UpdateTripRequest,
  type ListTripsParams,
  type ItineraryResponse,
  type UserPreferences,
  type ItineraryStatus,
} from '@/services/voyanceAPI';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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

/**
 * Fetch all trips for the current user
 */
export function useTrips(params: ListTripsParams = {}) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.trips.list(params),
    queryFn: () => tripsAPI.list(params),
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Fetch a single trip by ID
 */
export function useTrip(tripId: string | undefined) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.trips.detail(tripId || ''),
    queryFn: () => tripsAPI.get(tripId!),
    enabled: !!user && !!tripId,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Create a new trip
 */
export function useCreateTrip() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (trip: CreateTripRequest) => tripsAPI.create(trip),
    onSuccess: (newTrip) => {
      // Invalidate trips list
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.all });
      
      // Add to cache
      queryClient.setQueryData(queryKeys.trips.detail(newTrip.id), newTrip);
      
      toast.success('Trip created successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create trip');
    },
  });
}

/**
 * Update an existing trip
 */
export function useUpdateTrip() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tripId, updates }: { tripId: string; updates: UpdateTripRequest }) =>
      tripsAPI.update(tripId, updates),
    onSuccess: (updatedTrip) => {
      // Update cache
      queryClient.setQueryData(queryKeys.trips.detail(updatedTrip.id), updatedTrip);
      
      // Invalidate list to refresh
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.list() });
      
      toast.success('Trip updated successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update trip');
    },
  });
}

/**
 * Delete a trip
 */
export function useDeleteTrip() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (tripId: string) => tripsAPI.delete(tripId),
    onSuccess: (_, tripId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: queryKeys.trips.detail(tripId) });
      
      // Invalidate list
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.all });
      
      toast.success('Trip deleted successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete trip');
    },
  });
}

// =============================================================================
// ITINERARY HOOKS
// =============================================================================

/**
 * Fetch itinerary for a trip
 */
export function useItinerary(tripId: string | undefined) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.itinerary.detail(tripId || ''),
    queryFn: () => itineraryAPI.get(tripId!),
    enabled: !!user && !!tripId,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Generate itinerary with polling
 */
export function useGenerateItinerary() {
  const queryClient = useQueryClient();
  const [isPolling, setIsPolling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<ItineraryStatus | null>(null);
  const abortRef = useRef(false);
  
  const mutation = useMutation({
    mutationFn: async ({ tripId, force = false }: { tripId: string; force?: boolean }) => {
      abortRef.current = false;
      setIsPolling(true);
      setProgress(0);
      setStatus('queued');
      
      // Start generation
      const initialResponse = await itineraryAPI.generateNow(tripId, force);
      
      // If already ready, return immediately
      if (initialResponse.status === 'ready') {
        setIsPolling(false);
        setProgress(100);
        setStatus('ready');
        return initialResponse;
      }
      
      // Poll until ready
      const result = await itineraryAPI.pollUntilReady(tripId, {
        pollIntervalMs: 3000,
        timeoutMs: 300000,
        onProgress: (response) => {
          if (abortRef.current) return;
          setProgress(response.progress || response.percentComplete || 0);
          setStatus(response.status);
        },
      });
      
      setIsPolling(false);
      setProgress(100);
      setStatus('ready');
      return result;
    },
    onSuccess: (result, { tripId }) => {
      // Update cache
      queryClient.setQueryData(queryKeys.itinerary.detail(tripId), result);
      
      // Also invalidate trip to get updated itineraryId
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(tripId) });
      
      toast.success('Itinerary generated successfully!');
    },
    onError: (error: Error) => {
      setIsPolling(false);
      setStatus('failed');
      toast.error(error.message || 'Failed to generate itinerary');
    },
  });
  
  const abort = useCallback(() => {
    abortRef.current = true;
    setIsPolling(false);
  }, []);
  
  return {
    ...mutation,
    isPolling,
    progress,
    status,
    abort,
  };
}

// =============================================================================
// PREFERENCES HOOKS
// =============================================================================

/**
 * Fetch user preferences
 */
export function usePreferences() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.preferences.user(),
    queryFn: () => preferencesAPI.get(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Save user preferences
 */
export function useSavePreferences() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (preferences: Partial<Omit<UserPreferences, 'userId' | 'createdAt' | 'updatedAt'>>) =>
      preferencesAPI.save(preferences),
    onSuccess: (updatedPrefs) => {
      // Update cache
      queryClient.setQueryData(queryKeys.preferences.user(), updatedPrefs);
      
      toast.success('Preferences saved successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save preferences');
    },
  });
}

// =============================================================================
// UTILITY HOOKS
// =============================================================================

/**
 * Check backend health
 */
export function useBackendHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => voyanceAPI.healthCheck(),
    staleTime: 60 * 1000, // 1 minute
    retry: 1,
  });
}

/**
 * Check if user is authenticated with backend
 */
export function useIsAuthenticated() {
  const { user } = useAuth();
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    if (user) {
      voyanceAPI.isAuthenticated().then(setIsReady);
    } else {
      setIsReady(false);
    }
  }, [user]);
  
  return isReady;
}

// =============================================================================
// PREFETCH HELPERS
// =============================================================================

/**
 * Prefetch trips list
 */
export function usePrefetchTrips() {
  const queryClient = useQueryClient();
  
  return useCallback(
    (params?: ListTripsParams) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.trips.list(params),
        queryFn: () => tripsAPI.list(params),
        staleTime: 30 * 1000,
      });
    },
    [queryClient]
  );
}

/**
 * Prefetch a single trip
 */
export function usePrefetchTrip() {
  const queryClient = useQueryClient();
  
  return useCallback(
    (tripId: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.trips.detail(tripId),
        queryFn: () => tripsAPI.get(tripId),
        staleTime: 60 * 1000,
      });
    },
    [queryClient]
  );
}
