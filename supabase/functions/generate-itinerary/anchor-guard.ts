/**
 * anchor-guard.ts — Canonical user-anchor enforcement.
 *
 * `applyAnchorsWin` is the single source of truth for restoring user-locked
 * activities (manual paste, chat extraction, multi-city, pinned, edited)
 * after any AI generation step. It MUST run at every boundary where the
 * pipeline writes itinerary days back to the trip row.
 *
 * Behavior:
 *  - Anchors that are missing on their target day are re-injected.
 *  - Anchors that exist (matched by lockedSource fingerprint OR fuzzy title)
 *    have their `locked`/`isLocked` flags reaffirmed and any drifted title /
 *    startTime restored to the anchor's canonical values.
 *  - Days are kept in startTime order after restoration.
 *
 * Pure function — no IO, no side effects on the input arrays' top level.
 */

function parseTimeToMinutes(t?: string): number {
  if (!t) return 0;
  const m = t.match(/(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 0;
}

export function applyAnchorsWin(
  itineraryDays: any[],
  userAnchors: Array<Record<string, any>>
): { days: any[]; restored: number; reaffirmed: number } {
  if (!Array.isArray(itineraryDays) || itineraryDays.length === 0) {
    return { days: itineraryDays || [], restored: 0, reaffirmed: 0 };
  }
  if (!Array.isArray(userAnchors) || userAnchors.length === 0) {
    return { days: itineraryDays, restored: 0, reaffirmed: 0 };
  }

  const days = itineraryDays.map((d) => ({ ...d, activities: Array.isArray(d.activities) ? [...d.activities] : [] }));
  let restored = 0;
  let reaffirmed = 0;

  const fingerprint = (a: any) =>
    `${a.lockedSource || ''}|${(a.title || a.name || '').toLowerCase().trim()}`;

  for (const anchor of userAnchors) {
    const targetDayNum = (anchor.dayNumber as number) || 0;
    if (targetDayNum < 1 || targetDayNum > days.length) continue;
    const day = days[targetDayNum - 1];
    if (!day || !Array.isArray(day.activities)) continue;
    const anchorFp = fingerprint(anchor);
    const existing = day.activities.find((a: any) => {
      if ((a.locked || a.isLocked) && fingerprint(a) === anchorFp) return true;
      const aTitle = (a.title || a.name || '').toLowerCase();
      const lockTitle = (anchor.title || '').toLowerCase();
      return lockTitle && aTitle && (aTitle.includes(lockTitle) || lockTitle.includes(aTitle));
    });
    if (!existing) {
      day.activities.push({
        id: `anchor-restore-d${targetDayNum}-${restored}-${Date.now()}`,
        title: anchor.title,
        name: anchor.title,
        startTime: anchor.startTime || undefined,
        endTime: anchor.endTime || undefined,
        category: anchor.category || 'activity',
        venue_name: anchor.venueName || undefined,
        location: anchor.venueName ? { name: anchor.venueName, address: '' } : undefined,
        cost: { amount: 0, currency: 'USD' },
        locked: true,
        isLocked: true,
        lockedSource: anchor.lockedSource,
        anchorSource: anchor.source,
        durationMinutes: 60,
      });
      restored++;
    } else {
      existing.locked = true;
      existing.isLocked = true;
      if (anchor.title && existing.title !== anchor.title) {
        existing.title = anchor.title;
        existing.name = anchor.title;
      }
      if (anchor.startTime && existing.startTime !== anchor.startTime) {
        existing.startTime = anchor.startTime;
        if (anchor.endTime) existing.endTime = anchor.endTime;
      }
      reaffirmed++;
    }
  }

  if (restored > 0) {
    for (const d of days) {
      if (Array.isArray(d.activities)) {
        d.activities.sort((a: any, b: any) =>
          parseTimeToMinutes(a.startTime || a.start_time) - parseTimeToMinutes(b.startTime || b.start_time)
        );
      }
    }
  }

  return { days, restored, reaffirmed };
}

/**
 * Harvest anchor-shaped objects from existing itinerary days. Used by the
 * generation chain to preserve user intent across the destructive day-clear
 * step. Returns deduplicated anchors (keyed by dayNumber + lockedSource + title).
 */
export function harvestAnchorsFromDays(
  days: any[],
  existingAnchors: Array<Record<string, any>> = [],
): Array<Record<string, any>> {
  const out: Array<Record<string, any>> = Array.isArray(existingAnchors) ? [...existingAnchors] : [];
  const seen = new Set(
    out.map((a) => `${a.dayNumber}|${a.lockedSource || ''}|${(a.title || '').toLowerCase().trim()}`),
  );
  if (!Array.isArray(days)) return out;
  for (const d of days) {
    const dayNumber = (d?.dayNumber as number) || 0;
    if (!dayNumber) continue;
    for (const a of (d?.activities || [])) {
      const isLocked = !!(a?.locked || a?.isLocked || a?.lockedSource);
      if (!isLocked) continue;
      const title = (a.title || a.name || '').trim();
      if (!title) continue;
      const lockedSource = a.lockedSource || `harvested:${title}`;
      const key = `${dayNumber}|${lockedSource}|${title.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        dayNumber,
        title,
        startTime: a.startTime || a.start_time || undefined,
        endTime: a.endTime || a.end_time || undefined,
        category: a.category || 'activity',
        venueName: a.venue_name || a.location?.name || undefined,
        lockedSource,
        source: a.anchorSource || 'harvested',
      });
    }
  }
  return out;
}
