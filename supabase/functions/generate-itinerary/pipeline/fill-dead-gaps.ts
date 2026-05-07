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
  if (opts.isFirstDay || opts.isLastDay) return { activities: [...activities], inserted: [] };
  if (!Array.isArray(activities) || activities.length < 2) {
    return { activities: [...activities], inserted: [] };
  }

  // Sort a copy by startTime for gap detection
  const work = [...activities].sort((a, b) => {
    const sa = parseTime(a?.startTime) ?? 0;
    const sb = parseTime(b?.startTime) ?? 0;
    return sa - sb;
  });

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
