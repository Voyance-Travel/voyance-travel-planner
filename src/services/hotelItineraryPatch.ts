/**
 * Hotel → Itinerary Patch
 * 
 * When a hotel is added/changed after generation, updates accommodation
 * activities in itinerary_data to reflect the correct hotel name & address.
 * Uses saveItineraryOptimistic for concurrent-edit safety.
 * 
 * Date-aware: when checkInDate/checkOutDate are provided, only patches
 * activities on days within that range (multi-hotel support).
 * 
 * Boundary convention: checkInDate <= day < checkOutDate (exclusive checkout).
 * This matches the generation pipeline. On checkout day, only "checkout"
 * activities are patched with the departing hotel's name.
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

function isCheckoutActivity(title: string): boolean {
  const lower = title.toLowerCase();
  return lower.includes('checkout') || lower.includes('check-out') || lower.includes('check out');
}

/**
 * Check if a day's date falls within a hotel's stay range.
 * Uses exclusive upper bound: checkInDate <= dayDate < checkOutDate
 * This matches the generation pipeline convention where checkout day
 * belongs to the NEXT hotel.
 */
function isDayInRange(dayDate: string | undefined, checkInDate?: string, checkOutDate?: string): boolean {
  if (!checkInDate || !checkOutDate || !dayDate) return true; // No dates = patch all days
  const d = dayDate.slice(0, 10);
  return d >= checkInDate.slice(0, 10) && d < checkOutDate.slice(0, 10);
}

/**
 * Check if a day is the checkout day for a hotel.
 */
function isCheckoutDay(dayDate: string | undefined, checkOutDate?: string): boolean {
  if (!dayDate || !checkOutDate) return false;
  return dayDate.slice(0, 10) === checkOutDate.slice(0, 10);
}

/**
 * Apply hotel info to an accommodation activity, setting title, name, location.
 */
function applyHotelToActivity(act: Record<string, unknown>, hotel: { name: string; address?: string }) {
  const title = String(act.title || act.name || '');
  const lower = title.toLowerCase();
  const isCheckout = isCheckoutActivity(title);
  const isFreshenUp = lower.includes('freshen up');
  const isReturn = lower.includes('return to') || lower.includes('back to');
  const isLuggage = lower.includes('luggage drop') || lower.includes('drop bags');

  if (isCheckout) {
    act.title = `Checkout from ${hotel.name}`;
  } else if (isFreshenUp) {
    act.title = `Freshen Up at ${hotel.name}`;
  } else if (isReturn) {
    act.title = `Return to ${hotel.name}`;
  } else if (isLuggage) {
    act.title = `Luggage Drop at ${hotel.name}`;
  } else {
    act.title = `Check-in at ${hotel.name}`;
  }
  act.name = act.title;

  if (hotel.address) {
    act.location = { name: hotel.name, address: hotel.address };
    act.address = hotel.address;
  }
}

/**
 * Patch itinerary_data accommodation activities with the new hotel info.
 * 
 * When checkInDate/checkOutDate are provided, only days within that range are patched
 * (exclusive upper bound). Checkout-day activities are handled specially.
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
      const dayDate = day.date as string | undefined;
      const activities = day.activities as Array<Record<string, unknown>> | undefined;
      if (!activities?.length) continue;

      const inRange = isDayInRange(dayDate, hotel.checkInDate, hotel.checkOutDate);
      const onCheckoutDay = isCheckoutDay(dayDate, hotel.checkOutDate);

      for (const act of activities) {
        const title = String(act.title || act.name || '');
        if (!isAccommodationActivity(title, String(act.category || ''))) continue;

        if (inRange) {
          // Normal stay day — patch all accommodation activities
          applyHotelToActivity(act, hotel);
          patched = true;
        } else if (onCheckoutDay && isCheckoutActivity(title)) {
          // Checkout day — only patch checkout activities with departing hotel
          applyHotelToActivity(act, hotel);
          patched = true;
        }
      }
    }

    if (!patched) return false;

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
 * 
 * Uses exclusive upper bound (checkIn <= day < checkOut) matching the generation pipeline.
 * Checkout activities on a boundary day are attributed to the departing hotel.
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

      // Find which hotel covers this day (exclusive upper bound)
      // Prefer hotel whose checkInDate matches exactly (for boundary days)
      const matchingHotel = hotels.find(h => isDayInRange(dayDate, h.checkInDate, h.checkOutDate));
      
      // Find hotel that is checking out on this day (for checkout activities)
      const departingHotel = hotels.find(h => isCheckoutDay(dayDate, h.checkOutDate));

      if (!matchingHotel && !departingHotel) continue;

      for (const act of activities) {
        const title = String(act.title || act.name || '');
        if (!isAccommodationActivity(title, String(act.category || ''))) continue;

        if (isCheckoutActivity(title) && departingHotel) {
          // Checkout activities → departing hotel
          applyHotelToActivity(act, departingHotel);
          patched = true;
        } else if (matchingHotel && !isCheckoutActivity(title)) {
          // All other accommodation activities → staying hotel
          applyHotelToActivity(act, matchingHotel);
          patched = true;
        }
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
