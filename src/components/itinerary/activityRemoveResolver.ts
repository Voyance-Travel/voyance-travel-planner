/**
 * Pure helper for resolving an "All Costs" trash-button removal against
 * the live itinerary state. Used by EditorialItinerary's onActivityRemove
 * callback wired into BudgetTab.
 *
 * Why a separate helper: the trash button used to call
 * `days.activities.filter(a => a.id !== id)` across every day and fire a
 * success toast unconditionally. A stale id (e.g. after itinerary
 * regeneration) would silently no-op while still telling the user
 * "Activity removed". This helper makes the lookup explicit so the
 * caller can branch on found / not-found and surface accurate feedback.
 */

export interface RemoveResolverActivity {
  id: string;
  title?: string | null;
  name?: string | null;
}

export interface RemoveResolverDay {
  dayNumber?: number;
  activities: RemoveResolverActivity[];
}

export type RemoveResolution =
  | { found: true; dayIdx: number; title: string }
  | { found: false };

export function resolveLiveActivity(
  days: RemoveResolverDay[],
  activityId: string,
): RemoveResolution {
  if (!activityId || !Array.isArray(days)) return { found: false };
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    if (!day?.activities) continue;
    const hit = day.activities.find((a) => a?.id === activityId);
    if (hit) {
      return {
        found: true,
        dayIdx: i,
        title: (hit.title || hit.name || 'activity').toString(),
      };
    }
  }
  return { found: false };
}
