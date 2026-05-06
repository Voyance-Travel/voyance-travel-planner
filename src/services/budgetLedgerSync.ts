/**
 * Budget Ledger Sync → activity_costs
 * 
 * Syncs flight and hotel prices into the activity_costs table so the
 * v_trip_total and v_payments_summary views include them automatically.
 * This is the SINGLE source of truth for all trip cost totals.
 */

import { supabase } from '@/integrations/supabase/client';
import type { FlightSelection, HotelSelection } from '@/types/trip';
import { computeHotelCostUsd } from '@/lib/hotel-cost';

// activity_id is now TEXT — no UUID validation needed

/**
 * Generate a deterministic UUID v4-like ID from trip + category.
 * We use a fixed namespace so upserts always find the same row.
 */
function logisticsActivityId(tripId: string, category: 'hotel' | 'flight'): string {
  // Use a simple deterministic transform: take tripId UUID and flip a known byte
  // to create a unique but stable ID per category.
  const base = tripId.replace(/-/g, '');
  const suffix = category === 'hotel' ? 'a' : 'b';
  const modified = suffix + base.slice(1, 8) + '-' + base.slice(8, 12) + '-4' + base.slice(13, 15) + suffix + '-' + base.slice(16, 20) + '-' + base.slice(20, 32);
  return modified;
}

/**
 * Upsert a logistics cost row (hotel or flight) into activity_costs.
 * Uses trip_id + category + day_number=0 to find existing rows.
 */
async function upsertLogisticsCost(
  tripId: string,
  category: 'hotel' | 'flight',
  totalUsd: number,
  description: string,
  numTravelers: number = 1,
) {
  if (totalUsd <= 0) return;

  const activityId = logisticsActivityId(tripId, category);
  const costPerPerson = totalUsd / Math.max(numTravelers, 1);

  // Check if row exists
  const { data: existing } = await supabase
    .from('activity_costs')
    .select('id')
    .eq('trip_id', tripId)
    .eq('category', category)
    .eq('day_number', 0)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('activity_costs')
      .update({
        cost_per_person_usd: costPerPerson,
        num_travelers: numTravelers,
        notes: description,
        source: 'logistics-sync',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    if (error) console.error('[budgetLedgerSync] update failed:', error);
  } else {
    const { error } = await supabase
      .from('activity_costs')
      .insert({
        trip_id: tripId,
        activity_id: activityId,
        day_number: 0,
        category,
        cost_per_person_usd: costPerPerson,
        num_travelers: numTravelers,
        source: 'logistics-sync',
        confidence: 'high',
        is_paid: false,
        notes: description,
      });
    if (error) console.error('[budgetLedgerSync] insert failed:', error);
  }
}

/**
 * Remove a logistics cost row when the selection is cleared.
 */
async function removeLogisticsCost(tripId: string, category: 'hotel' | 'flight') {
  await supabase
    .from('activity_costs')
    .delete()
    .eq('trip_id', tripId)
    .eq('category', category)
    .eq('day_number', 0);
}

/**
 * Sync flight selection price to activity_costs.
 */
export async function syncFlightToLedger(
  tripId: string,
  flight: FlightSelection | null,
) {
  if (!flight?.price || flight.price <= 0) {
    await removeLogisticsCost(tripId, 'flight');
    return;
  }

  const parts = [flight.airline, flight.flightNumber].filter(Boolean).join(' ');
  const description = parts ? `Flight: ${parts}` : 'Flight';

  await upsertLogisticsCost(tripId, 'flight', flight.price, description);
}

/**
 * Look up a per-night reference rate for a hotel from `cost_reference`.
 * Returns null if no row exists for the city or _global fallback.
 *
 * Per the Cost Integrity rule: AI MUST NEVER estimate costs. We only ever
 * read from the curated `cost_reference` table.
 */
async function lookupHotelReferenceRate(
  destinationCity: string | null,
  budgetTier: 'budget' | 'mid' | 'luxury' = 'mid',
): Promise<number | null> {
  const tier = budgetTier === 'budget' || budgetTier === 'mid' || budgetTier === 'luxury' ? budgetTier : 'mid';

  // Try city-specific row first
  if (destinationCity) {
    const { data } = await supabase
      .from('cost_reference')
      .select('cost_mid_usd')
      .eq('category', 'accommodation')
      .eq('subcategory', tier)
      .ilike('destination_city', destinationCity)
      .maybeSingle();
    if (data?.cost_mid_usd) return Number(data.cost_mid_usd);
  }

  // Fall back to global
  const { data: globalRow } = await supabase
    .from('cost_reference')
    .select('cost_mid_usd')
    .eq('category', 'accommodation')
    .eq('subcategory', tier)
    .eq('destination_city', '_global')
    .maybeSingle();
  return globalRow?.cost_mid_usd ? Number(globalRow.cost_mid_usd) : null;
}

/**
 * Compute nights between check-in/check-out dates on a hotel selection.
 */
function getHotelNights(hotel: HotelSelection): number {
  const hotelAny = hotel as any;
  let nights = hotelAny.nights || 0;
  if (nights > 0) return nights;
  const checkIn = hotel.checkIn || hotelAny.checkInDate;
  const checkOut = hotel.checkOut || hotelAny.checkOutDate;
  if (checkIn && checkOut) {
    const checkInMs = new Date(checkIn).getTime();
    const checkOutMs = new Date(checkOut).getTime();
    if (!isNaN(checkInMs) && !isNaN(checkOutMs) && checkOutMs > checkInMs) {
      return Math.max(1, Math.ceil((checkOutMs - checkInMs) / (1000 * 60 * 60 * 24)));
    }
  }
  return 0;
}

/**
 * Sync hotel selection price to activity_costs.
 * Uses totalPrice if available, otherwise pricePerNight × nights.
 * If neither is available, falls back to a reference-table estimate so the
 * accommodation line still appears in the budget breakdown.
 */
export async function syncHotelToLedger(
  tripId: string,
  hotel: HotelSelection | null,
) {
  if (!hotel) {
    await removeLogisticsCost(tripId, 'hotel');
    return;
  }

  // GUARD: if a manual hotel payment already exists for this trip, the user
  // owns the hotel cost line. Never write a system placeholder on top of it —
  // that's the bug that caused the "Hotel Accommodation $2,850" + manual
  // "Four Seasons $2,400" double-billing in Travel Essentials.
  const { data: manualHotelPayments } = await supabase
    .from('trip_payments')
    .select('id')
    .eq('trip_id', tripId)
    .eq('item_type', 'hotel')
    .like('item_id', 'manual-%')
    .limit(1);
  if (manualHotelPayments && manualHotelPayments.length > 0) {
    await removeLogisticsCost(tripId, 'hotel');
    return;
  }

  // Single source of truth for hotel total math, shared with the Flights &
  // Hotels tab and Payments tab so the three views never disagree.
  const hotelAny = hotel as any;
  const checkInDate = hotel.checkIn || hotelAny.checkInDate || null;
  const checkOutDate = hotel.checkOut || hotelAny.checkOutDate || null;
  const totalUsd = computeHotelCostUsd(
    [{ hotel: hotel as any, checkInDate, checkOutDate }],
    null,
    0,
  );

  // NO reference-table estimate. A selected hotel without an explicit price
  // must NOT auto-bill the trip — a $2,850 estimated stay surprised users
  // and double-counted against their manual entry. If we don't have a real
  // price, leave the ledger empty (the manual flow is the source of truth).
  if (!totalUsd || totalUsd <= 0) {
    await removeLogisticsCost(tripId, 'hotel');
    return;
  }

  const description = hotel.name ? `Hotel: ${hotel.name}` : 'Hotel';
  await upsertLogisticsCost(tripId, 'hotel', totalUsd, description);
}

/**
 * Sync multiple city hotels into one aggregated activity_costs row.
 * Used for multi-city trips where hotels are stored per-city in trip_cities.
 */
export async function syncMultiCityHotelsToLedger(
  tripId: string,
  hotels: { name: string; totalPrice: number }[],
) {
  const totalUsd = hotels.reduce((sum, h) => sum + (h.totalPrice || 0), 0);
  const names = hotels.map(h => h.name).filter(Boolean).join(', ');

  if (totalUsd <= 0) {
    await removeLogisticsCost(tripId, 'hotel');
    return;
  }

  await upsertLogisticsCost(tripId, 'hotel', totalUsd, names ? `Hotels: ${names}` : 'Hotels');
}
