/**
 * Hotel → Itinerary Patch
 * 
 * When a hotel is added/changed after generation, updates accommodation
 * activities in itinerary_data to reflect the correct hotel name & address.
 * Uses saveItineraryOptimistic for concurrent-edit safety.
 * 
 * Date-aware: when checkInDate/checkOutDate are provided, only patches
 * activities on days within that range (multi-hotel support).
 */

import { supabase } from '@/integrations/supabase/client';
import { saveItineraryOptimistic, fetchAndCacheVersion } from '@/services/itineraryOptimisticUpdate';

const ACCOMMODATION_KEYWORDS = [
  'check-in', 'check in', 'check into',
  'checkout', 'check-out', 'check out',
  'accommodation', 'settle in', 'settle into',
  'your hotel', 'freshen up',
  'return to your hotel', 'return to hotel',
];

const ACCOMMODATION_CATEGORIES = ['accommodation', 'hotel'];

function isAccommodationActivity(title: string, category?: string): boolean {
  if (category && ACCOMMODATION_CATEGORIES.includes(category.toLowerCase())) return true;
  const lower = title.toLowerCase();
  return ACCOMMODATION_KEYWORDS.some(k => lower.includes(k));
}

/**
 * Check if a day's date falls within a hotel's stay range.
 * checkInDate <= dayDate <= checkOutDate (inclusive on both ends,
 * since checkout day still has checkout activities).
 */
function isDayInRange(dayDate: string | undefined, checkInDate?: string, checkOutDate?: string): boolean {
  if (!checkInDate || !checkOutDate || !dayDate) return true; // No dates = patch all days
  const d = dayDate.slice(0, 10);
  return d >= checkInDate.slice(0, 10) && d <= checkOutDate.slice(0, 10);
}

/**
 * Patch itinerary_data accommodation activities with the new hotel info.
 * Updates titles, addresses, and location data for check-in/checkout activities.
 * 
 * When checkInDate/checkOutDate are provided, only days within that range are patched.
 */
export async function patchItineraryWithHotel(
  tripId: string,
  hotel: {
    name: string;
    address?: string;
    checkInDate?: string;
    checkOutDate?: string;
  },
): Promise<boolean> {
  try {
    const { data: trip, error: fetchError } = await supabase
      .from('trips')
      .select('itinerary_data')
      .eq('id', tripId)
      .maybeSingle();

    if (fetchError || !trip?.itinerary_data) return false;

    const itineraryData = trip.itinerary_data as Record<string, unknown>;
    const days = itineraryData.days as Array<Record<string, unknown>> | undefined;
    if (!days?.length) return false;

    let patched = false;

    for (const day of days) {
      // Date-aware scoping: skip days outside the hotel's stay range
      const dayDate = day.date as string | undefined;
      if (!isDayInRange(dayDate, hotel.checkInDate, hotel.checkOutDate)) continue;

      const activities = day.activities as Array<Record<string, unknown>> | undefined;
      if (!activities?.length) continue;

      for (const act of activities) {
        const title = String(act.title || act.name || '');
        if (!isAccommodationActivity(title, String(act.category || ''))) continue;

        const lower = title.toLowerCase();
        const isCheckout = lower.includes('checkout') || lower.includes('check-out') || lower.includes('check out');
        const isFreshenUp = lower.includes('freshen up');
        const isReturn = lower.includes('return to') || lower.includes('back to');
        const isSettleIn = lower.includes('settle in') || lower.includes('settle into');
        
        // Preserve the activity's intent — only replace the hotel name portion
        if (isCheckout) {
          act.title = `Checkout from ${hotel.name}`;
        } else if (isFreshenUp) {
          act.title = `Freshen up at ${hotel.name}`;
        } else if (isReturn) {
          act.title = `Return to ${hotel.name}`;
        } else if (isSettleIn) {
          act.title = `Settle in at ${hotel.name}`;
        } else {
          act.title = `Check-in at ${hotel.name}`;
        }
        act.name = act.title;

        if (hotel.address) {
          act.location = { name: hotel.name, address: hotel.address };
          act.address = hotel.address;
        }

        patched = true;
      }
    }

    if (!patched) return false;

    // Use optimistic update for version safety
    await fetchAndCacheVersion(tripId);
    const result = await saveItineraryOptimistic(tripId, { ...itineraryData, days });

    if (!result.success) {
      console.error('[HotelPatch] Optimistic update failed:', result.error);
      return false;
    }

    console.log('[HotelPatch] Patched accommodation activities with hotel:', hotel.name);
    return true;
  } catch (err) {
    console.error('[HotelPatch] Error:', err);
    return false;
  }
}

/**
 * Patch itinerary with multiple hotels, each scoped to its own date range.
 * For multi-hotel trips — ensures Hotel A's cards aren't overwritten by Hotel B.
 */
export async function patchItineraryWithMultipleHotels(
  tripId: string,
  hotels: Array<{
    name: string;
    address?: string;
    checkInDate?: string;
    checkOutDate?: string;
  }>,
): Promise<boolean> {
  if (!hotels.length) return false;

  try {
    const { data: trip, error: fetchError } = await supabase
      .from('trips')
      .select('itinerary_data')
      .eq('id', tripId)
      .maybeSingle();

    if (fetchError || !trip?.itinerary_data) return false;

    const itineraryData = trip.itinerary_data as Record<string, unknown>;
    const days = itineraryData.days as Array<Record<string, unknown>> | undefined;
    if (!days?.length) return false;

    let patched = false;

    for (const day of days) {
      const dayDate = day.date as string | undefined;
      const activities = day.activities as Array<Record<string, unknown>> | undefined;
      if (!activities?.length) continue;

      // Find which hotel covers this day
      const matchingHotel = hotels.find(h => isDayInRange(dayDate, h.checkInDate, h.checkOutDate));
      if (!matchingHotel) continue;

      for (const act of activities) {
        const title = String(act.title || act.name || '');
        if (!isAccommodationActivity(title, String(act.category || ''))) continue;

        const lower = title.toLowerCase();
        const isCheckout = lower.includes('checkout') || lower.includes('check-out') || lower.includes('check out');
        const isFreshenUp = lower.includes('freshen up');
        const isReturn = lower.includes('return to') || lower.includes('back to');
        const isSettleIn = lower.includes('settle in') || lower.includes('settle into');

        if (isCheckout) {
          act.title = `Checkout from ${matchingHotel.name}`;
        } else if (isFreshenUp) {
          act.title = `Freshen up at ${matchingHotel.name}`;
        } else if (isReturn) {
          act.title = `Return to ${matchingHotel.name}`;
        } else if (isSettleIn) {
          act.title = `Settle in at ${matchingHotel.name}`;
        } else {
          act.title = `Check-in at ${matchingHotel.name}`;
        }
        act.name = act.title;

        if (matchingHotel.address) {
          act.location = { name: matchingHotel.name, address: matchingHotel.address };
          act.address = matchingHotel.address;
        }

        patched = true;
      }
    }

    if (!patched) return false;

    await fetchAndCacheVersion(tripId);
    const result = await saveItineraryOptimistic(tripId, { ...itineraryData, days });

    if (!result.success) {
      console.error('[HotelPatch] Multi-hotel optimistic update failed:', result.error);
      return false;
    }

    console.log('[HotelPatch] Patched accommodation activities for', hotels.length, 'hotels');
    return true;
  } catch (err) {
    console.error('[HotelPatch] Multi-hotel error:', err);
    return false;
  }
}
