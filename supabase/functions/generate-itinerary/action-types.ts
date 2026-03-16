/**
 * Shared types and helpers for all action handlers.
 * 
 * Every action handler receives an ActionContext and returns a Response.
 * This explicit contract eliminates scope-leaking bugs like "context is not defined".
 */

// Re-export corsHeaders for action handlers
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

export const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

/** Every action handler receives this context — no implicit scope leaking. */
export interface ActionContext {
  supabase: any;
  userId: string;
  params: Record<string, any>;
}

/** Standard response helpers */
export function okJson(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

export function errorJson(error: string, status = 400, extra: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({ error, ...extra }), { status, headers: jsonHeaders });
}

/** Trip access verification — shared across actions */
export interface TripAccessResult {
  allowed: boolean;
  isOwner: boolean;
  reason?: string;
}

export async function verifyTripAccess(
  supabase: any,
  tripId: string,
  userId: string,
  requireEditPermission: boolean = false
): Promise<TripAccessResult> {
  if (!tripId || !userId) {
    return { allowed: false, isOwner: false, reason: "Missing tripId or userId" };
  }
  
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('user_id')
    .eq('id', tripId)
    .single();
  
  if (tripError || !trip) {
    return { allowed: false, isOwner: false, reason: "Trip not found" };
  }
  
  if (trip.user_id === userId) {
    return { allowed: true, isOwner: true };
  }
  
  const { data: collab } = await supabase
    .from('trip_collaborators')
    .select('permission')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .not('accepted_at', 'is', null)
    .maybeSingle();
  
  if (!collab) {
    return { allowed: false, isOwner: false, reason: "Access denied - not a collaborator" };
  }
  
  if (requireEditPermission) {
    const hasEditPermission = collab.permission === 'edit' || 
                              collab.permission === 'admin' ||
                              collab.permission === 'editor' ||
                              collab.permission === 'contributor';
    if (!hasEditPermission) {
      return { allowed: false, isOwner: false, reason: "Viewer access only - cannot generate itinerary" };
    }
  }
  
  return { allowed: true, isOwner: false };
}
