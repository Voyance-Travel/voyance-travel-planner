/**
 * Trip Cities Service
 * CRUD operations for per-city tracking in multi-city trips
 */

import { supabase } from '@/integrations/supabase/client';
import type { TripCity, TripCityInsert, TripCityUpdate, TripCityBudgetSummary } from '@/types/tripCity';
import { resolveCountry } from '@/utils/cityCountryMap';

/** Ensure country is populated before insertion */
function enrichCityCountry<T extends { city_name: string; country?: string }>(city: T): T {
  if (!city.country) {
    const resolved = resolveCountry(city.city_name);
    if (resolved) return { ...city, country: resolved };
  }
  return city;
}

/**
 * Get all cities for a trip, ordered by city_order
 */
export async function getTripCities(tripId: string): Promise<TripCity[]> {
  const { data, error } = await supabase
    .from('trip_cities')
    .select('*')
    .eq('trip_id', tripId)
    .order('city_order', { ascending: true });

  if (error) throw new Error(`Failed to load trip cities: ${error.message}`);
  return (data || []) as unknown as TripCity[];
}

/**
 * Add a city to a trip
 */
export async function addTripCity(city: TripCityInsert): Promise<TripCity> {
  const enriched = enrichCityCountry(city);
  const { data, error } = await supabase
    .from('trip_cities')
    .insert(enriched as any)
    .select()
    .single();

  if (error) throw new Error(`Failed to add city: ${error.message}`);
  return data as unknown as TripCity;
}

/**
 * Add multiple cities at once (e.g., when creating a multi-city trip)
 */
export async function addTripCities(cities: TripCityInsert[]): Promise<TripCity[]> {
  const { data, error } = await supabase
    .from('trip_cities')
    .insert(cities as any[])
    .select();

  if (error) throw new Error(`Failed to add cities: ${error.message}`);
  return (data || []) as unknown as TripCity[];
}

/**
 * Update a specific city
 */
export async function updateTripCity(cityId: string, updates: TripCityUpdate): Promise<TripCity> {
  const { data, error } = await supabase
    .from('trip_cities')
    .update(updates as any)
    .eq('id', cityId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update city: ${error.message}`);
  return data as unknown as TripCity;
}

/**
 * Update hotel selection for a specific city
 */
export async function updateCityHotel(
  cityId: string, 
  hotelSelection: Record<string, unknown>, 
  hotelCostCents: number
): Promise<TripCity> {
  return updateTripCity(cityId, {
    hotel_selection: hotelSelection,
    hotel_cost_cents: hotelCostCents,
  });
}

/**
 * Update transport details for a specific city
 */
export async function updateCityTransport(
  cityId: string,
  transportType: TripCityInsert['transport_type'],
  transportDetails: TripCityInsert['transport_details'],
  transportCostCents: number,
  currency: string = 'USD'
): Promise<TripCity> {
  return updateTripCity(cityId, {
    transport_type: transportType,
    transport_details: transportDetails,
    transport_cost_cents: transportCostCents,
    transport_currency: currency,
  });
}

/**
 * Update generation status for a city
 */
export async function updateCityGenerationStatus(
  cityId: string,
  status: TripCityInsert['generation_status'],
  daysGenerated?: number,
  itineraryData?: Record<string, unknown>
): Promise<TripCity> {
  const updates: TripCityUpdate = { generation_status: status };
  if (daysGenerated !== undefined) updates.days_generated = daysGenerated;
  if (itineraryData !== undefined) updates.itinerary_data = itineraryData;
  return updateTripCity(cityId, updates);
}

/**
 * Reorder cities within a trip
 */
export async function reorderTripCities(tripId: string, cityIds: string[]): Promise<void> {
  // Update each city's order in parallel
  const updates = cityIds.map((id, index) =>
    supabase
      .from('trip_cities')
      .update({ city_order: index } as any)
      .eq('id', id)
      .eq('trip_id', tripId)
  );

  const results = await Promise.all(updates);
  const failed = results.find(r => r.error);
  if (failed?.error) throw new Error(`Failed to reorder cities: ${failed.error.message}`);
}

/**
 * Remove a city from a trip
 */
export async function removeTripCity(cityId: string): Promise<void> {
  const { error } = await supabase
    .from('trip_cities')
    .delete()
    .eq('id', cityId);

  if (error) throw new Error(`Failed to remove city: ${error.message}`);
}

/**
 * Get budget summary per city for a trip
 */
export async function getTripCityBudgetSummary(tripId: string): Promise<TripCityBudgetSummary[]> {
  const cities = await getTripCities(tripId);
  return cities.map(city => ({
    cityName: city.city_name,
    hotelCents: city.hotel_cost_cents || 0,
    transportCents: city.transport_cost_cents || 0,
    activityCents: city.activity_cost_cents || 0,
    diningCents: city.dining_cost_cents || 0,
    miscCents: city.misc_cost_cents || 0,
    totalCents: city.total_cost_cents || 0,
  }));
}
