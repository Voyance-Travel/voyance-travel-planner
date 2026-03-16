/**
 * ACTION: save-itinerary
 * Saves itinerary data with ownership verification and no-shrink guard.
 */

import { type ActionContext, okJson, errorJson } from './action-types.ts';

/** After a leg finishes generating, check if there's a queued next leg and kick it off. */
export async function triggerNextJourneyLeg(supabase: any, tripId: string): Promise<void> {
  try {
    const { data: currentTrip } = await supabase
      .from('trips')
      .select('journey_id, journey_order')
      .eq('id', tripId)
      .single();

    if (!currentTrip?.journey_id || !currentTrip?.journey_order) {
      return;
    }

    const nextOrder = currentTrip.journey_order + 1;
    const { data: nextLeg } = await supabase
      .from('trips')
      .select('id, itinerary_status, destination, destination_country, start_date, end_date, travelers, trip_type, budget_tier, is_multi_city, user_id')
      .eq('journey_id', currentTrip.journey_id)
      .eq('journey_order', nextOrder)
      .single();

    if (!nextLeg || nextLeg.itinerary_status !== 'queued') {
      console.log(`[triggerNextJourneyLeg] No queued next leg for journey ${currentTrip.journey_id} order ${nextOrder}`);
      return;
    }

    console.log(`[triggerNextJourneyLeg] Triggering generation for next leg ${nextLeg.id} (order ${nextOrder}, dest: ${nextLeg.destination})`);

    const generateUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-itinerary`;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    try {
      const res = await fetch(generateUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          action: 'generate-trip',
          tripId: nextLeg.id,
          userId: nextLeg.user_id,
          destination: nextLeg.destination,
          destinationCountry: nextLeg.destination_country || '',
          startDate: nextLeg.start_date,
          endDate: nextLeg.end_date,
          travelers: nextLeg.travelers || 1,
          tripType: nextLeg.trip_type || 'vacation',
          budgetTier: nextLeg.budget_tier || 'moderate',
          isMultiCity: nextLeg.is_multi_city || false,
          creditsCharged: 0,
        }),
      });

      if (!res.ok) {
        const errorBody = await res.text().catch(() => 'no body');
        console.error(`[triggerNextJourneyLeg] Non-2xx response for leg ${nextLeg.id}: ${res.status} — ${errorBody}`);
        const { data: legMeta } = await supabase.from('trips').select('metadata').eq('id', nextLeg.id).single();
        const existingMeta = (legMeta?.metadata as Record<string, unknown>) || {};
        await supabase.from('trips').update({
          itinerary_status: 'queued',
          metadata: { ...existingMeta, chain_error: `Backend returned ${res.status}`, chain_error_at: new Date().toISOString() },
        }).eq('id', nextLeg.id);
        return;
      }

      console.log(`[triggerNextJourneyLeg] Next leg ${nextLeg.id} invoke status: ${res.status}`);
    } catch (fetchErr) {
      console.error(`[triggerNextJourneyLeg] Failed to invoke next leg ${nextLeg.id}:`, fetchErr);
      const { data: legMeta } = await supabase.from('trips').select('metadata').eq('id', nextLeg.id).single();
      const existingMeta = (legMeta?.metadata as Record<string, unknown>) || {};
      await supabase.from('trips').update({
        itinerary_status: 'queued',
        metadata: { ...existingMeta, chain_error: String(fetchErr), chain_error_at: new Date().toISOString() },
      }).eq('id', nextLeg.id);
    }
  } catch (err) {
    console.error('[triggerNextJourneyLeg] Error:', err);
  }
}

export async function handleSaveItinerary(ctx: ActionContext): Promise<Response> {
  const { supabase, userId, params } = ctx;
  const { tripId, itinerary } = params;

  // Verify trip access
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('user_id')
    .eq('id', tripId)
    .single();

  if (tripError || !trip) {
    return errorJson("Trip not found", 404);
  }

  const isOwner = trip.user_id === userId;
  const { data: collab } = await supabase
    .from('trip_collaborators')
    .select('id, permission')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .not('accepted_at', 'is', null)
    .maybeSingle();
  
  const hasEditPermission = collab && (collab.permission === 'edit' || collab.permission === 'admin');
  
  if (!isOwner && !hasEditPermission) {
    console.error(`[save-itinerary] Unauthorized save attempt by ${userId} for trip ${tripId}`);
    return errorJson("Access denied. You don't have permission to modify this trip.", 403);
  }

  // ── NO-SHRINK GUARD ──────────────────────────────────────────────
  const allowShrink = params.allowShrink === true;
  const incomingDays: unknown[] = Array.isArray((itinerary as any)?.days) ? (itinerary as any).days : [];
  const incomingCount = incomingDays.length;

  const { data: currentTrip } = await supabase
    .from('trips')
    .select('itinerary_data')
    .eq('id', tripId)
    .single();
  const existingJsonDays: unknown[] = Array.isArray((currentTrip?.itinerary_data as any)?.days)
    ? (currentTrip!.itinerary_data as any).days
    : [];

  const { count: existingTableRows } = await supabase
    .from('itinerary_days')
    .select('id', { count: 'exact', head: true })
    .eq('trip_id', tripId);

  const canonicalExisting = Math.max(existingJsonDays.length, existingTableRows || 0);

  if (!allowShrink && incomingCount > 0 && canonicalExisting > 0 && incomingCount < canonicalExisting) {
    console.warn(
      `[save-itinerary] 🛡️ SHRINK BLOCKED: tripId=${tripId}, ` +
      `incoming=${incomingCount}, canonical=${canonicalExisting} ` +
      `(json=${existingJsonDays.length}, table=${existingTableRows || 0}). ` +
      `Returning success without writing to prevent data loss.`
    );
    return okJson({ success: true, shrinkBlocked: true, incomingCount, canonicalExisting });
  }

  const updatePayload: Record<string, any> = {
    itinerary_data: itinerary,
    itinerary_status: 'ready',
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('trips')
    .update(updatePayload)
    .eq('id', tripId);

  if (error) {
    console.error("[save-itinerary] Failed:", error);
    return errorJson("Failed to save itinerary", 500);
  }

  // Trigger next journey leg if applicable
  await triggerNextJourneyLeg(supabase, tripId);

  return okJson({ success: true });
}
