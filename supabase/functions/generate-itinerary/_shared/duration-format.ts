/**
 * Deno-safe duration string normalizer (mirror of src/utils/plannerUtils#coerceDurationString).
 * Used post-generation to clean any HH:MM:SS-style duration strings the model emits.
 */

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function coerceDurationString(
  raw: unknown,
  durationMinutes?: number | null
): string {
  if (typeof durationMinutes === 'number' && Number.isFinite(durationMinutes) && durationMinutes > 0) {
    return formatMinutes(Math.round(durationMinutes));
  }
  if (raw == null) return '';
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return formatMinutes(Math.round(raw));
  }
  const s = String(raw).trim();
  if (!s) return '';

  const colon = s.match(/^(\d{1,3}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (colon) {
    const a = parseInt(colon[1], 10);
    const b = parseInt(colon[2], 10);
    const hasSeconds = colon[3] !== undefined;
    let totalMin: number;
    if (hasSeconds) totalMin = a * 60 + b;
    else if (a >= 24 || (a >= 5 && b === 0)) totalMin = a;
    else totalMin = a * 60 + b;
    if (totalMin > 0) return formatMinutes(totalMin);
  }

  const hm = s.match(/^(\d+)\s*h(?:ours?|rs?)?(?:\s*(\d+)\s*m(?:in(?:ute)?s?)?)?$/i);
  if (hm) {
    const total = parseInt(hm[1], 10) * 60 + (hm[2] ? parseInt(hm[2], 10) : 0);
    if (total > 0) return formatMinutes(total);
  }
  const minOnly = s.match(/^(\d+)\s*(?:m|min|mins|minute|minutes)$/i);
  if (minOnly) {
    const total = parseInt(minOnly[1], 10);
    if (total > 0) return formatMinutes(total);
  }
  const bare = s.match(/^(\d+)$/);
  if (bare) {
    const total = parseInt(bare[1], 10);
    if (total > 0) return formatMinutes(total);
  }
  if (/^\d+\s*[-–]\s*\d+\s*(h|hr|hour|min|m)/i.test(s)) return s;
  return '';
}

/**
 * Normalize duration fields on an activity in-place. Returns the same activity.
 * - Prefers existing `durationMinutes` / `duration_minutes` integer.
 * - Repairs HH:MM:SS-shaped `duration` strings.
 */
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
      // Try to back-fill durationMinutes from cleaned string
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
