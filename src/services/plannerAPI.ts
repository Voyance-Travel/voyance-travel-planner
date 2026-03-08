/**
 * Voyance Planner API
 * 
 * Trip planner operations via Supabase.
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================================================
// Types
// ============================================================================

export interface TripDestination {
  city: string;
  country?: string;
  nights?: number;
}

export interface TripCreateInput {
  originCity: string;
  destinations: TripDestination[];
  startDate: string;
  endDate: string;
  tripType: 'vacation' | 'business' | 'adventure' | 'romantic' | 'family';
  travelers: number;
  budgetTier?: 'safe' | 'stretch' | 'splurge';
}

export interface TripUpdateInput {
  originCity?: string;
  destinations?: TripDestination[];
  startDate?: string;
  endDate?: string;
  tripType?: 'vacation' | 'business' | 'adventure' | 'romantic' | 'family';
  travelers?: number;
}

export interface PlannerTrip {
  id: string;
  sessionId: string;
  name: string;
  originCity: string;
  destination: string;
  startDate: string;
  endDate: string;
  tripType: string;
  travelers: number;
  status: 'draft' | 'planning' | 'booked' | 'completed';
  metadata?: Record<string, unknown>;
}

export interface CreateTripResponse {
  tripId: string;
  sessionId: string;
}

// ============================================================================
// API Functions
// ============================================================================

export async function createPlannerTrip(input: TripCreateInput): Promise<CreateTripResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  const primaryDestination = input.destinations[0];
  const sessionId = crypto.randomUUID();
  
  // Get user's current plan tier for ownership tracking
  const { data: entitlements } = await supabase.functions.invoke('get-entitlements');
  const ownerPlanTier = entitlements?.plans?.[0] || 'free';

  const insertData = {
    user_id: user.id,
    name: `Trip to ${primaryDestination.city}`,
    origin_city: input.originCity,
    destination: primaryDestination.city,
    destination_country: primaryDestination.country || null,
    start_date: input.startDate,
    end_date: input.endDate,
    trip_type: input.tripType,
    travelers: input.travelers,
    budget_tier: input.budgetTier || 'moderate',
    owner_plan_tier: ownerPlanTier,
    creation_source: (input as any).creationSource || 'single_city',
    status: 'draft' as const,
    metadata: JSON.parse(JSON.stringify({
      sessionId,
      destinations: input.destinations,
    })),
  };
  
  const { data, error } = await supabase
    .from('trips')
    .insert(insertData)
    .select('id')
    .single();
  
  if (error) throw new Error(error.message);
  
  return { tripId: data.id, sessionId };
}

export async function getPlannerTrip(tripId: string): Promise<PlannerTrip> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .eq('user_id', user.id)
    .single();
  
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Trip not found');
  
  const metadata = data.metadata as Record<string, unknown> | null;
  
  return {
    id: data.id,
    sessionId: (metadata?.sessionId as string) || data.id,
    name: data.name,
    originCity: data.origin_city || '',
    destination: data.destination,
    startDate: data.start_date,
    endDate: data.end_date,
    tripType: data.trip_type || 'vacation',
    travelers: data.travelers || 1,
    status: data.status as PlannerTrip['status'],
    metadata: metadata || undefined,
  };
}

export async function updatePlannerTrip(tripId: string, input: TripUpdateInput): Promise<PlannerTrip> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  const updates: Record<string, unknown> = {};
  if (input.originCity) updates.origin_city = input.originCity;
  if (input.startDate) updates.start_date = input.startDate;
  if (input.endDate) updates.end_date = input.endDate;
  if (input.tripType) updates.trip_type = input.tripType;
  if (input.travelers) updates.travelers = input.travelers;
  if (input.destinations?.length) {
    updates.destination = input.destinations[0].city;
    updates.destination_country = input.destinations[0].country;
  }
  
  const { data, error } = await supabase
    .from('trips')
    .update(updates)
    .eq('id', tripId)
    .eq('user_id', user.id)
    .select()
    .single();
  
  if (error) throw new Error(error.message);
  
  const metadata = data.metadata as Record<string, unknown> | null;
  
  return {
    id: data.id,
    sessionId: (metadata?.sessionId as string) || data.id,
    name: data.name,
    originCity: data.origin_city || '',
    destination: data.destination,
    startDate: data.start_date,
    endDate: data.end_date,
    tripType: data.trip_type || 'vacation',
    travelers: data.travelers || 1,
    status: data.status as PlannerTrip['status'],
    metadata: metadata || undefined,
  };
}

// ============================================================================
// React Query Hooks
// ============================================================================

export function usePlannerTrip(tripId: string | null) {
  return useQuery({
    queryKey: ['plannerTrip', tripId],
    queryFn: () => tripId ? getPlannerTrip(tripId) : null,
    enabled: !!tripId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreatePlannerTrip() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createPlannerTrip,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips-lightweight'] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['plannerTrip'] });
    },
  });
}

export function useUpdatePlannerTrip() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tripId, input }: { tripId: string; input: TripUpdateInput }) => 
      updatePlannerTrip(tripId, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['plannerTrip', data.id] });
      queryClient.invalidateQueries({ queryKey: ['trips-lightweight'] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}

// ============================================================================
// Default Export
// ============================================================================

const plannerAPI = {
  createPlannerTrip,
  getPlannerTrip,
  updatePlannerTrip,
};

export default plannerAPI;
