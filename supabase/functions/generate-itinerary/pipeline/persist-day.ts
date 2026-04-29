/**
 * Pipeline Persist — DB persistence for a generated day.
 *
 * Phase 5: Extracted from action-generate-day.ts.
 * Handles itinerary_days upsert, itinerary_activities insert/upsert,
 * UUID mapping, orphan cleanup, and itinerary_versions save.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface PersistDayInput {
  supabase: any;
  tripId: string;
  dayNumber: number;
  date: string;
  generatedDay: any;
  normalizedActivities: any[];

  // Version metadata
  action?: string;  // 'generate-day' | 'regenerate-day'
  profile?: any;
  resolvedIsTransitionDay?: boolean;
  resolvedTransitionFrom?: string;
  resolvedTransitionTo?: string;
  resolvedTransportMode?: string;
  resolvedDestination?: string;
}

export interface PersistDayResult {
  /** Activities with DB UUIDs mapped back */
  normalizedActivities: any[];
  /** Whether persistence succeeded */
  success: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isValidUUID = (str: string | undefined): boolean => !!str && UUID_REGEX.test(str);

function makeActivityRow(
  act: any,
  idx: number,
  itineraryDayId: string,
  tripId: string,
) {
  return {
    itinerary_day_id: itineraryDayId,
    trip_id: tripId,
    sort_order: idx,
    title: act.title || act.name || 'Activity',
    name: act.name || act.title,
    description: act.description || null,
    category: act.category || 'activity',
    start_time: act.startTime || null,
    end_time: act.endTime || null,
    duration_minutes: act.durationMinutes || null,
    location: act.location || null,
    cost: act.cost || null,
    tags: act.tags || null,
    is_locked: !!(act.isLocked || act.locked) || false,
    booking_required: act.bookingRequired || false,
    tips: act.tips || null,
    photos: act.photos || null,
    walking_distance: act.walkingDistance || null,
    walking_time: act.walkingTime || null,
    transportation: act.transportation || null,
    rating: act.rating || null,
    website: act.website || null,
    viator_product_code: act.viatorProductCode || null,
  };
}

// =============================================================================
// MAIN PERSIST FUNCTION
// =============================================================================

export async function persistDay(input: PersistDayInput): Promise<PersistDayResult> {
  const {
    supabase, tripId, dayNumber, date, generatedDay,
    action, profile,
    resolvedIsTransitionDay, resolvedTransitionFrom, resolvedTransitionTo,
    resolvedTransportMode, resolvedDestination,
  } = input;
  let normalizedActivities = [...input.normalizedActivities];

  // ── 1. Upsert day row ──
  const { data: dayRow, error: dayError } = await supabase
    .from('itinerary_days')
    .upsert({
      trip_id: tripId,
      day_number: dayNumber,
      date: date,
      title: generatedDay.title,
      theme: generatedDay.theme,
      narrative: generatedDay.narrative || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'trip_id,day_number' })
    .select('id')
    .single();

  if (dayError) {
    console.error('[persist-day] Failed to upsert day:', dayError);
    return { normalizedActivities, success: false };
  }
  if (!dayRow) {
    return { normalizedActivities, success: false };
  }

  const itineraryDayId = dayRow.id;

  // ── 2. Delete old non-locked activities ──
  await supabase
    .from('itinerary_activities')
    .delete()
    .eq('itinerary_day_id', itineraryDayId)
    .eq('is_locked', false);

  // ── 3. Partition activities by UUID vs external-id ──
  const uuidRows = normalizedActivities
    .filter((a: any) => isValidUUID(a.id))
    .map((act: any, idx: number) => ({
      id: act.id,
      external_id: act.external_id || null,
      ...makeActivityRow(act, idx, itineraryDayId, tripId),
    }));

  const externalRows = normalizedActivities
    .filter((a: any) => !isValidUUID(a.id))
    .map((act: any, idx: number) => ({
      external_id: act.id || null,
      ...makeActivityRow(act, idx, itineraryDayId, tripId),
    }));

  // ── 4. Upsert UUID-based activities (locked activities already in DB) ──
  if (uuidRows.length > 0) {
    const { error: uuidErr } = await supabase
      .from('itinerary_activities')
      .upsert(uuidRows, { onConflict: 'id' });
    if (uuidErr) {
      console.error('[persist-day] Failed to upsert UUID activities:', uuidErr);
    }
  }

  // ── 5. Insert external-id based activities (newly generated) ──
  let persistedExternal: Array<{ id: string; external_id: string | null; is_locked: boolean | null }> = [];
  if (externalRows.length > 0) {
    // Clean up existing external-id activities for this day
    const externalIds = externalRows.map((r: any) => r.external_id).filter(Boolean);
    if (externalIds.length > 0) {
      await supabase
        .from('itinerary_activities')
        .delete()
        .eq('trip_id', tripId)
        .eq('itinerary_day_id', itineraryDayId)
        .eq('is_locked', false)
        .in('external_id', externalIds);
    }

    // Clean up orphan non-locked activities
    const keepUuids = uuidRows.map((r: any) => r.id);
    if (keepUuids.length > 0) {
      await supabase
        .from('itinerary_activities')
        .delete()
        .eq('trip_id', tripId)
        .eq('itinerary_day_id', itineraryDayId)
        .eq('is_locked', false)
        .not('id', 'in', `(${keepUuids.join(',')})`);
    }

    // Insert fresh rows
    const { data, error: extErr } = await supabase
      .from('itinerary_activities')
      .insert(externalRows)
      .select('id, external_id, is_locked');
    if (extErr) {
      console.error('[persist-day] Failed to insert external-id activities:', extErr);
    } else {
      persistedExternal = (data || []) as any;
    }
  }

  // ── 6. Map DB UUIDs back to activities ──
  if (persistedExternal.length > 0) {
    const map = new Map(
      persistedExternal
        .filter(r => r.external_id)
        .map(r => [r.external_id as string, r])
    );

    normalizedActivities = normalizedActivities.map((act: any) => {
      if (isValidUUID(act.id)) return act;
      const row = act.id ? map.get(act.id) : undefined;
      if (!row) return act;
      return {
        ...act,
        id: row.id,
        isLocked: row.is_locked ?? act.isLocked,
      };
    });

    // Update generatedDay in place so the response uses DB UUIDs
    generatedDay.activities = normalizedActivities;
  }

  console.log(
    `[persist-day] Persisted activities (uuid=${uuidRows.length}, external=${externalRows.length})`
  );

  // ── 7. Save version for undo functionality ──
  try {
    const versionDnaSnapshot = profile ? {
      archetype: profile.archetype,
      secondaryArchetype: profile.secondaryArchetype,
      archetypeSource: profile.archetypeSource,
      traitScores: profile.traitScores,
      budgetTier: profile.budgetTier,
      dataCompleteness: profile.dataCompleteness,
      isFallback: profile.isFallback,
      snapshotAt: new Date().toISOString(),
    } : null;

    const { error: versionError } = await supabase
      .from('itinerary_versions')
      .insert({
        trip_id: tripId,
        day_number: dayNumber,
        activities: generatedDay.activities,
        day_metadata: {
          title: generatedDay.title,
          theme: generatedDay.theme,
          narrative: generatedDay.narrative,
          isTransitionDay: resolvedIsTransitionDay || undefined,
          transitionFrom: resolvedTransitionFrom || undefined,
          transitionTo: resolvedTransitionTo || undefined,
          transportType: resolvedTransportMode || undefined,
          city: resolvedDestination || undefined,
        },
        created_by_action: action === 'regenerate-day' ? 'regenerate' : 'generate',
        dna_snapshot: versionDnaSnapshot,
      });

    if (versionError) {
      console.error('[persist-day] Failed to save version:', versionError);
    } else {
      console.log('[persist-day] Saved version for day', dayNumber);
    }
  } catch (vErr) {
    console.error('[persist-day] Version save error:', vErr);
  }

  return { normalizedActivities, success: true };
}
