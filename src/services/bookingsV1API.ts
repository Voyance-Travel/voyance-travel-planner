/**
 * Bookings V1 API Service
 * Stripe checkout session and booking management endpoints
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// TYPES
// ============================================================================

export interface CheckoutSessionParams {
  tripId: string;
  customerId?: string;
}

export interface LineItem {
  type: 'flight' | 'hotel';
  optionId: string;
  amount: number;
  currency: string;
}

export interface CheckoutSessionResponse {
  success: boolean;
  sessionId: string;
  url: string;
  expiresAt: string;
  totalAmount: number;
  currency: string;
  lineItems: LineItem[];
}

export interface BookingStatusResponse {
  success: boolean;
  tripId: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'expired';
  paymentStatus: 'unpaid' | 'paid' | 'refunded';
  confirmationCode?: string;
  confirmedAt?: string;
}

export interface ConfirmBookingParams {
  tripId: string;
  sessionId: string;
}

export interface ConfirmBookingResponse {
  success: boolean;
  tripId: string;
  status: 'confirmed';
  confirmationCode: string;
  confirmedAt: string;
}

// ============================================================================
// API HELPERS
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

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Create Stripe checkout session for trip booking
 * Requires Idempotency-Key header
 */
export async function createCheckoutSession(
  params: CheckoutSessionParams,
  idempotencyKey: string
): Promise<CheckoutSessionResponse> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/bookings/checkout-session`, {
    method: 'POST',
    headers: {
      ...headers,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(params),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    
    // Handle specific error codes
    if (error.error === 'DUPLICATE_REQUEST') {
      // Return the cached result for duplicate requests
      return error.result;
    }
    
    throw new Error(error.message || `Failed to create checkout session: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get booking status for a trip
 */
export async function getBookingStatus(tripId: string): Promise<BookingStatusResponse> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/bookings/${tripId}/status`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get booking status: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Confirm booking after successful Stripe payment
 */
export async function confirmBooking(
  params: ConfirmBookingParams
): Promise<ConfirmBookingResponse> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/bookings/${params.tripId}/confirm`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ sessionId: params.sessionId }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Failed to confirm booking: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Cancel a booking
 */
export async function cancelBooking(tripId: string): Promise<{ success: boolean }> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/bookings/${tripId}/cancel`, {
    method: 'POST',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Failed to cancel booking: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Generate a unique idempotency key for checkout
 */
export function generateIdempotencyKey(tripId: string): string {
  return `checkout_${tripId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

/**
 * Hook to create checkout session
 */
export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: ({ params, idempotencyKey }: { params: CheckoutSessionParams; idempotencyKey: string }) =>
      createCheckoutSession(params, idempotencyKey),
    onSuccess: (data) => {
      // Redirect to Stripe checkout
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create checkout session');
    },
  });
}

/**
 * Hook to get booking status
 */
export function useBookingStatus(tripId: string | undefined) {
  return useQuery({
    queryKey: ['booking-status', tripId],
    queryFn: () => getBookingStatus(tripId!),
    enabled: !!tripId,
    refetchInterval: (query) => {
      // Poll more frequently if payment is pending
      if (query.state.data?.status === 'pending') return 5000;
      return false;
    },
  });
}

/**
 * Hook to confirm booking
 */
export function useConfirmBooking() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: confirmBooking,
    onSuccess: (data) => {
      toast.success('Booking confirmed!');
      queryClient.invalidateQueries({ queryKey: ['booking-status', data.tripId] });
      queryClient.invalidateQueries({ queryKey: ['trip', data.tripId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to confirm booking');
    },
  });
}

/**
 * Hook to cancel booking
 */
export function useCancelBooking() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: cancelBooking,
    onSuccess: (_, tripId) => {
      toast.success('Booking cancelled');
      queryClient.invalidateQueries({ queryKey: ['booking-status', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to cancel booking');
    },
  });
}

export default {
  createCheckoutSession,
  getBookingStatus,
  confirmBooking,
  cancelBooking,
  generateIdempotencyKey,
};
