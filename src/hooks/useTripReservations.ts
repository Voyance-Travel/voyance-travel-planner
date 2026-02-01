/**
 * useTripReservations
 * Fetches confirmed bookings and reservations for a trip
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ReservationData, ReservationType } from '@/components/trips/ReservationCard';

// Map activity categories to reservation types
function mapCategoryToType(category?: string | null, type?: string | null): ReservationType {
  const lowerCategory = (category || type || '').toLowerCase();
  
  if (lowerCategory.includes('flight') || lowerCategory.includes('air')) return 'flight';
  if (lowerCategory.includes('hotel') || lowerCategory.includes('accommodation') || lowerCategory.includes('stay')) return 'hotel';
  if (lowerCategory.includes('restaurant') || lowerCategory.includes('dining') || lowerCategory.includes('food')) return 'restaurant';
  if (lowerCategory.includes('transport') || lowerCategory.includes('transfer') || lowerCategory.includes('car')) return 'transport';
  
  return 'activity';
}

// Map booking state to reservation status
function mapStatus(state?: string | null): 'confirmed' | 'pending' | 'cancelled' {
  if (state === 'booked_confirmed') return 'confirmed';
  if (state === 'cancelled' || state === 'refunded') return 'cancelled';
  return 'pending';
}

async function fetchTripReservations(tripId: string): Promise<ReservationData[]> {
  // Fetch confirmed activities (bookable items with confirmation)
  const { data: activities, error } = await supabase
    .from('trip_activities')
    .select('*')
    .eq('trip_id', tripId)
    .in('booking_state', ['booked_confirmed', 'selected_pending'])
    .order('start_time', { ascending: true });

  if (error) throw error;

  // Transform to reservation format
  const reservations: ReservationData[] = (activities || []).map(activity => {
    const metadata = activity.metadata as Record<string, unknown> | null;
    const voucherData = activity.voucher_data as Record<string, unknown> | null;
    const activityType = (metadata?.category as string) || activity.type;
    
    return {
      id: activity.id,
      type: mapCategoryToType(activityType, activity.type),
      title: activity.title || 'Reservation',
      date: activity.start_time?.split('T')[0] || '',
      time: activity.start_time?.includes('T') 
        ? new Date(activity.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        : undefined,
      endDate: activity.end_time?.split('T')[0],
      endTime: activity.end_time?.includes('T')
        ? new Date(activity.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        : undefined,
      confirmationNumber: activity.confirmation_number || (metadata?.confirmationCode as string),
      voucherUrl: activity.voucher_url || (voucherData?.voucherUrl as string),
      qrCode: voucherData?.qrCode as string | undefined,
      status: mapStatus(activity.booking_state),
      vendorName: activity.vendor_name || (metadata?.vendorName as string),
      location: typeof activity.location === 'object' && activity.location 
        ? (activity.location as { name?: string })?.name 
        : (activity.location as string),
      address: typeof activity.location === 'object' && activity.location
        ? (activity.location as { address?: string })?.address
        : undefined,
      notes: activity.description,
      // Type-specific fields from metadata
      flightNumber: metadata?.flightNumber as string | undefined,
      departureAirport: metadata?.departureAirport as string | undefined,
      arrivalAirport: metadata?.arrivalAirport as string | undefined,
      roomType: metadata?.roomType as string | undefined,
      checkInTime: metadata?.checkInTime as string | undefined,
      checkOutTime: metadata?.checkOutTime as string | undefined,
      partySize: metadata?.partySize as number | undefined,
    };
  });

  return reservations;
}

export function useTripReservations(tripId: string | null) {
  return useQuery({
    queryKey: ['trip-reservations', tripId],
    queryFn: () => tripId ? fetchTripReservations(tripId) : [],
    enabled: !!tripId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Fetch saved/wishlist items for a trip - simplified query to avoid type issues
async function fetchSavedItems(tripId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('trip_activities')
    .select('*')
    .eq('trip_id', tripId)
    .eq('booking_state', 'not_selected')
    .eq('is_saved', true)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(item => {
    const metadata = item.metadata as Record<string, unknown> | null;
    return {
      id: item.id,
      name: item.title || 'Saved item',
      category: (metadata?.category as string) || item.type,
      location: typeof item.location === 'object' && item.location
        ? (item.location as { name?: string })?.name
        : undefined,
    };
  });
}

export function useSavedItems(tripId: string | null) {
  return useQuery({
    queryKey: ['trip-saved-items', tripId],
    queryFn: () => tripId ? fetchSavedItems(tripId) : [],
    enabled: !!tripId,
    staleTime: 1000 * 60 * 5,
  });
}

export default useTripReservations;
