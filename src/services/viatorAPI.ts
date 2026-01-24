/**
 * Viator Partner API Service
 * Frontend interface for Viator booking operations
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================================================
// TYPES
// ============================================================================

export interface ViatorTraveler {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  ageBand: 'ADULT' | 'CHILD' | 'INFANT' | 'YOUTH' | 'SENIOR';
  leadTraveler?: boolean;
}

export interface ViatorAvailabilitySlot {
  startTime: string;
  endTime?: string;
  available: boolean;
  pricingRecord?: {
    totalPrice: {
      amount: number;
      currency: string;
    };
  };
  productOptionCode?: string;
}

export interface ViatorAvailabilityResponse {
  success: boolean;
  productCode: string;
  travelDate: string;
  available: boolean;
  slots: ViatorAvailabilitySlot[];
  lowestPrice: { amount: number; currency: string } | null;
  currency: string;
  error?: string;
}

export interface BookingQuestion {
  id: string;
  question: string;
  required: boolean;
  type: 'STRING' | 'NUMBER' | 'DATE' | 'LOCATION_REF' | 'UNIT';
  units?: string[];
  allowedAnswers?: string[];
}

export interface PickupLocation {
  locationRef: string;
  name: string;
  address?: string;
  pickupType: 'HOTEL' | 'AIRPORT' | 'PORT' | 'MEETING_POINT' | 'OTHER';
}

export interface ViatorProductDetails {
  success: boolean;
  product: {
    productCode: string;
    title: string;
    description: string;
    duration: { fixedDurationInMinutes?: number };
    images: Array<{ variants: Array<{ url: string; width: number }> }>;
    reviewInfo: {
      rating: number;
      totalReviews: number;
    };
  };
  bookingRequirements: {
    questions: BookingQuestion[];
    travelerRequirements: {
      requiresLeadTraveler: boolean;
      requiresAllTravelerDetails: boolean;
      requiredPerTraveler: string[];
      minTravelers: number;
      maxTravelers: number;
    };
    pickupRequired: boolean;
    pickupLocations: PickupLocation[];
  };
  productOptions: Array<{
    productOptionCode: string;
    title: string;
    description: string;
  }>;
  cancellationPolicy: {
    type: string;
    description?: string;
  };
  inclusions: string[];
  exclusions: string[];
  error?: string;
}

export interface ViatorBookingRequest {
  tripId: string;
  activityId: string;
  paymentId: string;
  productCode: string;
  productOptionCode?: string;
  travelDate: string;
  startTime?: string;
  travelers: ViatorTraveler[];
  bookingQuestionAnswers?: Array<{
    questionId: string;
    answer: string;
  }>;
  pickupLocationRef?: string;
  pickupHotelName?: string;
  communication: {
    email: string;
    phone?: string;
  };
}

export interface ViatorBookingResponse {
  success: boolean;
  booking?: {
    bookingRef: string;
    viatorRef: string;
    status: string;
    voucherUrl?: string;
  };
  error?: string;
  refundRequired?: boolean;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Check availability for a Viator product on a specific date
 */
export async function checkViatorAvailability(
  productCode: string,
  travelDate: string,
  travelers: { adults: number; children?: number; infants?: number },
  currency = 'USD'
): Promise<ViatorAvailabilityResponse> {
  const { data, error } = await supabase.functions.invoke('viator-availability', {
    body: { productCode, travelDate, travelers, currency },
  });

  if (error) {
    console.error('[ViatorAPI] Availability check error:', error);
    return {
      success: false,
      productCode,
      travelDate,
      available: false,
      slots: [],
      lowestPrice: null,
      currency,
      error: error.message,
    };
  }

  return data;
}

/**
 * Get product details and booking requirements
 */
export async function getViatorProduct(productCode: string): Promise<ViatorProductDetails> {
  const { data, error } = await supabase.functions.invoke('viator-product', {
    body: { productCode },
  });

  if (error) {
    console.error('[ViatorAPI] Product fetch error:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Submit booking to Viator (after payment confirmed)
 */
export async function submitViatorBooking(request: ViatorBookingRequest): Promise<ViatorBookingResponse> {
  const { data, error } = await supabase.functions.invoke('viator-book', {
    body: request,
  });

  if (error) {
    console.error('[ViatorAPI] Booking submission error:', error);
    return {
      success: false,
      error: error.message,
      refundRequired: true,
    };
  }

  return data;
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

/**
 * Hook for checking product availability
 */
export function useViatorAvailability(
  productCode: string | null,
  travelDate: string | null,
  travelers: { adults: number; children?: number; infants?: number } | null
) {
  return useQuery({
    queryKey: ['viator', 'availability', productCode, travelDate, travelers],
    queryFn: () => {
      if (!productCode || !travelDate || !travelers) {
        throw new Error('Missing required parameters');
      }
      return checkViatorAvailability(productCode, travelDate, travelers);
    },
    enabled: !!productCode && !!travelDate && !!travelers?.adults,
    staleTime: 2 * 60 * 1000, // 2 minutes - availability can change
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Hook for fetching product details
 */
export function useViatorProduct(productCode: string | null) {
  return useQuery({
    queryKey: ['viator', 'product', productCode],
    queryFn: () => {
      if (!productCode) throw new Error('Product code required');
      return getViatorProduct(productCode);
    },
    enabled: !!productCode,
    staleTime: 30 * 60 * 1000, // 30 minutes - product details rarely change
    gcTime: 60 * 60 * 1000,
  });
}

/**
 * Hook for submitting Viator booking
 */
export function useViatorBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitViatorBooking,
    onSuccess: (data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['tripCart'] });
      queryClient.invalidateQueries({ queryKey: ['trip', variables.tripId] });
      queryClient.invalidateQueries({ queryKey: ['tripPayments', variables.tripId] });
    },
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if an activity has a Viator product code (bookable via API)
 */
export function isViatorBookable(activity: { viatorProductCode?: string; bookingUrl?: string }): boolean {
  return !!activity.viatorProductCode;
}

/**
 * Format Viator price for display
 */
export function formatViatorPrice(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Get the best available time slot
 */
export function getBestSlot(slots: ViatorAvailabilitySlot[]): ViatorAvailabilitySlot | null {
  const available = slots.filter(s => s.available);
  if (available.length === 0) return null;
  
  // Prefer morning slots, then sort by price
  return available.sort((a, b) => {
    const aTime = parseInt(a.startTime.replace(':', ''), 10);
    const bTime = parseInt(b.startTime.replace(':', ''), 10);
    
    // Prefer 8-11 AM slots
    const aIsMorning = aTime >= 800 && aTime <= 1100;
    const bIsMorning = bTime >= 800 && bTime <= 1100;
    
    if (aIsMorning && !bIsMorning) return -1;
    if (!aIsMorning && bIsMorning) return 1;
    
    return aTime - bTime;
  })[0];
}

/**
 * Parse duration from Viator format
 */
export function parseViatorDuration(duration: { fixedDurationInMinutes?: number }): string {
  const minutes = duration?.fixedDurationInMinutes || 0;
  if (minutes < 60) return `${minutes} min`;
  
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  
  if (remainingMins === 0) return `${hours}h`;
  return `${hours}h ${remainingMins}m`;
}

export default {
  checkViatorAvailability,
  getViatorProduct,
  submitViatorBooking,
};
