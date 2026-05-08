/**
 * Display-time scrubber for "ghost" activities that the generator's pre-save
 * passes were supposed to strip but that survive in already-persisted trips.
 *
 * Two known ghosts:
 *   1. Wellness placeholders ending in "find a venue" (e.g. "Spa Time — find a venue")
 *   2. "Return to (Your) Hotel" rows whose start time landed in the pre-dawn
 *      window (00:00–04:59) — wraparound bug from end-of-day injection.
 *
 * NEVER hides locked or user-edited activities; those are the user's truth.
 */
const HOTEL_RETURN_RE = /(?:return\s+to|back\s+(?:to|at)|head\s+back\s+to|head\s+to|wind\s+down\s+at)\s+(?:your\s+|the\s+|our\s+)?[^,.\n]{0,60}hotel|hotel\s+(?:check[-\s]?in|settle\s+in|wind[-\s]?down|nightcap)/i;
const WELLNESS_PLACEHOLDER_RE = /find a venue\s*$/i;
const PRE_DAWN_MAX_MINS = 5 * 60; // 05:00

function timeToMins(raw: unknown): number | null {
  if (typeof raw !== 'string' || !raw) return null;
  const m = raw.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (/pm/i.test(raw) && h < 12) h += 12;
  if (/am/i.test(raw) && h === 12) h = 0;
  return h * 60 + mm;
}

export function isGhostActivity(a: any): boolean {
  if (!a) return false;
  // Respect user/manual/locked items always.
  if (a.is_locked === true || a.isLocked === true) return false;
  const source = String(a.source || '').toLowerCase();
  if (source === 'user' || source === 'manual' || source === 'extracted' || source === 'pinned') {
    return false;
  }

  const title = String(a.title || a.name || '');

  if (WELLNESS_PLACEHOLDER_RE.test(title)) return true;

  if (HOTEL_RETURN_RE.test(title)) {
    const startMins =
      timeToMins(a.startTime) ?? timeToMins(a.start_time) ?? timeToMins(a.time);
    if (startMins !== null && startMins < PRE_DAWN_MAX_MINS) return true;

    // Post-midnight bleed: card starts in-bounds but its endTime crosses
    // midnight (either > 23:59 or wrapped so end < start). Same shape as the
    // pre-dawn ghost — hide until the next regen clamps it.
    const endMins =
      timeToMins(a.endTime) ?? timeToMins(a.end_time);
    if (endMins !== null && startMins !== null) {
      const wrapped = endMins < startMins;
      const overflow = endMins > 23 * 60 + 59;
      if (wrapped || overflow) return true;
    }
  }

  return false;
}

export function filterGhostActivities<T = any>(activities: T[] | null | undefined): T[] {
  if (!Array.isArray(activities)) return [];
  return activities.filter((a) => !isGhostActivity(a));
}
