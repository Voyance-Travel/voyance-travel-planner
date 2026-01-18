/**
 * Voyance Manual Bookings API Service
 * 
 * Manual bookings - now using Supabase trip_activities table.
 * Stores booking data as activities with booking metadata.
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================================================
// Types
// ============================================================================

export interface ManualBooking {
  id: string;
  tripId: string;
  bookingType: string;
  vendorName: string;
  confirmationCode?: string;
  startDate: string;
  endDate?: string;
  notes?: string;
  aiGenerated?: boolean;
  userModified?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateManualBookingInput {
  tripId: string;
  bookingType: string;
  vendorName: string;
  confirmationCode?: string;
  startDate: string;
  endDate?: string;
  notes?: string;
  aiGenerated?: boolean;
  userModified?: boolean;
}

export interface UpdateManualBookingInput extends Partial<Omit<CreateManualBookingInput, 'tripId'>> {
  tripId: string;
  bookingId: string;
}

export interface DeleteManualBookingInput {
  tripId: string;
  bookingId: string;
}

// ============================================================================
// Manual Bookings API - Using Supabase trip_activities
// ============================================================================

/**
 * Get all manual bookings for a trip
 */
export async function getManualBookings(tripId: string): Promise<ManualBooking[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Verify user owns this trip
  const { data: trip } = await supabase
    .from('trips')
    .select('id')
    .eq('id', tripId)
    .eq('user_id', user.id)
    .single();

  if (!trip) throw new Error('Trip not found');

  const { data: activities, error } = await supabase
    .from('trip_activities')
    .select('*')
    .eq('trip_id', tripId)
    .eq('type', 'booking')
    .order('start_time', { ascending: true });

  if (error) throw new Error(error.message);

  return (activities || []).map(activity => {
    const metadata = activity.metadata as Record<string, unknown> | null;
    return {
      id: activity.id,
      tripId: activity.trip_id || tripId,
      bookingType: (metadata?.bookingType as string) || 'other',
      vendorName: activity.title,
      confirmationCode: (metadata?.confirmationCode as string) || undefined,
      startDate: activity.start_time || '',
      endDate: activity.end_time || undefined,
      notes: activity.description || undefined,
      aiGenerated: activity.added_by_user === false,
      userModified: activity.added_by_user === true,
      createdAt: activity.created_at,
      updatedAt: activity.updated_at,
    };
  });
}

/**
 * Create a manual booking
 */
export async function createManualBooking(input: CreateManualBookingInput): Promise<ManualBooking> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('trip_activities')
    .insert({
      trip_id: input.tripId,
      title: input.vendorName,
      type: 'booking',
      description: input.notes,
      start_time: input.startDate,
      end_time: input.endDate,
      added_by_user: !input.aiGenerated,
      metadata: JSON.parse(JSON.stringify({
        bookingType: input.bookingType,
        confirmationCode: input.confirmationCode,
        userModified: input.userModified,
      })),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  const metadata = data.metadata as Record<string, unknown> | null;
  return {
    id: data.id,
    tripId: data.trip_id || input.tripId,
    bookingType: (metadata?.bookingType as string) || input.bookingType,
    vendorName: data.title,
    confirmationCode: (metadata?.confirmationCode as string) || undefined,
    startDate: data.start_time || '',
    endDate: data.end_time || undefined,
    notes: data.description || undefined,
    aiGenerated: data.added_by_user === false,
    userModified: data.added_by_user === true,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Update a manual booking
 */
export async function updateManualBooking(input: UpdateManualBookingInput): Promise<ManualBooking> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Build update object
  const updates: Record<string, unknown> = {};
  if (input.vendorName !== undefined) updates.title = input.vendorName;
  if (input.notes !== undefined) updates.description = input.notes;
  if (input.startDate !== undefined) updates.start_time = input.startDate;
  if (input.endDate !== undefined) updates.end_time = input.endDate;

  // Get current metadata and merge
  const { data: current } = await supabase
    .from('trip_activities')
    .select('metadata')
    .eq('id', input.bookingId)
    .single();

  const currentMetadata = (current?.metadata as Record<string, unknown>) || {};
  const newMetadata: Record<string, unknown> = { ...currentMetadata };

  if (input.bookingType !== undefined) newMetadata.bookingType = input.bookingType;
  if (input.confirmationCode !== undefined) newMetadata.confirmationCode = input.confirmationCode;
  if (input.userModified !== undefined) newMetadata.userModified = input.userModified;

  updates.metadata = JSON.parse(JSON.stringify(newMetadata));
  updates.added_by_user = true; // User modified

  const { data, error } = await supabase
    .from('trip_activities')
    .update(updates)
    .eq('id', input.bookingId)
    .eq('trip_id', input.tripId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  const metadata = data.metadata as Record<string, unknown> | null;
  return {
    id: data.id,
    tripId: data.trip_id || input.tripId,
    bookingType: (metadata?.bookingType as string) || 'other',
    vendorName: data.title,
    confirmationCode: (metadata?.confirmationCode as string) || undefined,
    startDate: data.start_time || '',
    endDate: data.end_time || undefined,
    notes: data.description || undefined,
    aiGenerated: data.added_by_user === false,
    userModified: data.added_by_user === true,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Delete a manual booking
 */
export async function deleteManualBooking(input: DeleteManualBookingInput): Promise<{ success: boolean }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('trip_activities')
    .delete()
    .eq('id', input.bookingId)
    .eq('trip_id', input.tripId);

  if (error) throw new Error(error.message);

  return { success: true };
}

// ============================================================================
// React Query Hooks
// ============================================================================

export function useManualBookings(tripId: string | null) {
  return useQuery({
    queryKey: ['manual-bookings', tripId],
    queryFn: () => tripId ? getManualBookings(tripId) : Promise.reject('No trip'),
    enabled: !!tripId,
    staleTime: 60_000,
  });
}

export function useCreateManualBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createManualBooking,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['manual-bookings', variables.tripId] });
    },
  });
}

export function useUpdateManualBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateManualBooking,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['manual-bookings', variables.tripId] });
    },
  });
}

export function useDeleteManualBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteManualBooking,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['manual-bookings', variables.tripId] });
    },
  });
}

// ============================================================================
// Export
// ============================================================================

const manualBookingsAPI = {
  getManualBookings,
  createManualBooking,
  updateManualBooking,
  deleteManualBooking,
};

export default manualBookingsAPI;
