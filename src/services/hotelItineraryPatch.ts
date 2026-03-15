/**
 * Hotel → Itinerary Patch
 * 
 * When a hotel is added/changed after generation, updates accommodation
 * activities in itinerary_data to reflect the correct hotel name & address.
 */

import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

const ACCOMMODATION_KEYWORDS = [
  'hotel check-in', 'hotel check in', 'check-in & refresh',
  'check in & refresh', 'hotel checkout', 'hotel check-out',
  'check into', 'accommodation', 'settle in',
];

function isAccommodationActivity(title: string): boolean {
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
        if (!isAccommodationActivity(title)) continue;

        // Update the activity with real hotel info
        const isCheckout = title.toLowerCase().includes('checkout') || title.toLowerCase().includes('check-out');
        
        if (isCheckout) {
          act.title = `Checkout from ${hotel.name}`;
          act.name = act.title;
        } else {
          act.title = `Check-in at ${hotel.name}`;
          act.name = act.title;
        }

        if (hotel.address) {
          act.location = { name: hotel.name, address: hotel.address };
          act.address = hotel.address;
        }

        patched = true;
      }
    }

    if (!patched) return false;

    const { error: updateError } = await supabase
      .from('trips')
      .update({
        itinerary_data: { ...itineraryData, days } as Json,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId);

    if (updateError) {
      console.error('[HotelPatch] Failed to update itinerary:', updateError);
      return false;
    }

    console.log('[HotelPatch] Patched accommodation activities with hotel:', hotel.name);
    return true;
  } catch (err) {
    console.error('[HotelPatch] Error:', err);
    return false;
  }
}
