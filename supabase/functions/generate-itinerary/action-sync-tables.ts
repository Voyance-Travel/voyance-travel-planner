/**
 * ACTION: sync-itinerary-tables
 * Migrates JSON itinerary_data to normalized tables.
 */

import { type ActionContext, okJson, errorJson } from './action-types.ts';

export async function handleSyncItineraryTables(ctx: ActionContext): Promise<Response> {
  const { supabase, userId, params } = ctx;
  const { tripId } = params;

  if (!tripId) {
    return errorJson("Missing tripId", 400);
  }

  // Verify ownership and get start_date for date derivation
  const { data: trip } = await supabase
    .from('trips')
    .select('user_id, itinerary_data, start_date')
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

  const itineraryData = trip.itinerary_data as { days?: unknown[] } | null;
  const days = itineraryData?.days || [];
  
  if (days.length === 0) {
    return okJson({ success: true, synced: 0, message: "No days to sync" });
  }

  let syncedActivities = 0;
  
  for (const dayData of days) {
    const d = dayData as {
      dayNumber?: number;
      date?: string;
      title?: string;
      theme?: string;
      description?: string;
      narrative?: unknown;
      activities?: unknown[];
    };
    
    const dayNumber = d.dayNumber || 1;
    // Derive date from trip start_date if missing
    let date = d.date;
    if (!date && trip.start_date) {
      const derived = new Date(trip.start_date + 'T00:00:00Z');
      derived.setUTCDate(derived.getUTCDate() + dayNumber - 1);
      date = derived.toISOString().split('T')[0];
      console.log(`[sync-itinerary-tables] Derived missing date for day ${dayNumber}: ${date}`);
    }
    if (!date) {
      date = new Date().toISOString().split('T')[0];
      console.warn(`[sync-itinerary-tables] No start_date available — using today for day ${dayNumber}`);
    }
    
    const activities = d.activities || [];
    
    const { data: dayRow, error: dayError } = await supabase
      .from('itinerary_days')
      .upsert({
        trip_id: tripId,
        day_number: dayNumber,
        date: date,
        title: d.title || d.theme,
        theme: d.theme,
        description: d.description || null,
        narrative: d.narrative || null,
        // Mirror activities into itinerary_days.activities column so frontend
        // reads from one canonical place and never sees stale empty arrays
        activities: activities.length > 0 ? activities : null,
      }, { onConflict: 'trip_id,day_number' })
      .select('id')
      .single();
    
    if (dayError || !dayRow) {
      console.error(`[sync-itinerary-tables] Failed to upsert day ${dayNumber}:`, dayError);
      continue;
    }
    
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const activityRows = activities.map((act: unknown, idx: number) => {
      const a = act as {
        id?: string; title?: string; name?: string; description?: string;
        category?: string; startTime?: string; endTime?: string;
        start_time?: string; end_time?: string; durationMinutes?: number;
        location?: { name?: string; address?: string };
        cost?: { amount: number; currency: string };
        isLocked?: boolean; locked?: boolean; tags?: string[]; bookingRequired?: boolean;
        booking_required?: boolean; tips?: string; photos?: unknown;
        walking_distance?: string; walking_time?: string;
        transportation?: unknown; rating?: unknown; website?: string;
        viatorProductCode?: string; suggestedFor?: string;
      };
      
      // Validate ID is a proper UUID — non-UUID IDs (e.g. "guard-breakfast-5-...")
      // cause upsert failures on the uuid-typed itinerary_activities.id column
      const rawId = a.id || '';
      const id = UUID_RE.test(rawId) ? rawId : crypto.randomUUID();

      return {
        id,
        itinerary_day_id: dayRow.id,
        trip_id: tripId,
        sort_order: idx,
        title: a.title || a.name || 'Activity',
        name: a.name || a.title,
        description: a.description || null,
        category: a.category || 'activity',
        start_time: a.startTime || a.start_time || null,
        end_time: a.endTime || a.end_time || null,
        duration_minutes: a.durationMinutes || null,
        location: a.location || null,
        cost: a.cost || null,
        tags: a.tags || null,
        // Preserve EITHER locked flag — pipeline uses `locked`, UI uses `isLocked`,
        // and either should make this row immune to AI overwrites.
        is_locked: !!(a.isLocked || a.locked),
        booking_required: a.bookingRequired || a.booking_required || false,
        tips: a.tips || null,
        photos: a.photos || null,
        walking_distance: a.walking_distance || null,
        walking_time: a.walking_time || null,
        transportation: a.transportation || null,
        rating: a.rating || null,
        website: a.website || null,
        viator_product_code: a.viatorProductCode || null,
        suggested_for: a.suggestedFor || null,
      };
    });
    
    if (activityRows.length > 0) {
      const { error: actError } = await supabase
        .from('itinerary_activities')
        .upsert(activityRows, { onConflict: 'id' });
      
      if (actError) {
        console.error(`[sync-itinerary-tables] Failed to insert activities for day ${dayNumber}:`, actError);
      } else {
        syncedActivities += activityRows.length;
      }
    }
  }

  console.log(`[sync-itinerary-tables] Synced ${days.length} days, ${syncedActivities} activities`);
  
  return okJson({ success: true, syncedDays: days.length, syncedActivities });
}
