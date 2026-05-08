/**
 * Auto-fill afternoon dead gaps in a generated day.
 *
 * Runs AFTER repairDay() to detect ≥180-min unplanned windows that overlap
 * the active afternoon (12:00–19:00) and inserts a real activity from the
 * shared fill-gap helper. Skips arrival/departure days, locked activities,
 * and gaps that touch transport/logistics on either side.
 */

import { proposeGapFiller } from '../../_shared/fill-gap.ts';

const AFTERNOON_START_MIN = 12 * 60;
const AFTERNOON_END_MIN = 19 * 60;
const MIN_GAP_MIN = 180;
const MIN_USABLE_OVERLAP_MIN = 60;

const LOGISTICS_KEYWORDS = ['check-in', 'check in', 'checkin', 'check-out', 'check out', 'checkout', 'arrival', 'departure', 'flight', 'airport', 'transfer to', 'transfer from', 'luggage drop', 'freshen up', 'return to', 'settle in'];

function parseTime(t: string | undefined | null): number | null {
  if (!t) return null;
  const m = String(t).match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
}

function isLogisticsActivity(a: any): boolean {
  const cat = String(a?.category || '').toLowerCase();
  if (cat === 'accommodation' || cat === 'hotel' || cat === 'lodging') return true;
  if (cat === 'logistics' || cat === 'flight' || cat === 'transport' || cat === 'transportation' || cat === 'transit') return true;
  const title = String(a?.title || '').toLowerCase();
  return LOGISTICS_KEYWORDS.some(k => title.includes(k));
}

export interface FillDeadGapsOptions {
  destination: string;
  isFirstDay?: boolean;
  isLastDay?: boolean;
  isLastDayInCity?: boolean;
  archetype?: string;
  dietaryRestrictions?: string[];
  budgetTier?: string;
  tripCurrency?: string;
  lockedIds?: Set<string>;
  /** Disable when in build-myself / manual mode */
  enabled?: boolean;
  /**
   * Last-day upper bound (HH:MM minutes-from-midnight).
   * Typically `departureTime − buffer` (180m flight / 120m train) or hotel
   * checkout. When set on a last day, dead-gap fill runs with the upper bound
   * = min(AFTERNOON_END_MIN, latestUsableMins). When omitted on a last day,
   * dead-gap fill is skipped (legacy behaviour).
   */
  latestUsableMins?: number;
}

export interface FillDeadGapsResult {
  activities: any[];
  inserted: Array<{ afterId: string | undefined; title: string; gapMinutes: number }>;
}

/**
 * Returns the (possibly mutated) activities array plus a list of inserts.
 * Always returns a fresh array so callers can drop it into their day object.
 */
export async function fillAfternoonDeadGaps(
  activities: any[],
  opts: FillDeadGapsOptions,
): Promise<FillDeadGapsResult> {
  if (opts.enabled === false) return { activities: [...activities], inserted: [] };
  // Arrival day: skip (handled by dedicated arrival-day pacing).
  if (opts.isFirstDay) return { activities: [...activities], inserted: [] };
  // Departure day: only run when caller provided a usable upper bound,
  // otherwise we don't know how late we can schedule activities.
  if (opts.isLastDay && (opts.latestUsableMins === undefined || opts.latestUsableMins <= AFTERNOON_START_MIN)) {
    return { activities: [...activities], inserted: [] };
  }
  if (!Array.isArray(activities) || activities.length < 2) {
    return { activities: [...activities], inserted: [] };
  }

  // Effective upper bound for this day's afternoon window.
  const effectiveAfternoonEnd = opts.isLastDay && opts.latestUsableMins !== undefined
    ? Math.min(AFTERNOON_END_MIN, opts.latestUsableMins)
    : AFTERNOON_END_MIN;

  const inserted: FillDeadGapsResult['inserted'] = [];
  const lockedIds = opts.lockedIds || new Set<string>();
  let i = 0;
  // Cap to 2 inserts per day to bound AI calls / runaway behavior
  const MAX_INSERTS = 2;

  while (i < work.length - 1 && inserted.length < MAX_INSERTS) {
    const curr = work[i];
    const next = work[i + 1];

    if (isLogisticsActivity(curr) || isLogisticsActivity(next)) {
      i++;
      continue;
    }
    if (lockedIds.has(next?.id)) {
      i++;
      continue;
    }

    const currEnd = parseTime(curr?.endTime) ?? parseTime(curr?.startTime);
    const nextStart = parseTime(next?.startTime);
    if (currEnd === null || nextStart === null) {
      i++;
      continue;
    }

    const gap = nextStart - currEnd;
    if (gap < MIN_GAP_MIN) {
      i++;
      continue;
    }

    // Must overlap afternoon window
    const overlapStart = Math.max(currEnd, AFTERNOON_START_MIN);
    const overlapEnd = Math.min(nextStart, AFTERNOON_END_MIN);
    if (overlapEnd - overlapStart < MIN_USABLE_OVERLAP_MIN) {
      i++;
      continue;
    }

    console.log(`[fill-dead-gaps] Detected ${Math.round(gap / 60)}h gap between "${curr.title}" (${curr.endTime}) and "${next.title}" (${next.startTime}) — requesting filler`);

    let proposed: any = null;
    try {
      proposed = await proposeGapFiller({
        activities: work.map(a => ({ id: a.id, title: a.title, startTime: a.startTime, endTime: a.endTime })),
        destination: opts.destination,
        gapStartTime: curr.endTime!,
        gapEndTime: next.startTime!,
        beforeId: curr.id,
        afterId: next.id,
        archetype: opts.archetype,
        dietaryRestrictions: opts.dietaryRestrictions,
        budgetTier: opts.budgetTier,
        tripCurrency: opts.tripCurrency,
      }, { source: 'gap-filler-auto' });
    } catch (e) {
      console.warn('[fill-dead-gaps] proposeGapFiller threw:', e);
    }

    if (!proposed) {
      console.log(`[fill-dead-gaps] No filler returned for gap after "${curr.title}" — leaving gap`);
      i++;
      continue;
    }

    // Insert into work array right after curr
    work.splice(i + 1, 0, proposed);
    inserted.push({ afterId: curr.id, title: proposed.title, gapMinutes: gap });
    console.log(`[fill-dead-gaps] Inserted "${proposed.title}" (${proposed.startTime}-${proposed.endTime}) after "${curr.title}"`);
    // Advance past the new insert so we don't re-scan it
    i += 2;
  }

  return { activities: work, inserted };
}

/**
 * Inspect a finalized day for any remaining ≥180-min unplanned afternoon window.
 * Returns the largest such gap in minutes (0 if none). Non-mutating.
 */
export function reportRemainingAfternoonDeadGap(activities: any[]): number {
  if (!Array.isArray(activities) || activities.length < 2) return 0;
  const sorted = [...activities].sort((a, b) => {
    const sa = parseTime(a?.startTime) ?? 0;
    const sb = parseTime(b?.startTime) ?? 0;
    return sa - sb;
  });
  let largest = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const currEnd = parseTime(sorted[i]?.endTime) ?? parseTime(sorted[i]?.startTime);
    const nextStart = parseTime(sorted[i + 1]?.startTime);
    if (currEnd === null || nextStart === null) continue;
    const gap = nextStart - currEnd;
    if (gap < MIN_GAP_MIN) continue;
    const overlapStart = Math.max(currEnd, AFTERNOON_START_MIN);
    const overlapEnd = Math.min(nextStart, AFTERNOON_END_MIN);
    if (overlapEnd - overlapStart < MIN_USABLE_OVERLAP_MIN) continue;
    if (gap > largest) largest = gap;
  }
  return largest;
}

