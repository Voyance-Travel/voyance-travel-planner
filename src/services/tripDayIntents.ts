import { supabase } from '@/integrations/supabase/client';

/**
 * Mark trip_day_intents as fulfilled when their title matches one of the
 * given activities (lowercase substring containment in either direction).
 *
 * Without this, after a manual edit the next regenerate-day still sees the
 * intent as active and may overwrite the user's edit.
 *
 * Best-effort: errors are swallowed and logged.
 */
export async function markIntentsFulfilledByActivities(
  tripId: string,
  dayNumber: number,
  activities: Array<{ id?: string | null; title?: string | null; name?: string | null }>
): Promise<number> {
  try {
    if (!tripId || !dayNumber || !Array.isArray(activities) || activities.length === 0) return 0;

    const { data: matchingIntents, error: selErr } = await supabase
      .from('trip_day_intents')
      .select('id, title')
      .eq('trip_id', tripId)
      .eq('day_number', dayNumber)
      .neq('status', 'fulfilled');

    if (selErr || !matchingIntents || matchingIntents.length === 0) return 0;

    const acts = activities
      .map((a) => ({
        id: a?.id ?? null,
        title: ((a?.title || a?.name || '') as string).toLowerCase().trim(),
      }))
      .filter((a) => a.title.length > 0);
    if (acts.length === 0) return 0;

    const fulfilledIds: string[] = [];
    let firstActId: string | null = null;
    for (const intent of matchingIntents) {
      const it = (intent.title || '').toLowerCase().trim();
      if (!it) continue;
      const hit = acts.find((a) => a.title.includes(it) || it.includes(a.title));
      if (hit) {
        fulfilledIds.push(intent.id);
        if (!firstActId && hit.id) firstActId = hit.id;
      }
    }

    if (fulfilledIds.length === 0) return 0;

    const updatePayload: Record<string, unknown> = {
      status: 'fulfilled',
      fulfilled_at: new Date().toISOString(),
    };
    if (firstActId) updatePayload.fulfilled_activity_id = firstActId;

    const { error: updErr } = await supabase
      .from('trip_day_intents')
      .update(updatePayload)
      .in('id', fulfilledIds);

    if (updErr) {
      console.warn('[manual-edit] trip_day_intents update failed:', updErr);
      return 0;
    }

    console.log('[manual-edit] Marked', fulfilledIds.length, 'intents as fulfilled by activity edit');
    return fulfilledIds.length;
  } catch (err) {
    console.warn('[manual-edit] markIntentsFulfilledByActivities failed:', err);
    return 0;
  }
}
