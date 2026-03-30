/**
 * Hotel → Itinerary Patch
 * 
 * When a hotel is added/changed after generation, updates accommodation
 * activities in itinerary_data to reflect the correct hotel name & address.
 * Uses saveItineraryOptimistic for concurrent-edit safety.
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
 * Patch itinerary_data accommodation activities with the new hotel info.
 * Updates titles, addresses, and location data for check-in/checkout activities.
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
