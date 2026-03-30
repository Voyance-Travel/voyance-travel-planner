/**
 * Trips Service - Supabase
 * 
 * Manages trips stored in Lovable Cloud (Supabase)
 */

import { supabase } from '@/integrations/supabase/client';
import { getLocalToday } from '@/utils/dateUtils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';
import { syncFlightToLedger, syncHotelToLedger } from '@/services/budgetLedgerSync';
import { patchItineraryWithFlight } from '@/services/flightItineraryPatch';
import { patchItineraryWithHotel } from '@/services/hotelItineraryPatch';

// ============================================================================
// TYPES
// ============================================================================

export type TripStatus = 'draft' | 'planning' | 'booked' | 'active' | 'completed' | 'cancelled';
export type ItineraryStatus = 'not_started' | 'queued' | 'generating' | 'ready' | 'failed';

// Raw database row type
interface TripRow {
  id: string;
  user_id: string;
  name: string;
  origin_city: string | null;
  destination: string;
  destination_country: string | null;
  start_date: string;
  end_date: string;
  travelers: number | null;
  trip_type: string | null;
  budget_tier: string | null;
  status: string;
  itinerary_status: string | null;
  itinerary_data: Json | null;
  flight_selection: Json | null;
  hotel_selection: Json | null;
  price_lock_expires_at: string | null;
  metadata: Json | null;
  created_at: string;
  updated_at: string;
}

/**
 * Columns to select for lightweight dashboard queries.
 * Excludes itinerary_data (50-100KB JSON blob) which is only needed on the itinerary view.
 */
export const LIGHTWEIGHT_TRIP_COLUMNS = `
  id, user_id, name, origin_city, destination, destination_country,
  start_date, end_date, travelers, trip_type, budget_tier, status,
  itinerary_status, flight_selection, hotel_selection, price_lock_expires_at,
  metadata, journey_id, journey_name, journey_order, journey_total_legs,
  transition_mode, creation_source, is_multi_city, created_at, updated_at
` as const;

// Application-level Trip type
export interface Trip {
  id: string;
  user_id: string;
  name: string;
  origin_city: string | null;
  destination: string;
  destination_country: string | null;
  start_date: string;
  end_date: string;
  travelers: number;
  trip_type: string;
  budget_tier: string;
  status: TripStatus;
  itinerary_status: ItineraryStatus;
  itinerary_data: ItineraryData | null;
  flight_selection: FlightSelection | null;
  hotel_selection: HotelSelection | null;
  price_lock_expires_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ItineraryData {
  title?: string;
  destination?: string;
  days: ItineraryDay[];
  highlights?: string[];
  localTips?: string[];
  generatedAt?: string;
}

export interface ItineraryDay {
  dayNumber: number;
  date?: string;
  theme?: string;
  activities: ItineraryActivity[];
  weather?: {
    high: number;
    low: number;
    condition: string;
  };
}

export interface ItineraryActivity {
  id: string;
  name: string;
  description: string;
  category: string;
  startTime: string;
  endTime: string;
  duration: string;
  location: string;
  estimatedCost: { amount: number; currency: string };
  bookingRequired: boolean;
  tips?: string;
  isLocked?: boolean;
}

export interface FlightSelection {
  id?: string;
  airline?: string;
  flightNumber?: string;
  departureAirport?: string;
  arrivalAirport?: string;
  departureTime?: string;
  arrivalTime?: string;
  price?: number;
  currency?: string;
}

export interface HotelSelection {
  id?: string;
  name?: string;
  address?: string;
  starRating?: number;
  pricePerNight?: number;
  totalPrice?: number;
  currency?: string;
  roomType?: string;
  imageUrl?: string;
  checkIn?: string;
  checkOut?: string;
}

export interface TripCreateInput {
  name: string;
  origin_city?: string;
  destination: string;
  destination_country?: string;
  start_date: string;
  end_date: string;
  travelers?: number;
  trip_type?: string;
  budget_tier?: string;
}

export interface TripUpdateInput {
  name?: string;
  origin_city?: string;
  destination?: string;
  destination_country?: string;
  start_date?: string;
  end_date?: string;
  travelers?: number;
  trip_type?: string;
  budget_tier?: string;
  status?: TripStatus;
  itinerary_status?: ItineraryStatus;
  itinerary_data?: Json;
  flight_selection?: Json;
  hotel_selection?: Json;
  price_lock_expires_at?: string;
  metadata?: Json;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Transform database row to application Trip type
 */
function transformTrip(row: TripRow): Trip {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    origin_city: row.origin_city,
    destination: row.destination,
    destination_country: row.destination_country,
    start_date: row.start_date,
    end_date: row.end_date,
    travelers: row.travelers ?? 1,
    trip_type: row.trip_type ?? 'vacation',
    budget_tier: row.budget_tier ?? 'moderate',
    status: (row.status as TripStatus) ?? 'draft',
    itinerary_status: (row.itinerary_status as ItineraryStatus) ?? 'not_started',
    itinerary_data: row.itinerary_data as unknown as ItineraryData | null,
    flight_selection: row.flight_selection as unknown as FlightSelection | null,
    hotel_selection: row.hotel_selection as unknown as HotelSelection | null,
    price_lock_expires_at: row.price_lock_expires_at,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get current user ID helper
 */
async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

/**
 * Create a new trip
 */
export async function createTrip(input: TripCreateInput): Promise<Trip> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('trips')
    .insert({
      user_id: userId,
      name: input.name,
      origin_city: input.origin_city || null,
      destination: input.destination,
      destination_country: input.destination_country || null,
      start_date: input.start_date,
      end_date: input.end_date,
      travelers: input.travelers || 1,
      trip_type: input.trip_type || 'vacation',
      budget_tier: input.budget_tier || 'moderate',
      status: 'draft',
      itinerary_status: 'not_started',
    })
    .select()
    .single();

  if (error) {
    console.error('[Trips] Error creating trip:', error);
    throw error;
  }

  return transformTrip(data as TripRow);
}

/**
 * Get all trips for current user
 */
export async function getTrips(): Promise<Trip[]> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Trips] Error fetching trips:', error);
    throw error;
  }

  return (data || []).map(row => transformTrip(row as TripRow));
}

/**
 * Get all trips for current user — lightweight version for dashboard/list views.
 * Excludes itinerary_data (50-100KB JSON blob) to reduce payload by ~97%.
 */
export async function getTripsLightweight(): Promise<Trip[]> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('trips')
    .select(LIGHTWEIGHT_TRIP_COLUMNS)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[Trips] Error fetching lightweight trips:', error);
    throw error;
  }

  // Return with null itinerary_data since we didn't fetch it
  return (data || []).map(row => transformTrip({
    ...row,
    itinerary_data: null,
  } as TripRow));
}

/**
 * Get a single trip by ID
 */
export async function getTrip(tripId: string): Promise<Trip | null> {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .maybeSingle();

  if (error) {
    console.error('[Trips] Error fetching trip:', error);
    throw error;
  }

  return data ? transformTrip(data as TripRow) : null;
}

/**
 * Update a trip
 */
export async function updateTrip(tripId: string, updates: TripUpdateInput): Promise<Trip> {
  const { data, error } = await supabase
    .from('trips')
    .update(updates)
    .eq('id', tripId)
    .select()
    .single();

  if (error) {
    console.error('[Trips] Error updating trip:', error);
    throw error;
  }

  return transformTrip(data as TripRow);
}

/**
 * Delete a trip
 */
export async function deleteTrip(tripId: string): Promise<void> {
  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', tripId);

  if (error) {
    console.error('[Trips] Error deleting trip:', error);
    throw error;
  }
}

/**
 * Save itinerary data to trip
 */
export async function saveItinerary(tripId: string, itinerary: ItineraryData): Promise<Trip> {
  return updateTrip(tripId, {
    itinerary_data: itinerary as unknown as Json,
    itinerary_status: 'ready',
  });
}

/**
 * Save flight selection
 */
export async function saveFlightSelection(tripId: string, flight: FlightSelection): Promise<Trip> {
  // Set price lock for 15 minutes
  const priceLockExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  
  return updateTrip(tripId, {
    flight_selection: flight as unknown as Json,
    price_lock_expires_at: priceLockExpires,
  });
}

/**
 * Save hotel selection
 */
export async function saveHotelSelection(tripId: string, hotel: HotelSelection): Promise<Trip> {
  return updateTrip(tripId, {
    hotel_selection: hotel as unknown as Json,
  });
}

/**
 * Get trips by status
 */
export async function getTripsByStatus(status: TripStatus): Promise<Trip[]> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', userId)
    .eq('status', status)
    .order('start_date', { ascending: true });

  if (error) throw error;
  return (data || []).map(row => transformTrip(row as TripRow));
}

/**
 * Get upcoming trips
 */
export async function getUpcomingTrips(): Promise<Trip[]> {
  const userId = await getCurrentUserId();
  const today = getLocalToday();

  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', userId)
    .gte('start_date', today)
    .in('status', ['draft', 'planning', 'booked'])
    .order('start_date', { ascending: true });

  if (error) throw error;
  return (data || []).map(row => transformTrip(row as TripRow));
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useTrips() {
  return useQuery({
    queryKey: ['trips'],
    queryFn: getTrips,
    staleTime: 120_000, // 2 minutes — full trip data doesn't change often
  });
}

/**
 * Lightweight hook for dashboard — doesn't fetch itinerary_data.
 * Uses a separate cache key so full trip fetches don't conflict.
 */
export function useTripsLightweight() {
  return useQuery({
    queryKey: ['trips-lightweight'],
    queryFn: getTripsLightweight,
    staleTime: 60_000, // 1 minute — dashboard doesn't need instant updates
  });
}

export function useTrip(tripId: string | undefined) {
  return useQuery({
    queryKey: ['trip', tripId],
    queryFn: () => getTrip(tripId!),
    enabled: !!tripId,
    staleTime: 120_000, // 2 minutes — itinerary data doesn't change without user action
    gcTime: 600_000, // Keep in cache for 10 minutes
  });
}

export function useUpcomingTrips() {
  return useQuery({
    queryKey: ['trips', 'upcoming'],
    queryFn: getUpcomingTrips,
    staleTime: 60_000,
  });
}

export function useCreateTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTrip,
    onSuccess: async () => {
      toast.success('Trip created!');
      queryClient.invalidateQueries({ queryKey: ['trips-lightweight'] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });

      // Check if this is the user's second trip and grant bonus
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { count } = await supabase
            .from('trips')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id);

          if (count && count >= 2) {
            const { default: useBonusCreditsModule } = await import('@/hooks/useBonusCredits');
            // Direct API call since we can't use hooks here
            const { data: existing } = await supabase
              .from('user_credit_bonuses')
              .select('id')
              .eq('user_id', user.id)
              .eq('bonus_type', 'second_itinerary')
              .maybeSingle();

            if (!existing) {
              await supabase.functions.invoke('grant-bonus-credits', {
                body: { bonusType: 'second_itinerary' },
              });
              toast.success('+50 credits earned for your second trip! ✈️');
              queryClient.invalidateQueries({ queryKey: ['credits', user.id] });
              queryClient.invalidateQueries({ queryKey: ['bonus-credits', user.id] });
            }
          }
        }
      } catch (e) {
        console.log('[useCreateTrip] Second trip bonus check failed:', e);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create trip');
    },
  });
}

export function useUpdateTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tripId, updates }: { tripId: string; updates: TripUpdateInput }) =>
      updateTrip(tripId, updates),
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trips-lightweight'] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update trip');
    },
  });
}

export function useDeleteTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTrip,
    onSuccess: () => {
      toast.success('Trip deleted');
      queryClient.invalidateQueries({ queryKey: ['trips-lightweight'] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete trip');
    },
  });
}

export function useSaveItinerary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tripId, itinerary }: { tripId: string; itinerary: ItineraryData }) =>
      saveItinerary(tripId, itinerary),
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
    },
  });
}

export function useSaveFlightSelection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tripId, flight }: { tripId: string; flight: FlightSelection }) => {
      const trip = await saveFlightSelection(tripId, flight);
      // Sync flight price to budget ledger
      await syncFlightToLedger(tripId, flight);
      // Patch Day 1/last day activities with flight times
      try {
        await patchItineraryWithFlight(tripId, flight);
      } catch (e) { console.warn('[useSaveFlightSelection] itinerary patch skipped:', e); }
      // Cascade transport changes
      try {
        const { runCascadeAndPersist } = await import('@/services/cascadeTransportToItinerary');
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: tripData } = await supabase
          .from('trips')
          .select('itinerary_data, is_multi_city')
          .eq('id', tripId)
          .single();
        const itDays = (tripData?.itinerary_data as any)?.days;
        if (itDays?.length) {
          if (tripData?.is_multi_city) {
            const { getTripCities } = await import('@/services/tripCitiesService');
            const cities = await getTripCities(tripId);
            await runCascadeAndPersist(tripId, itDays, flight, cities);
          } else {
            await runCascadeAndPersist(tripId, itDays, flight);
          }
        }
      } catch (e) { console.warn('[useSaveFlightSelection] cascade skipped:', e); }
      return trip;
    },
    onSuccess: (_, { tripId }) => {
      toast.success('Flight selection saved');
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      queryClient.invalidateQueries({ queryKey: ['budget', tripId] });
      window.dispatchEvent(new CustomEvent('booking-changed', { detail: { tripId } }));
    },
  });
}

export function useSaveHotelSelection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tripId, hotel }: { tripId: string; hotel: HotelSelection }) => {
      const trip = await saveHotelSelection(tripId, hotel);
      // Sync hotel price to budget ledger
      await syncHotelToLedger(tripId, hotel);
      // Patch itinerary accommodation activities with hotel name
      try {
        await patchItineraryWithHotel(tripId, {
          name: hotel.name || '',
          address: hotel.address,
          checkInDate: (hotel as any).checkInDate || (hotel as any).checkIn,
          checkOutDate: (hotel as any).checkOutDate || (hotel as any).checkOut,
        });
      } catch (e) { console.warn('[useSaveHotelSelection] itinerary patch skipped:', e); }
      return trip;
    },
    onSuccess: (_, { tripId }) => {
      toast.success('Hotel selection saved');
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      queryClient.invalidateQueries({ queryKey: ['budget', tripId] });
      window.dispatchEvent(new CustomEvent('booking-changed', { detail: { tripId } }));
    },
  });
}
