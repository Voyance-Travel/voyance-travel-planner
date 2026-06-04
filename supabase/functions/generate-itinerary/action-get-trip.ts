/**
 * ACTION: get-trip
 * Retrieves trip data with ownership verification.
 */

import { type ActionContext, okJson, errorJson } from './action-types.ts';

export async function handleGetTrip(ctx: ActionContext): Promise<Response> {
  const { supabase, userId, params } = ctx;
  const { tripId } = params;

  const { data: trip, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single();

  if (error || !trip) {
    return errorJson("Trip not found", 404);
  }

  // Verify ownership or collaboration
  const isOwner = trip.user_id === userId;
  const { data: collab } = await supabase
    .from('trip_collaborators')
    .select('id')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .not('accepted_at', 'is', null)
    .maybeSingle();
  
  const isCollaborator = !!collab;
  
  if (!isOwner && !isCollaborator) {
    console.error(`[get-trip] Unauthorized access attempt by ${userId} for trip ${tripId}`);
    return errorJson("Trip not found or access denied", 403);
  }

  return okJson({
    success: true,
    trip: {
      tripId: trip.id,
      destination: trip.destination,
      destinationCountry: trip.destination_country,
      startDate: trip.start_date,
      endDate: trip.end_date,
      travelers: trip.travelers || 1,
      tripType: trip.trip_type,
      budgetTier: trip.budget_tier,
    },
  });
}
