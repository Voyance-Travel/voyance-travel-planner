/**
 * Optimistic Locking for Itinerary Updates
 * 
 * Prevents silent last-write-wins when collaborators edit simultaneously.
 * Uses an itinerary_version column on the trips table with compare-and-swap.
 */

import { supabase } from '@/integrations/supabase/client';

export interface OptimisticUpdateResult {
  success: boolean;
  newVersion?: number;
  error?: 'version_conflict' | 'unauthorized' | string;
  expectedVersion?: number;
  actualVersion?: number;
}

/**
 * In-memory version tracker per trip.
 * Updated on fetch and on successful saves.
 */
const versionCache = new Map<string, number>();

/** Get the cached version for a trip */
export function getCachedVersion(tripId: string): number | undefined {
  return versionCache.get(tripId);
}

/** Set the cached version (call after fetching trip data) */
export function setCachedVersion(tripId: string, version: number): void {
  versionCache.set(tripId, version);
}

/** Clear cached version (e.g., on unmount) */
export function clearCachedVersion(tripId: string): void {
  versionCache.delete(tripId);
}

/**
 * Fetch the current itinerary_version from the DB and cache it.
 */
export async function fetchAndCacheVersion(tripId: string): Promise<number> {
  const { data, error } = await supabase
    .from('trips')
    .select('itinerary_version')
    .eq('id', tripId)
    .single();

  if (error || !data) {
    console.warn('[OptimisticUpdate] Failed to fetch version:', error);
    return versionCache.get(tripId) ?? 1;
  }

  const version = (data as any).itinerary_version ?? 1;
  versionCache.set(tripId, version);
  return version;
}

/**
 * Save itinerary data with optimistic locking.
 * 
 * On success: updates the cached version.
 * On conflict: returns error info so the UI can prompt the user to reload.
 * 
 * Falls back to a direct update if no version is cached (e.g., solo user
 * on an older session).
 */
export async function saveItineraryOptimistic(
  tripId: string,
  itineraryData: Record<string, unknown>
): Promise<OptimisticUpdateResult> {
  const expectedVersion = versionCache.get(tripId);

  // If we have no cached version, fall back to direct update
  // (backwards-compatible for edge functions / non-collaborative scenarios)
  if (expectedVersion === undefined) {
    const { error } = await supabase
      .from('trips')
      .update({
        itinerary_data: itineraryData as any,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId);

    if (error) {
      console.error('[OptimisticUpdate] Fallback update failed:', error);
      return { success: false, error: error.message };
    }

    // Try to refresh the version cache after a direct write
    fetchAndCacheVersion(tripId).catch(() => {});
    return { success: true };
  }

  // Use the atomic RPC
  const { data, error } = await supabase.rpc('optimistic_update_itinerary', {
    p_trip_id: tripId,
    p_expected_version: expectedVersion,
    p_itinerary_data: itineraryData as any,
  });

  if (error) {
    console.error('[OptimisticUpdate] RPC error:', error);
    return { success: false, error: error.message };
  }

  const result = data as unknown as {
    success: boolean;
    new_version?: number;
    error?: string;
    expected_version?: number;
    actual_version?: number;
  };

  if (result.success && result.new_version) {
    versionCache.set(tripId, result.new_version);
    return { success: true, newVersion: result.new_version };
  }

  return {
    success: false,
    error: result.error as OptimisticUpdateResult['error'],
    expectedVersion: result.expected_version,
    actualVersion: result.actual_version,
  };
}
