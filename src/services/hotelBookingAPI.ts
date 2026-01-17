/**
 * Voyance Hotel Booking API Service
 * 
 * Integrates with Railway backend hotel booking endpoints:
 * - POST /api/v1/hotels/bookings - Create a new booking
 * - POST /api/v1/hotels/bookings/:bookingId/confirm - Confirm booking
 * - POST /api/v1/hotels/bookings/:bookingId/cancel - Cancel booking
 * - GET /api/v1/hotels/bookings/:bookingId - Get booking details
 * - GET /api/v1/hotels/bookings - Get user's bookings
 * - POST /api/v1/hotels/availability - Check availability
 * - POST /api/v1/hotels/bookings/:bookingId/payment - Create payment intent
 * - POST /api/v1/hotels/bookings/:bookingId/payment/process - Process payment
 * - POST /api/v1/hotels/bookings/:bookingId/payment/refund - Refund payment
 */

import { supabase } from '@/integrations/supabase/client';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface GuestDetails {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

export interface CreateBookingInput {
  hotelId: string;
  tripId?: string;
  bookingSessionId?: string;
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  roomType: string;
  roomCount?: number;
  guestCount?: number;
  guestDetails?: GuestDetails[];
  specialRequests?: string;
  totalAmount: number;
  currency?: string;
  paymentMethod?: string;
}

export interface ConfirmBookingInput {
  confirmationNumber: string;
  paymentIntentId?: string;
  bookingReference?: string;
}

export interface CancelBookingInput {
  reason?: string;
}

export interface CheckAvailabilityInput {
  hotelId: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  guests?: number;
}

export interface ProcessPaymentInput {
  bookingId: string;
  paymentMethodId: string;
  savePaymentMethod?: boolean;
}

export interface RefundPaymentInput {
  bookingId: string;
  amount?: number;
  reason?: string;
}

export type BookingStatus = 
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'failed'
  | 'refunded';

export interface HotelBooking {
  id: string;
  hotelId: string;
  userId: string;
  tripId?: string;
  checkInDate: string;
  checkOutDate: string;
  roomType: string;
  roomCount: number;
  guestCount: number;
  guestDetails?: GuestDetails[];
  specialRequests?: string;
  totalAmount: number;
  currency: string;
  status: BookingStatus;
  confirmationNumber?: string;
  bookingReference?: string;
  paymentIntentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookingResponse {
  success: boolean;
  data?: {
    bookingId?: string;
    booking?: HotelBooking;
    message?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface AvailabilityResponse {
  success: boolean;
  data?: {
    available: boolean;
    rooms?: Array<{
      type: string;
      available: number;
      price: number;
    }>;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface PaymentIntentResponse {
  success: boolean;
  data?: {
    clientSecret: string;
    paymentIntentId: string;
    amount: number;
    currency: string;
  };
  error?: {
    code: string;
    message: string;
  };
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

// ============================================================================
// API Functions
// ============================================================================

/**
 * Create a new hotel booking
 */
export async function createHotelBooking(
  input: CreateBookingInput
): Promise<BookingResponse> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/hotels/bookings`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...input,
      roomCount: input.roomCount ?? 1,
      guestCount: input.guestCount ?? 2,
      currency: input.currency ?? 'USD',
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      error: {
        code: errorData.error?.code || 'BOOKING_ERROR',
        message: errorData.error?.message || `HTTP ${response.status}`,
      },
    };
  }
  
  return response.json();
}

/**
 * Confirm a hotel booking
 */
export async function confirmHotelBooking(
  bookingId: string,
  input: ConfirmBookingInput
): Promise<BookingResponse> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/hotels/bookings/${bookingId}/confirm`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      error: {
        code: errorData.error?.code || 'CONFIRM_ERROR',
        message: errorData.error?.message || `HTTP ${response.status}`,
      },
    };
  }
  
  return response.json();
}

/**
 * Cancel a hotel booking
 */
export async function cancelHotelBooking(
  bookingId: string,
  input?: CancelBookingInput
): Promise<BookingResponse> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/hotels/bookings/${bookingId}/cancel`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input || {}),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      error: {
        code: errorData.error?.code || 'CANCEL_ERROR',
        message: errorData.error?.message || `HTTP ${response.status}`,
      },
    };
  }
  
  return response.json();
}

/**
 * Get a specific booking
 */
export async function getHotelBooking(bookingId: string): Promise<{
  success: boolean;
  data?: HotelBooking;
  error?: { code: string; message: string };
}> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/hotels/bookings/${bookingId}`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      error: {
        code: errorData.error?.code || 'FETCH_ERROR',
        message: errorData.error?.message || `HTTP ${response.status}`,
      },
    };
  }
  
  return response.json();
}

/**
 * Get user's hotel bookings
 */
export async function getUserHotelBookings(params?: {
  status?: BookingStatus;
  limit?: number;
  offset?: number;
}): Promise<{
  success: boolean;
  data?: {
    bookings: HotelBooking[];
    total: number;
  };
  error?: { code: string; message: string };
}> {
  const headers = await getAuthHeader();
  
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.set('status', params.status);
  if (params?.limit) queryParams.set('limit', String(params.limit));
  if (params?.offset) queryParams.set('offset', String(params.offset));
  
  const url = `${BACKEND_URL}/api/v1/hotels/bookings${queryParams.toString() ? `?${queryParams}` : ''}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      error: {
        code: errorData.error?.code || 'FETCH_ERROR',
        message: errorData.error?.message || `HTTP ${response.status}`,
      },
    };
  }
  
  return response.json();
}

/**
 * Check hotel availability
 */
export async function checkHotelAvailability(
  input: CheckAvailabilityInput
): Promise<AvailabilityResponse> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/hotels/availability`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...input,
      guests: input.guests ?? 2,
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      error: {
        code: errorData.error?.code || 'AVAILABILITY_ERROR',
        message: errorData.error?.message || `HTTP ${response.status}`,
      },
    };
  }
  
  return response.json();
}

/**
 * Create payment intent for a booking
 */
export async function createBookingPaymentIntent(
  bookingId: string
): Promise<PaymentIntentResponse> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/hotels/bookings/${bookingId}/payment`, {
    method: 'POST',
    headers,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      error: {
        code: errorData.error?.code || 'PAYMENT_ERROR',
        message: errorData.error?.message || `HTTP ${response.status}`,
      },
    };
  }
  
  return response.json();
}

/**
 * Process payment for a booking
 */
export async function processBookingPayment(
  input: ProcessPaymentInput
): Promise<BookingResponse> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/hotels/bookings/${input.bookingId}/payment/process`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      paymentMethodId: input.paymentMethodId,
      savePaymentMethod: input.savePaymentMethod,
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      error: {
        code: errorData.error?.code || 'PAYMENT_ERROR',
        message: errorData.error?.message || `HTTP ${response.status}`,
      },
    };
  }
  
  return response.json();
}

/**
 * Refund payment for a booking
 */
export async function refundBookingPayment(
  input: RefundPaymentInput
): Promise<BookingResponse> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/hotels/bookings/${input.bookingId}/payment/refund`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      amount: input.amount,
      reason: input.reason,
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      error: {
        code: errorData.error?.code || 'REFUND_ERROR',
        message: errorData.error?.message || `HTTP ${response.status}`,
      },
    };
  }
  
  return response.json();
}

// ============================================================================
// React Query Hooks
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useHotelBooking(bookingId: string | null) {
  return useQuery({
    queryKey: ['hotel-booking', bookingId],
    queryFn: () => bookingId ? getHotelBooking(bookingId) : Promise.reject('No booking ID'),
    enabled: !!bookingId,
    staleTime: 60_000,
  });
}

export function useUserHotelBookings(params?: {
  status?: BookingStatus;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['user-hotel-bookings', params],
    queryFn: () => getUserHotelBookings(params),
    staleTime: 60_000,
  });
}

export function useCreateHotelBooking() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createHotelBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-hotel-bookings'] });
    },
  });
}

export function useConfirmHotelBooking() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ bookingId, input }: { bookingId: string; input: ConfirmBookingInput }) =>
      confirmHotelBooking(bookingId, input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hotel-booking', variables.bookingId] });
      queryClient.invalidateQueries({ queryKey: ['user-hotel-bookings'] });
    },
  });
}

export function useCancelHotelBooking() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ bookingId, input }: { bookingId: string; input?: CancelBookingInput }) =>
      cancelHotelBooking(bookingId, input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hotel-booking', variables.bookingId] });
      queryClient.invalidateQueries({ queryKey: ['user-hotel-bookings'] });
    },
  });
}

export function useCheckHotelAvailability() {
  return useMutation({
    mutationFn: checkHotelAvailability,
  });
}

export function useCreateBookingPaymentIntent() {
  return useMutation({
    mutationFn: createBookingPaymentIntent,
  });
}

export function useProcessBookingPayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: processBookingPayment,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hotel-booking', variables.bookingId] });
      queryClient.invalidateQueries({ queryKey: ['user-hotel-bookings'] });
    },
  });
}

export function useRefundBookingPayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: refundBookingPayment,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hotel-booking', variables.bookingId] });
      queryClient.invalidateQueries({ queryKey: ['user-hotel-bookings'] });
    },
  });
}

// ============================================================================
// Export
// ============================================================================

const hotelBookingAPI = {
  createHotelBooking,
  confirmHotelBooking,
  cancelHotelBooking,
  getHotelBooking,
  getUserHotelBookings,
  checkHotelAvailability,
  createBookingPaymentIntent,
  processBookingPayment,
  refundBookingPayment,
};

export default hotelBookingAPI;
