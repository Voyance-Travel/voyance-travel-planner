/**
 * Client-side mirror of supabase/functions/generate-itinerary/_shared/duration-format.ts.
 * Normalizes activity.duration strings (e.g. "45:00:00" → "45m") in-place
 * across an itinerary's days, before any DB write.
 */
import { coerceDurationString } from './plannerUtils';

export function normalizeActivityDuration(activity: any): any {
  if (!activity || typeof activity !== 'object') return activity;
  const dm =
    typeof activity.durationMinutes === 'number'
      ? activity.durationMinutes
      : typeof activity.duration_minutes === 'number'
      ? activity.duration_minutes
      : null;

  const cleaned = coerceDurationString(activity.duration, dm);
  if (cleaned) {
    activity.duration = cleaned;
    if (dm == null) {
      const hm = cleaned.match(/^(?:(\d+)h)?\s*(?:(\d+)m)?$/);
      if (hm) {
        const mins = (parseInt(hm[1] || '0', 10) * 60) + parseInt(hm[2] || '0', 10);
        if (mins > 0) {
          if (activity.durationMinutes === undefined) activity.durationMinutes = mins;
          if (activity.duration_minutes === undefined) activity.duration_minutes = mins;
        }
      }
    }
  }
  return activity;
}

export function normalizeDurationsInDays(days: any[]): void {
  if (!Array.isArray(days)) return;
  for (const day of days) {
    const acts = day?.activities;
    if (Array.isArray(acts)) {
      for (const a of acts) normalizeActivityDuration(a);
    }
  }
}
