/**
 * Public Trip Share Link Service
 *
 * Single source of truth for the consumer "anyone with the link can view"
 * sharing flow. Returns canonical /trip-share/:token URLs and lazily
 * enables share_enabled on the trip via the toggle_consumer_trip_share RPC.
 *
 * Note: this is intentionally separate from inviteResolver (which handles
 * /invite/:token collaborator invites that require sign-in).
 */

import { supabase } from '@/integrations/supabase/client';
import { getAppUrl } from '@/utils/getAppUrl';

export interface PublicShareResult {
  success: boolean;
  reason?: string;
  link?: string;
  token?: string;
  enabled?: boolean;
}

function buildLink(token: string): string {
  return `${getAppUrl()}/trip-share/${token}`;
}

/**
 * Read-only check: returns the existing public link if sharing is already
 * enabled. Does NOT mutate state. Safe for non-owners.
 */
export async function getPublicTripShareLink(
  tripId: string,
): Promise<PublicShareResult> {
  try {
    const { data, error } = await supabase
      .from('trips')
      .select('share_enabled, share_token')
      .eq('id', tripId)
      .maybeSingle();

    if (error) {
      console.error('[publicShareLink] read failed:', error);
      return { success: false, reason: 'read_failed' };
    }

    if (data?.share_enabled && data?.share_token) {
      return {
        success: true,
        enabled: true,
        token: data.share_token,
        link: buildLink(data.share_token),
      };
    }

    return { success: true, enabled: false };
  } catch (e) {
    console.error('[publicShareLink] unexpected read error:', e);
    return { success: false, reason: 'network_error' };
  }
}

/**
 * Owner action: ensure share_enabled=true and a share_token exists, then
 * return the canonical /trip-share/:token URL. Safe to call repeatedly.
 */
export async function getOrCreatePublicTripShareLink(
  tripId: string,
): Promise<PublicShareResult> {
  const existing = await getPublicTripShareLink(tripId);
  if (existing.success && existing.enabled && existing.link) {
    return existing;
  }

  try {
    const { data, error } = await supabase.rpc('toggle_consumer_trip_share', {
      p_trip_id: tripId,
      p_enabled: true,
    });

    if (error) {
      console.error('[publicShareLink] toggle failed:', error);
      return { success: false, reason: 'toggle_failed' };
    }

    const result = data as unknown as {
      success: boolean;
      share_enabled?: boolean;
      share_token?: string;
      reason?: string;
    } | null;

    if (!result?.success || !result.share_token) {
      return {
        success: false,
        reason: result?.reason || 'toggle_failed',
      };
    }

    return {
      success: true,
      enabled: !!result.share_enabled,
      token: result.share_token,
      link: buildLink(result.share_token),
    };
  } catch (e) {
    console.error('[publicShareLink] unexpected toggle error:', e);
    return { success: false, reason: 'network_error' };
  }
}

/**
 * Owner action: disable public sharing. The share_token is preserved so it
 * can be re-enabled later without changing the URL.
 */
export async function disablePublicTripShareLink(
  tripId: string,
): Promise<PublicShareResult> {
  try {
    const { data, error } = await supabase.rpc('toggle_consumer_trip_share', {
      p_trip_id: tripId,
      p_enabled: false,
    });
    if (error) {
      return { success: false, reason: 'toggle_failed' };
    }
    const result = data as unknown as {
      success: boolean;
      share_token?: string;
      reason?: string;
    } | null;
    return {
      success: !!result?.success,
      enabled: false,
      token: result?.share_token,
      reason: result?.reason,
    };
  } catch (e) {
    console.error('[publicShareLink] unexpected disable error:', e);
    return { success: false, reason: 'network_error' };
  }
}

export function getPublicShareErrorMessage(reason?: string): string {
  switch (reason) {
    case 'not_authenticated':
      return 'Please sign in to share this trip.';
    case 'not_owner':
      return 'Only the trip owner can create a public link.';
    case 'trip_not_found':
      return 'Trip not found.';
    case 'read_failed':
      return 'Could not load sharing settings. Please try again.';
    case 'toggle_failed':
      return 'Could not update sharing. Please try again.';
    case 'network_error':
      return 'Network issue. Please try again.';
    default:
      return 'Unable to create a public share link.';
  }
}
