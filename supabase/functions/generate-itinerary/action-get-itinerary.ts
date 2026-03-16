/**
 * ACTION: get-itinerary
 * Retrieves itinerary data with ownership verification.
 */

import { type ActionContext, okJson, errorJson } from './action-types.ts';

export async function handleGetItinerary(ctx: ActionContext): Promise<Response> {
  const { supabase, userId, params } = ctx;
  const { tripId } = params;

  const { data: trip, error } = await supabase
    .from('trips')
    .select('id, user_id, destination, destination_country, start_date, end_date, travelers, itinerary_data, itinerary_status')
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
    console.error(`[get-itinerary] Unauthorized access attempt by ${userId} for trip ${tripId}`);
    return errorJson("Trip not found or access denied", 403);
  }

  if (!trip.itinerary_data) {
    return okJson({
      success: true,
      status: trip.itinerary_status || 'not_started',
      itinerary: null,
    });
  }

  return okJson({
    success: true,
    status: trip.itinerary_status || 'ready',
    tripId: trip.id,
    destination: trip.destination,
    ...trip.itinerary_data,
  });
}
