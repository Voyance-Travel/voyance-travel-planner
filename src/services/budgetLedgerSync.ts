/**
 * Budget Ledger Sync
 * 
 * Syncs flight and hotel prices to the trip_budget_ledger as committed entries.
 * When a user saves/updates their flight or hotel, this upserts the corresponding
 * ledger entry so the budget summary reflects logistics costs.
 */

import { supabase } from '@/integrations/supabase/client';
import type { FlightSelection, HotelSelection } from '@/types/trip';

const FLIGHT_LEDGER_KEY = 'logistics-flight';
const HOTEL_LEDGER_KEY = 'logistics-hotel';

/**
 * Upsert a committed ledger entry for a logistics category.
 * Uses external_booking_id as a stable key to avoid duplicates.
 */
async function upsertLogisticsEntry(
  tripId: string,
  category: 'flight' | 'hotel',
  amountCents: number,
  description: string,
  externalKey: string,
) {
  if (amountCents <= 0) return;

  // Check if entry already exists
  const { data: existing } = await supabase
    .from('trip_budget_ledger')
    .select('id')
    .eq('trip_id', tripId)
    .eq('category', category)
    .eq('external_booking_id', externalKey)
    .maybeSingle();

  if (existing) {
    // Update amount if changed
    await supabase
      .from('trip_budget_ledger')
      .update({
        amount_cents: amountCents,
        description,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('trip_budget_ledger')
      .insert({
        trip_id: tripId,
        category,
        entry_type: 'committed',
        amount_cents: amountCents,
        currency: 'USD',
        description,
        confidence: 'high',
        external_booking_id: externalKey,
      });
  }
}

/**
 * Sync flight selection price to budget ledger.
 * Captures outbound + return flight total.
 */
export async function syncFlightToLedger(
  tripId: string,
  flight: FlightSelection | null,
) {
  if (!flight?.price || flight.price <= 0) {
    // Remove existing flight entry if price cleared
    await supabase
      .from('trip_budget_ledger')
      .delete()
      .eq('trip_id', tripId)
      .eq('category', 'flight')
      .eq('external_booking_id', FLIGHT_LEDGER_KEY);
    return;
  }

  const totalCents = Math.round(flight.price * 100);
  const parts = [flight.airline, flight.flightNumber].filter(Boolean).join(' ');
  const description = parts ? `Flight: ${parts}` : 'Flight';

  await upsertLogisticsEntry(tripId, 'flight', totalCents, description, FLIGHT_LEDGER_KEY);
}

/**
 * Sync hotel selection price to budget ledger.
 * Uses totalPrice if available, otherwise pricePerNight × nights.
 */
export async function syncHotelToLedger(
  tripId: string,
  hotel: HotelSelection | null,
) {
  if (!hotel) {
    await supabase
      .from('trip_budget_ledger')
      .delete()
      .eq('trip_id', tripId)
      .eq('category', 'hotel')
      .eq('external_booking_id', HOTEL_LEDGER_KEY);
    return;
  }

  let totalUsd = hotel.totalPrice || 0;

  // Fallback: calculate from per-night if total isn't set
  if (!totalUsd && hotel.pricePerNight && hotel.checkIn && hotel.checkOut) {
    const nights = Math.max(
      1,
      Math.ceil(
        (new Date(hotel.checkOut).getTime() - new Date(hotel.checkIn).getTime()) /
        (1000 * 60 * 60 * 24),
      ),
    );
    totalUsd = hotel.pricePerNight * nights;
  }

  if (!totalUsd || totalUsd <= 0) {
    // No price data — remove any existing entry
    await supabase
      .from('trip_budget_ledger')
      .delete()
      .eq('trip_id', tripId)
      .eq('category', 'hotel')
      .eq('external_booking_id', HOTEL_LEDGER_KEY);
    return;
  }

  const totalCents = Math.round(totalUsd * 100);
  const description = hotel.name ? `Hotel: ${hotel.name}` : 'Hotel';

  await upsertLogisticsEntry(tripId, 'hotel', totalCents, description, HOTEL_LEDGER_KEY);
}
