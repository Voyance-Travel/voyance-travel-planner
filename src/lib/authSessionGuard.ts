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
 * Check if a JWT token has a valid shape (3 base64 segments).
 */
function isTokenWellFormed(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split('.');
  return parts.length === 3 && parts.every(p => p.length > 0);
}

/**
 * Get a valid access token, refreshing if needed.
 * Returns the token string or null if auth is unavailable.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const { data } = await guardedGetSession();
  const session = data?.session;
  const token = session?.access_token;

  // If token looks good and isn't expired, return it
  if (isTokenWellFormed(token)) {
    // Check if token is about to expire (within 60s)
    const expiresAt = session?.expires_at;
    const now = Math.floor(Date.now() / 1000);
    if (expiresAt && expiresAt > now + 60) {
      return token;
    }
  }

  // Token missing, malformed, or nearly expired — force refresh
  logger.debug('[AuthGuard] Token needs refresh — forcing refreshSession');
  const { data: refreshData, error } = await guardedRefreshSession();
  if (error || !refreshData?.session?.access_token) {
    logger.warn('[AuthGuard] getValidAccessToken failed after refresh');
    return null;
  }
  return refreshData.session.access_token;
}

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
