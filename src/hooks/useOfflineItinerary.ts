/**
 * Offline Itinerary Cache Hook
 * Caches trip + itinerary data to localStorage for offline access
 */

import { useEffect, useCallback } from 'react';
import type { Tables } from '@/integrations/supabase/types';

type Trip = Tables<'trips'>;

const OFFLINE_CACHE_KEY = 'voyance_offline_trips';
const CACHE_VERSION = 1;

interface OfflineCache {
  version: number;
  trips: Record<string, {
    trip: Trip;
    cachedAt: string;
  }>;
}

function getCache(): OfflineCache {
  try {
    const raw = localStorage.getItem(OFFLINE_CACHE_KEY);
    if (!raw) return { version: CACHE_VERSION, trips: {} };
    const parsed = JSON.parse(raw) as OfflineCache;
    if (parsed.version !== CACHE_VERSION) return { version: CACHE_VERSION, trips: {} };
    return parsed;
  } catch {
    return { version: CACHE_VERSION, trips: {} };
  }
}

function saveCache(cache: OfflineCache): void {
  try {
    localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('[OfflineCache] Storage full, clearing old entries');
    // Evict oldest entries
    const entries = Object.entries(cache.trips).sort(
      (a, b) => new Date(a[1].cachedAt).getTime() - new Date(b[1].cachedAt).getTime()
    );
    while (entries.length > 1) {
      entries.shift();
      cache.trips = Object.fromEntries(entries);
      try {
        localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(cache));
        return;
      } catch {
        continue;
      }
    }
  }
}

/** Cache a trip for offline use — strips heavy data to avoid localStorage quota issues */
export function cacheTrip(trip: Trip): void {
  const cache = getCache();
  // Strip heavy fields to reduce localStorage pressure
  const lightweight = { ...trip } as any;
  delete lightweight.itinerary_data;
  delete lightweight.metadata;
  cache.trips[trip.id] = {
    trip: lightweight as Trip,
    cachedAt: new Date().toISOString(),
  };
  saveCache(cache);
}

/** Retrieve a cached trip */
export function getCachedTrip(tripId: string): Trip | null {
  const cache = getCache();
  return cache.trips[tripId]?.trip ?? null;
}

/** Get all cached trips */
export function getAllCachedTrips(): { trip: Trip; cachedAt: string }[] {
  const cache = getCache();
  return Object.values(cache.trips).sort(
    (a, b) => new Date(b.cachedAt).getTime() - new Date(a.cachedAt).getTime()
  );
}

/** Remove a cached trip */
export function removeCachedTrip(tripId: string): void {
  const cache = getCache();
  delete cache.trips[tripId];
  saveCache(cache);
}

/**
 * Hook that auto-caches trip data whenever it changes
 */
export function useOfflineItinerary(trip: Trip | null) {
  useEffect(() => {
    if (trip) {
      cacheTrip(trip);
    }
  }, [trip]);

  const getCached = useCallback((id: string) => getCachedTrip(id), []);

  return { getCached, getAllCached: getAllCachedTrips };
}
