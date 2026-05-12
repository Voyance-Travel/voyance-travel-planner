import { supabase } from '@/integrations/supabase/client';
import { preserveLedgerCosts } from '@/utils/preserveLedgerCosts';

/**
 * Direct trips.itinerary_data writes from React state can silently downgrade
 * server-repaired Michelin/ticketed/reference floor prices when the in-memory
 * copy was serialized before the repair landed. This wrapper fetches the
 * currently-persisted itinerary, runs preserveLedgerCosts to keep protected
 * cost fields, then writes through the backend `save-itinerary` action so the
 * persist-day contract (ghost rows, placeholder names, prompt artifacts,
 * cross-city venues) runs on every client write path.
 *
 * INTEGRITY GUARD: Refuses to persist a payload that would materially shrink
 * a previously-populated day (e.g. >50% activities lost or all meals lost).
 * This catches page-load self-heal regressions where a transient empty/
 * partial fetch would otherwise overwrite a complete ready trip with empty
 * placeholders. Explicit destructive flows (user delete, regenerate, chat
 * "remove all dining") MUST opt in via { allowReduction: true }.
 */
export interface SafeUpdateOptions {
  /** Set to true for explicit user-driven destructive actions
   *  (delete activity, regenerate day, "remove all X" chat actions).
   *  Page-load / self-heal / hydration paths must NEVER set this. */
  allowReduction?: boolean;
  /** Free-form caller tag for the integrity log line. */
  reason?: string;
}

const MEAL_RE = /\b(breakfast|brunch|lunch|dinner|supper|nightcap)\b/i;

function activityIsMeal(a: any): boolean {
  if (!a) return false;
  const cat = String(a.category || a.type || '').toLowerCase();
  if (['dining', 'restaurant', 'breakfast', 'brunch', 'lunch', 'dinner', 'cafe'].includes(cat)) {
    return true;
  }
  const title = String(a.title || a.name || '');
  return MEAL_RE.test(title);
}

function summarizeDay(activities: any[] | undefined): { count: number; meals: number } {
  const list = Array.isArray(activities) ? activities : [];
  let meals = 0;
  for (const a of list) if (activityIsMeal(a)) meals++;
  return { count: list.length, meals };
}

interface IntegrityViolation {
  dayNumber: number | string;
  prev: { count: number; meals: number };
  next: { count: number; meals: number };
}

function detectShrinkage(prevDays: any[], nextDays: any[]): IntegrityViolation[] {
  if (!Array.isArray(prevDays) || !Array.isArray(nextDays)) return [];
  const nextByNum = new Map<number, any>();
  for (const d of nextDays) {
    if (d && typeof d.dayNumber === 'number') nextByNum.set(d.dayNumber, d);
  }
  const violations: IntegrityViolation[] = [];
  for (const prev of prevDays) {
    if (!prev || typeof prev.dayNumber !== 'number') continue;
    const prevSum = summarizeDay(prev.activities);
    if (prevSum.count < 3) continue; // only protect non-trivial days
    const next = nextByNum.get(prev.dayNumber);
    const nextSum = summarizeDay(next?.activities);
    const lostMostActivities = nextSum.count <= Math.floor(prevSum.count / 2);
    const hadMealsNowNone = prevSum.meals >= 1 && nextSum.meals === 0;
    if (lostMostActivities || hadMealsNowNone) {
      violations.push({ dayNumber: prev.dayNumber, prev: prevSum, next: nextSum });
    }
  }
  return violations;
}

export async function safeUpdateItineraryData(
  tripId: string,
  nextItinerary: { days?: any[] } & Record<string, any>,
  extraFields: Record<string, any> = {},
  options: SafeUpdateOptions = {}
): Promise<{ error: any } | undefined> {
  try {
    const { data: current } = await supabase
      .from('trips')
      .select('itinerary_data')
      .eq('id', tripId)
      .maybeSingle();

    const prevDays = (current?.itinerary_data as any)?.days ?? [];
    const nextDays = nextItinerary?.days ?? [];

    // Integrity guard — block silent destructive writes from page-load paths.
    if (!options.allowReduction) {
      const violations = detectShrinkage(prevDays, nextDays);
      if (violations.length > 0) {
        console.error(
          `[safeUpdateItineraryData] BLOCKED destructive write (reason=${options.reason || 'unspecified'}, tripId=${tripId}). ` +
          `Days that would lose content: ${violations.map(v => `D${v.dayNumber} (${v.prev.count}→${v.next.count} acts, ${v.prev.meals}→${v.next.meals} meals)`).join('; ')}. ` +
          `Pass { allowReduction: true } if this was intentional.`
        );
        // The DB version is healthier than the in-memory session. Tell listeners
        // to resync from DB so the user's view heals to match the canonical
        // state instead of staying diverged with the silently-stale session.
        // See mem://constraints/itinerary/db-is-source-of-truth.
        try {
          const { dispatchTripPersisted } = await import('@/lib/itinerary/resyncItineraryFromDb');
          dispatchTripPersisted({ tripId, prevDays: nextDays, source: 'integrity-blocked-resync' });
        } catch { /* non-fatal */ }
        return { error: { code: 'INTEGRITY_BLOCKED', violations } };
      }
    }

    const preservedDays = preserveLedgerCosts(prevDays, nextDays);
    const merged = { ...nextItinerary, days: preservedDays };

    const { error } = await supabase.functions.invoke('generate-itinerary', {
      body: {
        action: 'save-itinerary',
        tripId,
        itinerary: merged,
        extraUpdate: { ...extraFields, updated_at: new Date().toISOString() },
      },
    });
    if (error) {
      // IMPORTANT: do NOT fall back to a raw `trips.update({ itinerary_data })`
      // here. The raw write bypasses the persist-day contract (ghost rows,
      // placeholder names, prompt artifacts, cross-city venues) and was a
      // confirmed leak path. Surface the error so the caller can retry.
      console.error('[safeUpdateItineraryData] backend save failed (no raw fallback):', error);
      return { error };
    }
    // Notify session listeners (e.g. TripDetail) to resync from DB so the
    // post-cascade / post-bookend / post-cleanup state is what the user sees,
    // matching what they'd see after a hard refresh.
    // See mem://constraints/itinerary/db-is-source-of-truth.
    try {
      const { dispatchTripPersisted } = await import('@/lib/itinerary/resyncItineraryFromDb');
      dispatchTripPersisted({ tripId, prevDays: nextDays, source: options.reason || 'safeUpdateItineraryData' });
    } catch { /* non-fatal */ }
    return { error: null };
  } catch (err) {
    console.error('[safeUpdateItineraryData] failed:', err);
    return { error: err };
  }
}
