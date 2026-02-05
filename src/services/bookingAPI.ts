/**
 * Booking API Service
 * 
 * Handles booking confirmation and status management.
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.voyance.travel';

// ============================================================================
// TYPES
// ============================================================================

export interface BookingPaymentDetails {
  sessionId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paidAt: string;
}

export interface BookingDetails {
  createdAt: string;
  expiresAt: string | null;
  priceGuaranteed: boolean;
  modifiable: boolean;
  cancellable: boolean;
  cancellationDeadline: string;
}

export interface CustomerSupport {
  email: string;
  phone: string;
  hours: string;
}

export interface BookingConfirmation {
  confirmationNumber: string;
  tripId: string;
  tripName: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  status: string;
  paymentDetails: BookingPaymentDetails;
  bookingDetails: BookingDetails;
  nextSteps: string[];
  customerSupport: CustomerSupport;
}

export interface BookingConfirmationResponse {
  success: boolean;
  booking: BookingConfirmation;
  meta: {
    retrievedAt: string;
    provider: string;
  };
}

export interface BookingCompletionInput {
  priceLockId?: string;
  paymentMethodId?: string;
  tripData: {
    destination: string;
    dates: {
      start: string;
      end: string;
    };
    travelers: number;
  };
}

export interface BookingCompletionResponse {
  success: boolean;
  booking: {
    id: string;
    confirmationNumber: string;
    status: string;
    destination: string;
    dates: {
      start: string;
      end: string;
    };
    travelers: number;
    createdAt: string;
    priceLockCaptured: boolean;
  };
  nextSteps: string[];
}

export interface BookingStatusResponse {
  success: boolean;
  status: string;
  isBooked: boolean;
  bookingDetails: {
    confirmationNumber: string;
    bookedAt: string;
    paymentSessionId: string;
    amount?: number;
    currency?: string;
  } | null;
  actions: {
    canModify: boolean;
    canCancel: boolean;
    canRebook: boolean;
  };
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` };
  }
  // No legacy token fallback - require valid Supabase session
  return {};
}

/**
 * Confirm booking after payment
 */
export async function confirmBooking(sessionId: string): Promise<BookingConfirmationResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/booking/${sessionId}/confirm`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Confirmation failed' }));
    throw new Error(error.error || error.message || 'Failed to confirm booking');
  }

  return response.json();
}

/**
 * Complete booking with optional price lock capture
 */
export async function completeBooking(
  bookingId: string,
  input: BookingCompletionInput
): Promise<BookingCompletionResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/booking/${bookingId}/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Completion failed' }));
    throw new Error(error.error || error.message || 'Failed to complete booking');
  }

  return response.json();
}

/**
 * Get booking status for a trip
 */
export async function getBookingStatus(tripId: string): Promise<BookingStatusResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/booking/status/${tripId}`, {
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Fetch failed' }));
    throw new Error(error.error || 'Failed to fetch booking status');
  }

  return response.json();
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useConfirmBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: confirmBooking,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['booking-status', data.booking.tripId] });
      queryClient.invalidateQueries({ queryKey: ['trip', data.booking.tripId] });
    },
  });
}

export function useCompleteBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bookingId, input }: { bookingId: string; input: BookingCompletionInput }) =>
      completeBooking(bookingId, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['booking-status'] });
    },
  });
}

export function useBookingStatus(tripId: string | null) {
  return useQuery({
    queryKey: ['booking-status', tripId],
    queryFn: () => getBookingStatus(tripId!),
    enabled: !!tripId,
    staleTime: 30000,
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function formatConfirmationNumber(confirmationNumber: string): string {
  // Format as VY-XXXX-XXXX for display
  if (confirmationNumber.startsWith('VY')) {
    const code = confirmationNumber.slice(2);
    if (code.length >= 8) {
      return `VY-${code.slice(0, 4)}-${code.slice(4, 8)}`;
    }
  }
  return confirmationNumber;
}

export function isBookingModifiable(booking: BookingConfirmation): boolean {
  return booking.bookingDetails.modifiable;
}

export function isBookingCancellable(booking: BookingConfirmation): boolean {
  if (!booking.bookingDetails.cancellable) return false;
  
  const deadline = new Date(booking.bookingDetails.cancellationDeadline);
  return new Date() < deadline;
}

export function getTimeUntilCancellationDeadline(deadline: string): string {
  const deadlineDate = new Date(deadline);
  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  
  if (diffMs <= 0) return 'Expired';
  
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
  }
  return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
}
