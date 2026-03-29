/**
 * Action handler for 'generate-full' — RETIRED (Phase 1).
 *
 * This file used to contain a 2,962-line monolithic pipeline.
 * It is now a thin redirect to the authoritative day-chain pipeline
 * (handleGenerateTrip). Kept as a safety net for any callers that
 * still reference the 'generate-full' action.
 */

import { corsHeaders } from './action-types.ts';
import { handleGenerateTrip } from './action-generate-trip.ts';

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

export async function handleGenerateFull(
  supabase: any,
  userId: string,
  params: Record<string, any>,
): Promise<Response> {
  const { tripId, smartFinishMode } = params;

  if (!tripId) {
    return new Response(
      JSON.stringify({ error: 'Missing tripId', code: 'INVALID_INPUT' }),
      { status: 400, headers: jsonHeaders },
    );
  }

  // If smartFinishMode flag was passed directly, persist it to trip.metadata
  // so the day-chain pipeline picks it up.
  if (smartFinishMode) {
    try {
      const { data: trip } = await supabase
        .from('trips')
        .select('metadata')
        .eq('id', tripId)
        .single();

      const existingMeta = (trip?.metadata as Record<string, any>) || {};
      if (!existingMeta.smartFinishMode) {
        await supabase
          .from('trips')
          .update({ metadata: { ...existingMeta, smartFinishMode: true } })
          .eq('id', tripId);
      }
    } catch (err) {
      console.warn('[generate-full→redirect] Failed to persist smartFinishMode (non-fatal):', err);
    }
  }

  // Fetch trip record to extract params that handleGenerateTrip expects
  const { data: trip, error: tripErr } = await supabase
    .from('trips')
    .select('destination, destination_country, start_date, end_date, travelers, trip_type, budget_tier, is_multi_city')
    .eq('id', tripId)
    .single();

  if (tripErr || !trip) {
    return new Response(
      JSON.stringify({ error: 'Trip not found', code: 'NOT_FOUND' }),
      { status: 404, headers: jsonHeaders },
    );
  }

  console.log(`[generate-full→redirect] Redirecting to generate-trip for trip ${tripId}`);

  // Delegate to the authoritative day-chain pipeline
  return handleGenerateTrip(supabase, userId, {
    tripId,
    destination: trip.destination,
    destinationCountry: trip.destination_country,
    startDate: trip.start_date,
    endDate: trip.end_date,
    travelers: trip.travelers || 1,
    tripType: trip.trip_type || 'vacation',
    budgetTier: trip.budget_tier || 'moderate',
    isMultiCity: trip.is_multi_city || false,
    creditsCharged: params.creditsCharged || 0,
  });
}
