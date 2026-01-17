/**
 * Voyance Manual Bookings API Service
 * 
 * Integrates with Railway backend manual bookings endpoints:
 * - GET /api/v1/bookings/:tripId - Get all manual bookings
 * - POST /api/v1/bookings/:tripId/add-booking - Add a manual booking
 * - PUT /api/v1/bookings/:tripId/:bookingId - Update a manual booking
 * - DELETE /api/v1/bookings/:tripId/:bookingId - Delete a manual booking
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

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
// API Helpers
// ============================================================================

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }
  
  const token = localStorage.getItem('voyance_access_token');
  if (token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }
  
  return { 'Content-Type': 'application/json' };
}

async function bookingsApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/bookings${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
    credentials: 'include',
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData._error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// Manual Bookings API
// ============================================================================

/**
 * Get all manual bookings for a trip
 */
export async function getManualBookings(tripId: string): Promise<ManualBooking[]> {
  try {
    const response = await bookingsApiRequest<ManualBooking[]>(`/${tripId}`, {
      method: 'GET',
    });
    return response;
  } catch (error) {
    console.error('[ManualBookingsAPI] Get error:', error);
    throw error;
  }
}

/**
 * Create a manual booking
 */
export async function createManualBooking(input: CreateManualBookingInput): Promise<ManualBooking> {
  try {
    const { tripId, ...body } = input;
    const response = await bookingsApiRequest<ManualBooking>(`/${tripId}/add-booking`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return response;
  } catch (error) {
    console.error('[ManualBookingsAPI] Create error:', error);
    throw error;
  }
}

/**
 * Update a manual booking
 */
export async function updateManualBooking(input: UpdateManualBookingInput): Promise<ManualBooking> {
  try {
    const { tripId, bookingId, ...body } = input;
    const response = await bookingsApiRequest<ManualBooking>(`/${tripId}/${bookingId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    return response;
  } catch (error) {
    console.error('[ManualBookingsAPI] Update error:', error);
    throw error;
  }
}

/**
 * Delete a manual booking
 */
export async function deleteManualBooking(input: DeleteManualBookingInput): Promise<{ success: boolean }> {
  try {
    const response = await bookingsApiRequest<{ success: boolean }>(
      `/${input.tripId}/${input.bookingId}`,
      { method: 'DELETE' }
    );
    return response;
  } catch (error) {
    console.error('[ManualBookingsAPI] Delete error:', error);
    throw error;
  }
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
