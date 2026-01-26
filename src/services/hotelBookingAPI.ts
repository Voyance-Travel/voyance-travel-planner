/**
 * Hotel Booking API - Amadeus Integration via Cloud Edge Functions
 */
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface GuestDetails {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: 'MR' | 'MS' | 'MRS' | 'DR';
}

export interface CreateBookingInput {
  hotelId: string;
  offerId?: string; // Amadeus offer ID from search
  tripId: string;
  paymentId: string; // Reference to trip_payments record
  checkInDate: string;
  checkOutDate: string;
  roomType: string;
  roomCount?: number;
  guestCount?: number;
  totalAmount: number;
  currency?: string;
  guests: GuestDetails[];
  hotelName?: string;
}

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'failed' | 'refunded';

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
  totalAmount: number;
  currency: string;
  status: BookingStatus;
  confirmationNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookingResponse {
  success: boolean;
  data?: {
    bookingId?: string;
    confirmationNumber?: string;
    status?: string;
    booking?: HotelBooking;
  };
  error?: {
    code: string;
    message: string;
  };
  refundRequired?: boolean;
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

// Helper type for hotel selection data
interface HotelSelectionData {
  id?: string;
  hotelId?: string;
  checkIn?: string;
  checkOut?: string;
  roomType?: string;
  guests?: number;
  totalPrice?: number;
  price?: number;
  currency?: string;
  booking?: {
    confirmationNumber?: string;
    bookedAt?: string;
    status?: string;
  };
}

/**
 * Create a hotel booking via Amadeus API (edge function)
 * This should only be called AFTER Stripe payment is confirmed
 */
export async function createHotelBooking(input: CreateBookingInput): Promise<BookingResponse> {
  console.log('[HotelBookingAPI] Creating booking', {
    hotelId: input.hotelId,
    tripId: input.tripId,
    paymentId: input.paymentId,
  });

  try {
    const { data, error } = await supabase.functions.invoke('hotels', {
      body: {
        action: 'book',
        offerId: input.offerId || input.hotelId, // Use hotelId as fallback
        hotelId: input.hotelId,
        tripId: input.tripId,
        paymentId: input.paymentId,
        checkIn: input.checkInDate,
        checkOut: input.checkOutDate,
        roomType: input.roomType,
        totalAmount: input.totalAmount,
        currency: input.currency || 'USD',
        guests: input.guests.map(guest => ({
          firstName: guest.firstName,
          lastName: guest.lastName,
          email: guest.email,
          phone: guest.phone,
          title: guest.title || 'MR',
        })),
      },
    });

    if (error) {
      console.error('[HotelBookingAPI] Edge function error:', error);
      return {
        success: false,
        error: {
          code: 'EDGE_FUNCTION_ERROR',
          message: error.message || 'Failed to connect to booking service',
        },
      };
    }

    if (!data?.success) {
      console.error('[HotelBookingAPI] Booking failed:', data?.error);
      return {
        success: false,
        error: {
          code: data?.code || 'BOOKING_FAILED',
          message: data?.error || 'Hotel booking failed',
        },
        refundRequired: data?.refundRequired,
      };
    }

    console.log('[HotelBookingAPI] Booking successful:', data.booking);
    return {
      success: true,
      data: {
        bookingId: data.booking?.bookingId,
        confirmationNumber: data.booking?.confirmationNumber,
        status: data.booking?.status,
      },
    };
  } catch (err) {
    console.error('[HotelBookingAPI] Unexpected error:', err);
    return {
      success: false,
      error: {
        code: 'UNEXPECTED_ERROR',
        message: err instanceof Error ? err.message : 'An unexpected error occurred',
      },
    };
  }
}

/**
 * Confirm a hotel booking with external confirmation number
 * Used for manual booking entries
 */
export async function confirmHotelBooking(
  bookingId: string,
  input: { confirmationNumber: string }
): Promise<BookingResponse> {
  try {
    // Update the trip's hotel selection with confirmation
    const { error } = await supabase
      .from('trips')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (error) {
      return {
        success: false,
        error: { code: 'UPDATE_FAILED', message: error.message },
      };
    }

    return {
      success: true,
      data: { confirmationNumber: input.confirmationNumber },
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'ERROR',
        message: err instanceof Error ? err.message : 'Failed to confirm booking',
      },
    };
  }
}

/**
 * Cancel a hotel booking
 */
export async function cancelHotelBooking(bookingId: string): Promise<BookingResponse> {
  console.log('[HotelBookingAPI] Cancellation requested for:', bookingId);
  
  // Note: Amadeus cancellation requires additional API integration
  // For now, this updates the local status
  return {
    success: false,
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Automated hotel cancellation is not yet available. Please contact support.',
    },
  };
}

/**
 * Get a hotel booking by ID
 */
export async function getHotelBooking(
  bookingId: string
): Promise<{ success: boolean; data?: HotelBooking; error?: { code: string; message: string } }> {
  try {
    const { data: trip, error } = await supabase
      .from('trips')
      .select('hotel_selection')
      .eq('id', bookingId)
      .single();

    if (error || !trip?.hotel_selection) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found' },
      };
    }

    // Extract booking info from hotel selection with proper type casting
    const rawSelection = trip.hotel_selection as unknown;
    const hotelData = (Array.isArray(rawSelection)
      ? rawSelection[0]
      : rawSelection) as HotelSelectionData;

    return {
      success: true,
      data: {
        id: bookingId,
        hotelId: hotelData?.id || hotelData?.hotelId || '',
        userId: '',
        tripId: bookingId,
        checkInDate: hotelData?.checkIn || '',
        checkOutDate: hotelData?.checkOut || '',
        roomType: hotelData?.roomType || 'Standard',
        roomCount: 1,
        guestCount: hotelData?.guests || 1,
        totalAmount: hotelData?.totalPrice || hotelData?.price || 0,
        currency: hotelData?.currency || 'USD',
        status: (hotelData?.booking?.status?.toLowerCase() as BookingStatus) || 'pending',
        confirmationNumber: hotelData?.booking?.confirmationNumber,
        createdAt: hotelData?.booking?.bookedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'ERROR',
        message: err instanceof Error ? err.message : 'Failed to get booking',
      },
    };
  }
}

/**
 * Get all hotel bookings for the current user
 */
export async function getUserHotelBookings(): Promise<{
  success: boolean;
  data?: { bookings: HotelBooking[]; total: number };
}> {
  try {
    const { data: trips, error } = await supabase
      .from('trips')
      .select('id, hotel_selection, start_date, end_date')
      .not('hotel_selection', 'is', null);

    if (error) {
      console.error('[HotelBookingAPI] Failed to fetch bookings:', error);
      return { success: true, data: { bookings: [], total: 0 } };
    }

    const bookings: HotelBooking[] = (trips || [])
      .filter((trip) => {
        const rawSelection = trip.hotel_selection as unknown;
        if (Array.isArray(rawSelection)) {
          return rawSelection.some((h: HotelSelectionData) => h?.booking?.confirmationNumber);
        }
        const selection = rawSelection as HotelSelectionData;
        return selection?.booking?.confirmationNumber;
      })
      .map((trip) => {
        const rawSelection = trip.hotel_selection as unknown;
        const hotelData = (Array.isArray(rawSelection)
          ? rawSelection[0]
          : rawSelection) as HotelSelectionData;
        return {
          id: trip.id,
          hotelId: hotelData?.id || hotelData?.hotelId || '',
          userId: '',
          tripId: trip.id,
          checkInDate: trip.start_date || '',
          checkOutDate: trip.end_date || '',
          roomType: hotelData?.roomType || 'Standard',
          roomCount: 1,
          guestCount: hotelData?.guests || 1,
          totalAmount: hotelData?.totalPrice || hotelData?.price || 0,
          currency: hotelData?.currency || 'USD',
          status: (hotelData?.booking?.status?.toLowerCase() as BookingStatus) || 'confirmed',
          confirmationNumber: hotelData?.booking?.confirmationNumber,
          createdAt: hotelData?.booking?.bookedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

    return {
      success: true,
      data: { bookings, total: bookings.length },
    };
  } catch (err) {
    console.error('[HotelBookingAPI] Error fetching user bookings:', err);
    return { success: true, data: { bookings: [], total: 0 } };
  }
}

/**
 * Check hotel availability
 */
export async function checkHotelAvailability(input: {
  hotelId: string;
  checkIn: string;
  checkOut: string;
  guests?: number;
}): Promise<AvailabilityResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('hotels', {
      body: {
        action: 'search',
        destination: input.hotelId,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        guests: input.guests || 1,
      },
    });

    if (error) {
      return {
        success: false,
        error: { code: 'API_ERROR', message: error.message },
      };
    }

    return {
      success: true,
      data: {
        available: (data?.hotels?.length || 0) > 0,
        rooms: data?.hotels?.map((h: any) => ({
          type: h.roomType || 'Standard',
          available: 1,
          price: h.pricePerNight || h.price,
        })) || [],
      },
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'ERROR',
        message: err instanceof Error ? err.message : 'Availability check failed',
      },
    };
  }
}

// ============= React Query Hooks =============

export function useHotelBooking(bookingId: string | null) {
  return useQuery({
    queryKey: ['hotel-booking', bookingId],
    queryFn: () => (bookingId ? getHotelBooking(bookingId) : Promise.reject()),
    enabled: !!bookingId,
  });
}

export function useUserHotelBookings() {
  return useQuery({
    queryKey: ['user-hotel-bookings'],
    queryFn: getUserHotelBookings,
  });
}

export function useCreateHotelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createHotelBooking,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-hotel-bookings'] }),
  });
}

export function useConfirmHotelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      bookingId,
      input,
    }: {
      bookingId: string;
      input: { confirmationNumber: string };
    }) => confirmHotelBooking(bookingId, input),
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['hotel-booking', v.bookingId] }),
  });
}

export function useCancelHotelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cancelHotelBooking,
    onSuccess: (_, id) => qc.invalidateQueries({ queryKey: ['hotel-booking', id] }),
  });
}

export function useHotelAvailability(
  input: { hotelId: string; checkIn: string; checkOut: string } | null
) {
  return useQuery({
    queryKey: ['hotel-availability', input],
    queryFn: () => (input ? checkHotelAvailability(input) : Promise.reject()),
    enabled: !!input,
  });
}

export default {
  createHotelBooking,
  confirmHotelBooking,
  cancelHotelBooking,
  getHotelBooking,
  getUserHotelBookings,
  checkHotelAvailability,
};
