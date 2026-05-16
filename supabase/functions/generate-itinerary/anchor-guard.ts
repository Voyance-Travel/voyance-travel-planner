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

/**
 * Detect whether a day is the departure day (contains a flight/airport-transfer
 * or hotel checkout). Floating (un-pinned) anchors avoid this day.
 */
function isDepartureDay(day: any): boolean {
  const acts = Array.isArray(day?.activities) ? day.activities : [];
  for (const a of acts) {
    const cat = String(a?.category || '').toLowerCase();
    const title = String(a?.title || a?.name || '').toLowerCase();
    const tags = Array.isArray(a?.tags) ? a.tags.map((t: any) => String(t).toLowerCase()) : [];
    if (cat.includes('departure') || cat.includes('airport-transfer') || cat === 'transfer-to-airport') return true;
    if (tags.includes('departure-flight') || tags.includes('transfer-to-airport')) return true;
    if (/\b(departure flight|travel to airport|transfer to airport|checkout from)\b/.test(title)) return true;
  }
  return false;
}

/**
 * Assign target days to floating (dayNumber < 1) anchors by round-robin,
 * preferring days that don't already match the anchor's fingerprint, and
 * skipping the departure day when possible.
 *
 * Pure: returns a new array of anchors with `dayNumber` set to ≥1; rejects
 * anchors that can't be placed (no eligible day).
 */
function distributeFloatingAnchors(
  anchors: Array<Record<string, any>>,
  days: any[],
  fingerprintFn: (a: any) => string,
): Array<Record<string, any>> {
  if (days.length === 0) return [];
  const eligibleIdx: number[] = [];
  for (let i = 0; i < days.length; i++) {
    if (!isDepartureDay(days[i])) eligibleIdx.push(i);
  }
  // Fallback: if every day is a departure day (degenerate single-day trip),
  // use all days rather than dropping the anchors entirely.
  const pool = eligibleIdx.length > 0 ? eligibleIdx : days.map((_, i) => i);

  // Per-day fill count so round-robin spreads evenly.
  const fillCount = new Map<number, number>();
  for (const i of pool) fillCount.set(i, 0);

  const out: Array<Record<string, any>> = [];
  let dropped = 0;
  for (const anchor of anchors) {
    // Defense-in-depth: anchors without a startTime AND without a venueName are soft
    // must-dos that escaped the front-end gate. Don't paint them onto days as locked
    // naked rows — they'll appear with no time, no description, no address. The
    // generator's prompt-level MANDATORY block already handles these as soft requirements.
    if (!anchor.startTime && !anchor.venueName) {
      dropped++;
      continue;
    }
    const fp = fingerprintFn(anchor);
    // 1. Prefer a day that doesn't already contain a fingerprint match AND has the lowest fill count.
    let best = -1;
    let bestScore = Infinity;
    for (const i of pool) {
      const dayActs = Array.isArray(days[i]?.activities) ? days[i].activities : [];
      const hasMatch = dayActs.some((a: any) => fingerprintFn(a) === fp);
      const fc = fillCount.get(i) ?? 0;
      // Score: prefer no-match (0) over match (100), then prefer lower fill count.
      const score = (hasMatch ? 100 : 0) + fc;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best < 0) continue;
    fillCount.set(best, (fillCount.get(best) ?? 0) + 1);
    out.push({ ...anchor, dayNumber: best + 1 });
  }
  if (dropped > 0) {
    console.log(`[ANCHOR_GUARD] floating_dropped count=${dropped} reason=soft_must_do (no startTime, no venueName)`);
  }
  return out;
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

  // Partition anchors: pinned (dayNumber >= 1 and in-range) vs floating (dayNumber < 1).
  const pinned: Array<Record<string, any>> = [];
  const floating: Array<Record<string, any>> = [];
  for (const anchor of userAnchors) {
    const dn = (anchor.dayNumber as number) || 0;
    if (dn >= 1 && dn <= days.length) pinned.push(anchor);
    else if (dn < 1) floating.push(anchor);
    // Out-of-range pinned anchors (dn > days.length) are still skipped silently.
  }

  let distributedAnchors: Array<Record<string, any>> = [];
  if (floating.length > 0) {
    distributedAnchors = distributeFloatingAnchors(floating, days, fingerprint);
    if (distributedAnchors.length > 0) {
      const targetDays = distributedAnchors.map((a) => a.dayNumber);
      console.log(`[ANCHOR_GUARD] floating_distributed count=${distributedAnchors.length} days=[${targetDays.join(',')}]`);
    }
  }

  const allAnchors = [...pinned, ...distributedAnchors];

  for (const anchor of allAnchors) {
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
