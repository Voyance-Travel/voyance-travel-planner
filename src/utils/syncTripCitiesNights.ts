/**
 * Sync trip_cities nights/dates when the overall trip dates change.
 */
import { addDays, differenceInDays, format } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';
import { supabase } from '@/integrations/supabase/client';
import type { TripCity } from '@/types/tripCity';

export interface NightsRedistribution {
  cityId: string;
  cityName: string;
  oldNights: number;
  newNights: number;
}

/**
 * Proportionally redistribute nights across cities to match a new total.
 * Guarantees each city gets at least 1 night and the sum equals newTotalNights.
 */
export function computeProportionalRedistribution(
  cities: TripCity[],
  newTotalNights: number
): NightsRedistribution[] {
  const totalOld = cities.reduce((s, c) => s + (c.nights || 1), 0);

  if (cities.length === 1) {
    return [{
      cityId: cities[0].id,
      cityName: cities[0].city_name,
      oldNights: cities[0].nights || totalOld,
      newNights: newTotalNights,
    }];
  }

  // Proportional allocation with rounding
  const raw = cities.map(c => ({
    city: c,
    proportion: ((c.nights || 1) / totalOld) * newTotalNights,
  }));

  // Floor everything, then distribute remainders
  const floored = raw.map(r => ({
    ...r,
    allocated: Math.max(1, Math.floor(r.proportion)),
    remainder: r.proportion - Math.max(1, Math.floor(r.proportion)),
  }));

  let allocated = floored.reduce((s, f) => s + f.allocated, 0);
  // Sort by remainder descending to give extras to cities that lost the most
  const sorted = [...floored].sort((a, b) => b.remainder - a.remainder);
  let idx = 0;
  while (allocated < newTotalNights && idx < sorted.length) {
    sorted[idx].allocated += 1;
    allocated += 1;
    idx++;
  }
  // If we over-allocated (due to min 1 constraint), trim from largest
  if (allocated > newTotalNights) {
    const bySizeDesc = [...sorted].sort((a, b) => b.allocated - a.allocated);
    let excess = allocated - newTotalNights;
    for (const item of bySizeDesc) {
      if (excess <= 0) break;
      const canRemove = Math.min(excess, item.allocated - 1);
      item.allocated -= canRemove;
      excess -= canRemove;
    }
  }

  // Build a map from cityId → allocated
  const allocMap = new Map<string, number>();
  for (const f of sorted) {
    allocMap.set(f.city.id, f.allocated);
  }

  return cities.map(c => ({
    cityId: c.id,
    cityName: c.city_name,
    oldNights: c.nights || 1,
    newNights: allocMap.get(c.id) || 1,
  }));
}

/**
 * Persist the new nights and dates to trip_cities rows.
 */
export async function applyNightsRedistribution(
  cities: TripCity[],
  redistribution: NightsRedistribution[],
  newTripStartDate: string
): Promise<void> {
  let cursor = parseLocalDate(newTripStartDate);

  const updates = redistribution.map((r) => {
    const arrivalDate = format(cursor, 'yyyy-MM-dd');
    const departureDate = format(addDays(cursor, r.newNights), 'yyyy-MM-dd');
    cursor = addDays(cursor, r.newNights);

    return supabase
      .from('trip_cities')
      .update({
        nights: r.newNights,
        arrival_date: arrivalDate,
        departure_date: departureDate,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', r.cityId);
  });

  const results = await Promise.all(updates);
  const failed = results.find(r => r.error);
  if (failed?.error) {
    throw new Error(`Failed to sync city nights: ${failed.error.message}`);
  }
}

/**
 * Check if redistribution is needed and auto-apply for single-city trips.
 * Returns redistribution data for multi-city trips (caller shows modal).
 */
export function checkRedistributionNeeded(
  cities: TripCity[],
  newTotalNights: number
): { needed: boolean; isMultiCity: boolean; redistribution: NightsRedistribution[] } {
  const currentTotal = cities.reduce((s, c) => s + (c.nights || 1), 0);

  if (currentTotal === newTotalNights) {
    return { needed: false, isMultiCity: false, redistribution: [] };
  }

  const isMultiCity = cities.length > 1;
  const redistribution = computeProportionalRedistribution(cities, newTotalNights);

  return { needed: true, isMultiCity, redistribution };
}
