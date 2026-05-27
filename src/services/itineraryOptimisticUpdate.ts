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

export interface SaveItineraryOptimisticOptions {
  /** Caller tag threaded to the canonical save boundary for audit/debugging. */
  reason?: string;
  /** User-initiated writes may pass through the frozen-trip gate. */
  allowFrozenWrite?: boolean;
  /** Page-load/self-heal writes must skip destructive ledger reconciliation. */
  skipLedgerCheck?: boolean;
  /** Bypass cached-version conflict check after the user explicitly chose to keep their changes. */
  force?: boolean;
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
  itineraryData: Record<string, unknown>,
  options: SaveItineraryOptimisticOptions = {},
): Promise<OptimisticUpdateResult> {
  const expectedVersion = versionCache.get(tripId);

  // Preserve the collaborator conflict prompt without ever writing itinerary_data
  // through the legacy optimistic_update_itinerary RPC. That RPC bypassed the
  // save-itinerary edge action, persistTripItinerary, frozen guard, table sync,
  // activity-cost sync, and post-save canonical resync — the root class behind
  // pre-refresh vs post-refresh divergence. See hard-refresh plan.
  if (expectedVersion !== undefined && !options.force) {
    const currentVersion = await fetchAndCacheVersion(tripId);
    if (currentVersion !== expectedVersion) {
      return {
        success: false,
        error: 'version_conflict',
        expectedVersion,
        actualVersion: currentVersion,
      };
    }
  }

  const { safeUpdateItineraryData } = await import('./safeUpdateItineraryData');
  const safeRes = await safeUpdateItineraryData(tripId, itineraryData as any, {}, {
    allowFrozenWrite: options.allowFrozenWrite ?? true,
    skipLedgerCheck: options.skipLedgerCheck,
    reason: options.reason || 'optimistic-update',
  });

  if (safeRes?.error) {
    console.error('[OptimisticUpdate] Canonical save failed:', safeRes.error);
    const msg = (safeRes.error as any)?.message ?? String(safeRes.error);
    return { success: false, error: msg };
  }

  const newVersion = await fetchAndCacheVersion(tripId).catch(() => expectedVersion ?? 1);
  return { success: true, newVersion };
}
