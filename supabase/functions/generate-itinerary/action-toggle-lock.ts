/**
 * ACTION: toggle-activity-lock
 * Toggles lock on a single activity (normalized table + JSON fallback).
 */

import { type ActionContext, okJson, errorJson } from './action-types.ts';

const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

export async function handleToggleActivityLock(ctx: ActionContext): Promise<Response> {
  const { supabase, userId, params } = ctx;
  const { tripId, activityId, isLocked, dayNumber, activityTitle, startTime } = params;

  if (!tripId || !activityId || typeof isLocked !== 'boolean') {
    return errorJson("Missing tripId, activityId, or isLocked", 400);
  }

  // Verify ownership
  const { data: trip } = await supabase
    .from('trips')
    .select('user_id')
    .eq('id', tripId)
    .single();
  
  if (!trip) {
    return errorJson("Trip not found", 404);
  }
  
  const isOwner = trip.user_id === userId;
  const { data: collab } = await supabase
    .from('trip_collaborators')
    .select('permission')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .not('accepted_at', 'is', null)
    .maybeSingle();
  
  const hasEditPermission = collab && (collab.permission === 'edit' || collab.permission === 'admin');
  
  if (!isOwner && !hasEditPermission) {
    return errorJson("Access denied", 403);
  }

  // Helper: best-effort fallback to set lock inside trips.itinerary_data JSON
  const tryUpdateLockInJson = async (): Promise<boolean> => {
    const { data: tripData, error: fetchErr } = await supabase
      .from('trips')
      .select('itinerary_data')
      .eq('id', tripId)
      .single();

    if (fetchErr || !tripData?.itinerary_data) return false;

    const itineraryData = tripData.itinerary_data as {
      days?: Array<{ dayNumber: number; activities: Array<{ id: string; isLocked?: boolean }> }>;
    };
    if (!itineraryData.days) return false;

    let found = false;
    const updatedDays = itineraryData.days.map(day => ({
      ...day,
      activities: day.activities.map(act => {
        if (act.id === activityId) {
          found = true;
          return { ...act, isLocked };
        }
        return act;
      }),
    }));

    if (!found) return false;

    const { error: saveErr } = await supabase
      .from('trips')
      .update({ itinerary_data: { ...itineraryData, days: updatedDays } })
      .eq('id', tripId);

    return !saveErr;
  };

  let updateError: { message?: string; code?: string } | null = null;
  let updatedCount = 0;

  if (isValidUUID(activityId)) {
    // Direct UUID update
    const { error, count } = await supabase
      .from('itinerary_activities')
      .update({ is_locked: isLocked, updated_at: new Date().toISOString() })
      .eq('id', activityId)
      .eq('trip_id', tripId);
    
    updateError = error;
    updatedCount = count ?? 0;
  } else {
    // Fallback: match by trip + day + title + time (for ephemeral frontend IDs)
    console.log(`[toggle-activity-lock] Non-UUID activityId: ${activityId}, using fallback match`);
    
    if (!dayNumber || !activityTitle) {
      // Try to update in itinerary_data JSON as fallback
      const { data: tripData, error: fetchErr } = await supabase
        .from('trips')
        .select('itinerary_data')
        .eq('id', tripId)
        .single();
      
      if (!fetchErr && tripData?.itinerary_data) {
        const itineraryData = tripData.itinerary_data as { days?: Array<{ dayNumber: number; activities: Array<{ id: string; isLocked?: boolean }> }> };
        if (itineraryData.days) {
          let found = false;
          const updatedDays = itineraryData.days.map(day => ({
            ...day,
            activities: day.activities.map(act => {
              if (act.id === activityId) {
                found = true;
                return { ...act, isLocked };
              }
              return act;
            }),
          }));
          
          if (found) {
            const { error: saveErr } = await supabase
              .from('trips')
              .update({ itinerary_data: { ...itineraryData, days: updatedDays } })
              .eq('id', tripId);
            
            if (!saveErr) {
              console.log(`[toggle-activity-lock] Updated lock in itinerary_data JSON for ${activityId}`);
              return okJson({ success: true, activityId, isLocked, method: 'json' });
            }
          }
        }
      }
      
      return errorJson("Cannot match activity without dayNumber and activityTitle for non-UUID IDs", 400);
    }

    // First try the normalized tables
    const { data: dayRow } = await supabase
      .from('itinerary_days')
      .select('id')
      .eq('trip_id', tripId)
      .eq('day_number', dayNumber)
      .maybeSingle();
    
    if (!dayRow) {
      // Day not in normalized table - fall back to JSON update
      console.log(`[toggle-activity-lock] Day ${dayNumber} not in normalized table, falling back to JSON`);
      
      const { data: tripData, error: fetchErr } = await supabase
        .from('trips')
        .select('itinerary_data')
        .eq('id', tripId)
        .single();
      
      if (!fetchErr && tripData?.itinerary_data) {
        const itineraryData = tripData.itinerary_data as { days?: Array<{ dayNumber: number; activities: Array<{ id: string; isLocked?: boolean }> }> };
        if (itineraryData.days) {
          let found = false;
          const updatedDays = itineraryData.days.map(day => ({
            ...day,
            activities: day.activities.map(act => {
              if (act.id === activityId) {
                found = true;
                return { ...act, isLocked };
              }
              return act;
            }),
          }));
          
          if (found) {
            const { error: saveErr } = await supabase
              .from('trips')
              .update({ itinerary_data: { ...itineraryData, days: updatedDays } })
              .eq('id', tripId);
            
            if (!saveErr) {
              console.log(`[toggle-activity-lock] Updated lock in itinerary_data JSON for ${activityId}`);
              return okJson({ success: true, activityId, isLocked, method: 'json' });
            }
          }
        }
      }
      
      return errorJson(`Activity not found for day ${dayNumber}`, 404);
    }

    // Prefer matching by external_id
    const { data: actByExternal } = await supabase
      .from('itinerary_activities')
      .select('id')
      .eq('itinerary_day_id', dayRow.id)
      .eq('trip_id', tripId)
      .eq('external_id', activityId)
      .maybeSingle();

    if (actByExternal?.id) {
      const { error, count } = await supabase
        .from('itinerary_activities')
        .update({ is_locked: isLocked, updated_at: new Date().toISOString() })
        .eq('id', actByExternal.id)
        .eq('trip_id', tripId);
      updateError = error;
      updatedCount = count ?? 0;
      console.log(`[toggle-activity-lock] Matched by external_id, updated id=${actByExternal.id}`);
    } else {
      // Fallback match by day + title + optional start_time
      let query = supabase
        .from('itinerary_activities')
        .update({ is_locked: isLocked, updated_at: new Date().toISOString() })
        .eq('itinerary_day_id', dayRow.id)
        .eq('trip_id', tripId)
        .eq('title', activityTitle);
      
      if (startTime) {
        query = query.eq('start_time', startTime);
      }

      const { error, count } = await query;
      updateError = error;
      updatedCount = count ?? 0;
      
      console.log(`[toggle-activity-lock] Fallback match: day=${dayNumber}, title="${activityTitle}", time=${startTime}, updated=${updatedCount}`);
    }

    // If nothing was updated, create from itinerary_data
    if (!updateError && updatedCount === 0) {
      const { data: tripData, error: fetchErr } = await supabase
        .from('trips')
        .select('itinerary_data')
        .eq('id', tripId)
        .single();

      if (!fetchErr && tripData?.itinerary_data) {
        const itineraryData = tripData.itinerary_data as {
          days?: Array<{ dayNumber: number; activities?: any[] }>;
        };
        const dayData = itineraryData.days?.find(d => d.dayNumber === dayNumber);
        const activities = (dayData?.activities || []) as any[];
        const idx = activities.findIndex(a => a?.id === activityId);
        const act = idx >= 0 ? activities[idx] : null;

        if (act) {
          const payload = {
            trip_id: tripId,
            itinerary_day_id: dayRow.id,
            external_id: activityId,
            sort_order: idx,
            title: act.title || act.name || activityTitle,
            name: act.name || act.title || activityTitle,
            description: act.description ?? null,
            category: act.category ?? null,
            start_time: act.startTime ?? startTime ?? null,
            end_time: act.endTime ?? null,
            duration_minutes: act.durationMinutes ?? null,
            location: act.location ?? null,
            cost: act.cost ?? act.estimatedCost ?? null,
            tags: act.tags ?? [],
            is_locked: isLocked,
            booking_required: act.bookingRequired ?? false,
            tips: act.tips ?? null,
            photos: act.photos ?? null,
            transportation: act.transportation ?? null,
          };

          const { error: insertErr } = await supabase
            .from('itinerary_activities')
            .insert(payload);

          if (!insertErr) {
            console.log(`[toggle-activity-lock] Inserted activity row from itinerary_data external_id=${activityId} locked=${isLocked}`);
            await tryUpdateLockInJson();
            return okJson({ success: true, activityId, isLocked, method: 'insert_from_json' });
          }
        }
      }

      // Last resort: at least persist lock in JSON
      const jsonOk = await tryUpdateLockInJson();
      if (jsonOk) {
        console.log(`[toggle-activity-lock] Updated lock in itinerary_data JSON for ${activityId} (no normalized match)`);
        return okJson({ success: true, activityId, isLocked, method: 'json_fallback' });
      }

      return errorJson('Activity not found to lock (no normalized match and JSON update failed)', 404);
    }
  }
  
  if (updateError) {
    console.error('[toggle-activity-lock] Update error:', updateError);
    return errorJson("Failed to update lock status", 500);
  }

  console.log(`[toggle-activity-lock] Activity ${activityId} is_locked=${isLocked}, rows updated: ${updatedCount}`);

  // Keep itinerary_data JSON in sync
  if (!updateError && updatedCount > 0) {
    await tryUpdateLockInJson();
  }
  
  return okJson({ success: true, activityId, isLocked, updatedCount });
}
