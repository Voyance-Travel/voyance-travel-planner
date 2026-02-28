/**
 * Auth Session Guard
 * 
 * Deduplicates concurrent getSession/refreshSession calls and enforces
 * a cooldown between forced refreshes. This prevents the auth-token lock
 * contention that occurs when multiple components race to refresh the
 * session simultaneously (e.g., during connection recovery storms).
 *
 * Usage:
 *   import { guardedRefreshSession, guardedGetSession } from '@/lib/authSessionGuard';
 *   const { data, error } = await guardedRefreshSession();
 */

import { supabase } from '@/integrations/supabase/client';
import logger from '@/lib/logger';

/** Minimum ms between forced refreshSession calls */
const REFRESH_COOLDOWN_MS = 10_000;

let _refreshInFlight: Promise<{ data: any; error: any }> | null = null;
let _getSessionInFlight: Promise<{ data: any; error: any }> | null = null;
let _lastRefreshAt = 0;

/**
 * Deduplicated, cooldown-gated refreshSession.
 * - If a refresh is already in-flight, returns its promise.
 * - If we refreshed less than REFRESH_COOLDOWN_MS ago, returns a no-op success.
 * - Otherwise starts a new refresh.
 */
export async function guardedRefreshSession(): Promise<{ data: any; error: any }> {
  const now = Date.now();

  // Cooldown: skip if we refreshed very recently
  if (now - _lastRefreshAt < REFRESH_COOLDOWN_MS) {
    logger.debug('[AuthGuard] refreshSession skipped — cooldown active');
    return { data: null, error: null };
  }

  // Dedupe: return existing in-flight promise
  if (_refreshInFlight) {
    logger.debug('[AuthGuard] refreshSession deduplicated — reusing in-flight call');
    return _refreshInFlight;
  }

  logger.debug('[AuthGuard] refreshSession starting');
  _lastRefreshAt = now;

  _refreshInFlight = supabase.auth.refreshSession()
    .then((result) => {
      if (result.error) {
        logger.warn('[AuthGuard] refreshSession failed:', result.error.message);
      } else {
        logger.debug('[AuthGuard] refreshSession succeeded');
      }
      return result;
    })
    .finally(() => {
      _refreshInFlight = null;
    });

  return _refreshInFlight;
}

/**
 * Deduplicated getSession — if one is already in-flight, piggyback on it.
 */
export async function guardedGetSession(): Promise<{ data: any; error: any }> {
  if (_getSessionInFlight) {
    return _getSessionInFlight;
  }

  _getSessionInFlight = supabase.auth.getSession()
    .finally(() => {
      _getSessionInFlight = null;
    });

  return _getSessionInFlight;
}
