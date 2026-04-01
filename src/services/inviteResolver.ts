/**
 * Centralized Invite Resolver Service
 * 
 * Single source of truth for resolving, creating, and rotating trip invite links.
 * All share surfaces (EditorialItinerary, TripShareModal, ShareTripCard) use this.
 */

import { supabase } from '@/integrations/supabase/client';
import { getAppUrl } from '@/utils/getAppUrl';

export interface InviteHealth {
  success: boolean;
  reason?: string;
  link?: string;
  token?: string;
  expiresAt?: string;
  usesCount?: number;
  maxUses?: number;
  rotated?: boolean;
}

/**
 * Resolve or create an invite link for the given trip.
 * Uses the backend `resolve_or_rotate_invite` function to guarantee
 * the returned link is valid, not expired, and not exhausted.
 * 
 * @param tripId - The trip to resolve an invite for
 * @param forceRotate - If true, invalidates old token and creates a fresh one
 */
export async function resolveInviteLink(
  tripId: string,
  forceRotate = false
): Promise<InviteHealth> {
  try {
    const { data, error } = await supabase.rpc('resolve_or_rotate_invite', {
      p_trip_id: tripId,
      p_force_rotate: forceRotate,
    });

    if (error) throw error;

    const result = data as unknown as InviteHealth;

    // Diagnostic logging for invite resolution
    console.log('[inviteResolver] resolve_or_rotate_invite response:', {
      success: result.success,
      reason: result.reason,
      tokenPrefix: result.token?.slice(0, 8),
      usesCount: result.usesCount,
      maxUses: result.maxUses,
      expiresAt: result.expiresAt,
      rotated: result.rotated,
    });

    if (result.success && result.token) {
      return {
        ...result,
        link: `${getAppUrl()}/invite/${result.token}`,
      };
    }

    return result;
  } catch (e) {
    console.error('[inviteResolver] Failed to resolve invite:', e);
    return {
      success: false,
      reason: 'network_error',
    };
  }
}

/**
 * Human-readable message for invite resolution failures.
 */
export function getInviteErrorMessage(reason?: string): string {
  switch (reason) {
    case 'trip_full':
      return 'This trip is full. Increase the traveler count to share again.';
    case 'not_authenticated':
      return 'Please sign in to share your trip.';
    case 'not_owner':
      return 'Only the trip owner can create invite links.';
    case 'trip_not_found':
      return 'Trip not found.';
    case 'network_error':
      return 'Failed to create share link. Please try again.';
    default:
      return 'Unable to create share link.';
  }
}
