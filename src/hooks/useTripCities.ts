/**
 * useTripCities Hook
 * React Query hooks for managing per-city data in multi-city trips
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTripCities,
  addTripCity,
  addTripCities,
  updateTripCity,
  updateCityHotel,
  updateCityTransport,
  updateCityGenerationStatus,
  reorderTripCities,
  removeTripCity,
} from '@/services/tripCitiesService';
import type { TripCityInsert, TripCityUpdate } from '@/types/tripCity';

const QUERY_KEY = 'trip-cities';

export function useTripCities(tripId: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, tripId],
    queryFn: () => getTripCities(tripId!),
    enabled: !!tripId,
    staleTime: 30_000,
  });
}

export function useAddTripCity(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (city: Omit<TripCityInsert, 'trip_id'>) =>
      addTripCity({ ...city, trip_id: tripId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY, tripId] }),
  });
}

export function useAddTripCities(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cities: Omit<TripCityInsert, 'trip_id'>[]) =>
      addTripCities(cities.map(c => ({ ...c, trip_id: tripId }))),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY, tripId] }),
  });
}

export function useUpdateTripCity(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cityId, updates }: { cityId: string; updates: TripCityUpdate }) =>
      updateTripCity(cityId, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY, tripId] }),
  });
}

export function useUpdateCityHotel(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cityId, hotelSelection, hotelCostCents }: { 
      cityId: string; 
      hotelSelection: Record<string, unknown>; 
      hotelCostCents: number;
    }) => updateCityHotel(cityId, hotelSelection, hotelCostCents),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY, tripId] }),
  });
}

export function useUpdateCityTransport(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cityId, transportType, transportDetails, transportCostCents, currency }: {
      cityId: string;
      transportType: TripCityInsert['transport_type'];
      transportDetails: TripCityInsert['transport_details'];
      transportCostCents: number;
      currency?: string;
    }) => updateCityTransport(cityId, transportType, transportDetails, transportCostCents, currency),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY, tripId] }),
  });
}

export function useUpdateCityGeneration(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cityId, status, daysGenerated, itineraryData }: {
      cityId: string;
      status: TripCityInsert['generation_status'];
      daysGenerated?: number;
      itineraryData?: Record<string, unknown>;
    }) => updateCityGenerationStatus(cityId, status, daysGenerated, itineraryData),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY, tripId] }),
  });
}

export function useReorderTripCities(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cityIds: string[]) => reorderTripCities(tripId, cityIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY, tripId] }),
  });
}

export function useRemoveTripCity(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cityId: string) => removeTripCity(cityId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY, tripId] }),
  });
}
