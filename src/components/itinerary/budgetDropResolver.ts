/**
 * Pure helper for resolving a Budget Coach "drop" suggestion against
 * the live itinerary state. Used by EditorialItinerary's onApplyBudgetSwap.
 *
 * Why a separate helper: the drop apply path used to gate on
 * `day.dayNumber === suggestion.day_number`, which silently no-ops when
 * the edge function returns a stale day. This helper finds the activity
 * by id across ALL days and verifies the live title still loosely
 * matches `current_item` so a recycled UUID can never wipe an unrelated
 * activity.
 */

export interface DropResolverActivity {
  id: string;
  title?: string | null;
  name?: string | null;
}

export interface DropResolverDay {
  dayNumber?: number;
  activities: DropResolverActivity[];
}

export interface DropResolverSuggestion {
  activity_id: string;
  current_item?: string | null;
  day_number?: number;
}

export type DropResolution =
  | { ok: true; dayIdx: number; activity: DropResolverActivity }
  | { ok: false; error: 'not-found' | 'title-mismatch' };

const norm = (s: string | null | undefined) =>
  (s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

export function titlesLooselyMatch(claimed: string, real: string): boolean {
  const c = norm(claimed);
  const r = norm(real);
  if (!c || !r) return true; // can't verify → don't block
  if (c === r) return true;
  if (r.includes(c) || c.includes(r)) return true;
  const ct = new Set(c.split(' ').filter((t) => t.length >= 4));
  const rt = new Set(r.split(' ').filter((t) => t.length >= 4));
  for (const t of ct) if (rt.has(t)) return true;
  return false;
}

export function resolveDropTarget(
  days: DropResolverDay[],
  suggestion: DropResolverSuggestion
): DropResolution {
  const targetId = suggestion.activity_id;
  if (!targetId) return { ok: false, error: 'not-found' };

  for (let i = 0; i < days.length; i++) {
    const hit = days[i].activities.find((a) => a.id === targetId);
    if (hit) {
      const realTitle = hit.title || hit.name || '';
      if (!titlesLooselyMatch(suggestion.current_item || '', realTitle)) {
        return { ok: false, error: 'title-mismatch' };
      }
      return { ok: true, dayIdx: i, activity: hit };
    }
  }
  return { ok: false, error: 'not-found' };
}
