/**
 * Voyance API Client
 * 
 * All backend calls now go through Supabase (direct queries or Edge Functions).
 * This file provides backward-compatible exports for existing code.
 */

import { supabase } from '@/integrations/supabase/client';

// Re-export auth and quiz APIs for convenience
export { default as voyanceAuth } from './voyanceAuth';
export { default as quizAPI } from './quizAPI';

// =============================================================================
// TYPES - Backend Contract Types
// =============================================================================

// Preference Enums (5 core preferences implemented)
export type BudgetPreference = 'tight' | 'moderate' | 'flexible' | 'luxury';
export type PacePreference = 'relaxed' | 'balanced' | 'packed';
export type StylePreference = 'local' | 'tourist' | 'mixed';
export type ComfortPreference = 'basic' | 'standard' | 'premium';
export type PlanningPreference = 'structured' | 'flexible' | 'spontaneous';

// Trip Status Enum
export type TripStatus = 'draft' | 'planned' | 'booked' | 'confirmed' | 'upcoming' | 'completed' | 'cancelled';

// User Preferences
export interface UserPreferences {
  userId: string;
  budget: BudgetPreference;
  pace: PacePreference;
  style: StylePreference;
  comfort: ComfortPreference;
  planning: PlanningPreference;
  tripsCompleted?: number;
  lastTripFeedback?: {
    rating: number;
    likes: string[];
    dislikes: string[];
  };
  createdAt?: string;
  updatedAt?: string;
}

// Trip Types
export interface BackendTrip {
  id: string;
  userId: string;
  name: string;
  title?: string;
  description?: string;
  status: TripStatus;
  tripType?: string;
  
  // Destination
  destinationId?: string;
  destination: string;
  departureCity?: string;
  
  // Dates
  startDate?: string;
  endDate?: string;
  totalDays?: number;
  
  // Travelers
  travelers?: number;
  travelerType?: string;
  
  // Budget
  budgetRange?: BudgetPreference;
  estimatedCost?: number;
  currency?: string;
  
  // Characteristics
  emotionalTags?: string[];
  primaryGoal?: string;
  
  // User content
  notes?: string;
  specialRequests?: string;
  
  // Booking
  bookingReference?: string;
  
  // Sharing
  sharedWith?: string[];
  isPublic?: boolean;
  
  // Metadata
  metadata?: Record<string, unknown>;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// API FUNCTIONS - All use Supabase directly
// =============================================================================

/**
 * Get user's trips from Supabase
 */
export async function getTrips(params?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ trips: BackendTrip[]; total: number }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  let query = supabase
    .from('trips')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  
  if (params?.status) {
    query = query.eq('status', params.status);
  }
  
  if (params?.limit) {
    query = query.limit(params.limit);
  }
  
  if (params?.offset) {
    query = query.range(params.offset, params.offset + (params.limit || 10) - 1);
  }
  
  const { data, error, count } = await query;
  
  if (error) throw new Error(error.message);
  
  // Transform to BackendTrip format
  const trips: BackendTrip[] = (data || []).map(trip => ({
    id: trip.id,
    userId: trip.user_id,
    name: trip.name,
    destination: trip.destination,
    status: trip.status as TripStatus,
    tripType: trip.trip_type || undefined,
    startDate: trip.start_date,
    endDate: trip.end_date,
    travelers: trip.travelers || undefined,
    budgetRange: trip.budget_tier as BudgetPreference | undefined,
    departureCity: trip.origin_city || undefined,
    metadata: trip.metadata as Record<string, unknown> | undefined,
    createdAt: trip.created_at,
    updatedAt: trip.updated_at,
  }));
  
  return { trips, total: count || 0 };
}

/**
 * Get single trip by ID
 */
export async function getTrip(tripId: string): Promise<BackendTrip> {
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
  
  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    destination: data.destination,
    status: data.status as TripStatus,
    tripType: data.trip_type || undefined,
    startDate: data.start_date,
    endDate: data.end_date,
    travelers: data.travelers || undefined,
    budgetRange: data.budget_tier as BudgetPreference | undefined,
    departureCity: data.origin_city || undefined,
    metadata: data.metadata as Record<string, unknown> | undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Create a new trip
 */
export async function createTrip(input: {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  tripType?: string;
  travelers?: number;
  originCity?: string;
  budgetTier?: string;
}): Promise<BackendTrip> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
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
      status: 'draft',
    })
    .select()
    .single();
  
  if (error) throw new Error(error.message);
  
  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    destination: data.destination,
    status: data.status as TripStatus,
    tripType: data.trip_type || undefined,
    startDate: data.start_date,
    endDate: data.end_date,
    travelers: data.travelers || undefined,
    budgetRange: data.budget_tier as BudgetPreference | undefined,
    departureCity: data.origin_city || undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Update a trip
 */
export async function updateTrip(tripId: string, updates: Partial<{
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  tripType: string;
  travelers: number;
  originCity: string;
  budgetTier: string;
  status: string;
}>): Promise<BackendTrip> {
  const { data: { user } } = await supabase.auth.getUser();
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
  
  if (error) throw new Error(error.message);
  
  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    destination: data.destination,
    status: data.status as TripStatus,
    tripType: data.trip_type || undefined,
    startDate: data.start_date,
    endDate: data.end_date,
    travelers: data.travelers || undefined,
    budgetRange: data.budget_tier as BudgetPreference | undefined,
    departureCity: data.origin_city || undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Delete a trip
 */
export async function deleteTrip(tripId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', tripId)
    .eq('user_id', user.id);
  
  if (error) throw new Error(error.message);
}

/**
 * Get user preferences
 */
export async function getPreferences(): Promise<UserPreferences | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', user.id)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching preferences:', error);
    return null;
  }
  
  if (!data) return null;
  
  return {
    userId: data.user_id,
    budget: (data.budget_tier || 'moderate') as BudgetPreference,
    pace: (data.travel_pace || 'balanced') as PacePreference,
    style: (data.travel_style || 'mixed') as StylePreference,
    comfort: (data.accommodation_style || 'standard') as ComfortPreference,
    planning: (data.planning_preference || 'flexible') as PlanningPreference,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Update user preferences
 */
export async function updatePreferences(prefs: Partial<UserPreferences>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  const updates: Record<string, unknown> = {};
  if (prefs.budget) updates.budget_tier = prefs.budget;
  if (prefs.pace) updates.travel_pace = prefs.pace;
  if (prefs.style) updates.travel_style = prefs.style;
  if (prefs.comfort) updates.accommodation_style = prefs.comfort;
  if (prefs.planning) updates.planning_preference = prefs.planning;
  
  const { error } = await supabase
    .from('user_preferences')
    .upsert({
      user_id: user.id,
      ...updates,
    }, { onConflict: 'user_id' });
  
  if (error) throw new Error(error.message);
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

const voyanceAPI = {
  getTrips,
  getTrip,
  createTrip,
  updateTrip,
  deleteTrip,
  getPreferences,
  updatePreferences,
};

export default voyanceAPI;
