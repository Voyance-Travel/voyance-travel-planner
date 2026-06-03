/**
 * Auto-fill dead gaps in a generated day.
 *
 * Window-parameterized helper: runs AFTER repairDay() to detect ≥180-min
 * unplanned windows that overlap a target window (afternoon 12:00–19:00 or
 * evening 18:00–22:00) and inserts a real activity from the shared fill-gap
 * helper. Skips arrival/departure days, locked activities, and gaps that
 * touch transport/logistics on either side.
 *
 * Bug 4: extended to cover the evening window so 18:42 → 22:48 holes get
 * flagged + filled (preferring a dining card via preferCategory).
 */

import { proposeGapFiller } from '../../_shared/fill-gap.ts';

const MORNING_START_MIN = 9 * 60;
const MORNING_END_MIN = 12 * 60 + 30;
const AFTERNOON_START_MIN = 12 * 60;
const AFTERNOON_END_MIN = 19 * 60;
const EVENING_START_MIN = 18 * 60;
const EVENING_END_MIN = 22 * 60;
const MIN_GAP_MIN = 180;
// Departure-day "graceful finish" threshold: a 75-120min window between the
// last leisure beat and (departure − buffer)/checkout deserves a low-key
// closing moment (espresso, hotel terrace, short stroll) instead of dying
// abruptly at checkout. Smaller than MIN_GAP_MIN to catch the thin-finish case.
// Afternoon-only — evening keeps the standard 180m floor.
const LAST_DAY_MIN_GAP_MIN = 75;
const MIN_USABLE_OVERLAP_MIN = 60;

const LOGISTICS_KEYWORDS = ['check-in', 'check in', 'checkin', 'check-out', 'check out', 'checkout', 'arrival', 'departure', 'flight', 'airport', 'transfer to', 'transfer from', 'luggage drop', 'freshen up', 'return to', 'settle in'];

interface GapWindow {
  fromMins: number;
  toMins: number;
  label: 'morning' | 'afternoon' | 'evening';
}

const MORNING_WINDOW: GapWindow = { fromMins: MORNING_START_MIN, toMins: MORNING_END_MIN, label: 'morning' };
const AFTERNOON_WINDOW: GapWindow = { fromMins: AFTERNOON_START_MIN, toMins: AFTERNOON_END_MIN, label: 'afternoon' };
const EVENING_WINDOW: GapWindow = { fromMins: EVENING_START_MIN, toMins: EVENING_END_MIN, label: 'evening' };

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
  /** For log attribution only — no behavioural use. */
  dayNumber?: number;
  /**
   * Last-day upper bound (HH:MM minutes-from-midnight).
   * Typically `departureTime − buffer` (180m flight / 120m train) or hotel
   * checkout. When set on a last day, dead-gap fill runs with the upper bound
   * = min(window.toMins, latestUsableMins). When omitted on a last day,
   * dead-gap fill is skipped (legacy behaviour).
   */
  latestUsableMins?: number;
  /**
   * Soft preference threaded through to proposeGapFiller. Evening callers
   * pass 'dining' so the AI picks a dinner restaurant when one fits.
   */
  preferCategory?: 'dining' | 'culture' | 'activity';
  /**
   * Required meals for this day. When set and the detected gap overlaps a
   * still-missing meal's window by ≥60min, the filler is steered to dining
   * with the appropriate mealSlot hint. Closes the recurring "3h afternoon
   * gap filled with sightseeing while lunch slot stays empty" pattern.
   */
  requiredMeals?: Array<'breakfast' | 'lunch' | 'dinner'>;
}


export interface FillDeadGapsResult {
  activities: any[];
  inserted: Array<{ afterId: string | undefined; title: string; gapMinutes: number }>;
}

/** Internal — window-parameterized core. */
async function fillDeadGapsForWindow(
  activities: any[],
  opts: FillDeadGapsOptions,
  win: GapWindow,
): Promise<FillDeadGapsResult> {
  const dayN = (opts as any).dayNumber ?? '?';
  if (opts.enabled === false) {
    console.log(`[DEAD_GAP_DECISION] day=${dayN} window=${win.label} decision=skip_window reason=disabled_manual_mode`);
    return { activities: [...activities], inserted: [] };
  }
  // Day 1: skip the morning window (arrival logistics typically eat it), but
  // run the afternoon + evening passes so a 13:30 lunch → 19:00 dinner hole
  // gets filled instead of shipping as a 5h dead gap. Per-pair logistics
  // neighbour skip (arrival flight / airport transfer / check-in / freshen
  // up) still protects the actual arrival sequence below.
  if (opts.isFirstDay && win.label === 'morning') {
    console.log(`[DEAD_GAP_DECISION] day=${dayN} window=${win.label} decision=skip_window reason=first_day_morning`);
    return { activities: [...activities], inserted: [] };
  }
  if (opts.isLastDay && (opts.latestUsableMins === undefined || opts.latestUsableMins <= win.fromMins)) {
    console.log(`[DEAD_GAP_DECISION] day=${dayN} window=${win.label} decision=skip_window reason=last_day_no_usable_window latestUsableMins=${opts.latestUsableMins ?? 'null'}`);
    return { activities: [...activities], inserted: [] };
  }
  if (!Array.isArray(activities) || activities.length < 2) {
    console.log(`[DEAD_GAP_DECISION] day=${dayN} window=${win.label} decision=skip_window reason=fewer_than_2_activities count=${activities?.length ?? 0}`);
    return { activities: [...activities], inserted: [] };
  }

  const effectiveEnd = opts.isLastDay && opts.latestUsableMins !== undefined
    ? Math.min(win.toMins, opts.latestUsableMins)
    : win.toMins;

  const work = [...activities].sort((a, b) => {
    const sa = parseTime(a?.startTime) ?? 0;
    const sb = parseTime(b?.startTime) ?? 0;
    return sa - sb;
  });

  const inserted: FillDeadGapsResult['inserted'] = [];
  const lockedIds = opts.lockedIds || new Set<string>();
  let i = 0;
  const MAX_INSERTS = 2;
  let pairsScanned = 0;
  let skippedLogistics = 0;
  let skippedLocked = 0;
  let skippedNoTime = 0;
  let skippedUnderGap = 0;
  let skippedTinyOverlap = 0;
  let skippedNoFiller = 0;
  let skippedMaxInserts = 0;

  while (i < work.length - 1) {
    if (inserted.length >= MAX_INSERTS) {
      skippedMaxInserts++;
      console.log(`[DEAD_GAP_DECISION] day=${dayN} window=${win.label} decision=skip_pair reason=max_inserts_reached i=${i}`);
      break;
    }
    pairsScanned++;
    const curr = work[i];
    const next = work[i + 1];

    const currIsLogistics = isLogisticsActivity(curr);
    const nextIsLogistics = isLogisticsActivity(next);
    if (currIsLogistics || (nextIsLogistics && !opts.isLastDay)) {
      skippedLogistics++;
      console.log(`[DEAD_GAP_DECISION] day=${dayN} window=${win.label} decision=skip_pair reason=logistics_neighbour curr="${curr?.title || ''}" next="${next?.title || ''}" currLogistics=${currIsLogistics} nextLogistics=${nextIsLogistics}`);
      i++;
      continue;
    }
    if (lockedIds.has(next?.id)) {
      skippedLocked++;
      console.log(`[DEAD_GAP_DECISION] day=${dayN} window=${win.label} decision=skip_pair reason=next_locked next="${next?.title || ''}"`);
      i++;
      continue;
    }

    const currEnd = parseTime(curr?.endTime) ?? parseTime(curr?.startTime);
    const nextStart = parseTime(next?.startTime);
    if (currEnd === null || nextStart === null) {
      skippedNoTime++;
      console.log(`[DEAD_GAP_DECISION] day=${dayN} window=${win.label} decision=skip_pair reason=missing_time curr="${curr?.title || ''}" next="${next?.title || ''}" currEnd=${curr?.endTime ?? 'null'} nextStart=${next?.startTime ?? 'null'}`);
      i++;
      continue;
    }

    const clampedNextStart = Math.min(nextStart, effectiveEnd);
    const gap = clampedNextStart - currEnd;
    // Only afternoon supports the thin-finish departure-day threshold.
    const minGap = (opts.isLastDay && win.label === 'afternoon') ? LAST_DAY_MIN_GAP_MIN : MIN_GAP_MIN;
    if (gap < minGap) {
      skippedUnderGap++;
      // Only log meaningful gaps (>=30m) to avoid noise from minute-level adjacencies
      if (gap >= 30) {
        console.log(`[DEAD_GAP_DECISION] day=${dayN} window=${win.label} decision=skip_pair reason=under_threshold gap_min=${gap} threshold_min=${minGap} curr="${curr?.title || ''}"(${curr?.endTime ?? '?'}) next="${next?.title || ''}"(${next?.startTime ?? '?'})`);
      }
      i++;
      continue;
    }

    const overlapStart = Math.max(currEnd, win.fromMins);
    const overlapEnd = Math.min(clampedNextStart, effectiveEnd);
    if (overlapEnd - overlapStart < MIN_USABLE_OVERLAP_MIN) {
      skippedTinyOverlap++;
      console.log(`[DEAD_GAP_DECISION] day=${dayN} window=${win.label} decision=skip_pair reason=overlap_too_small overlap_min=${overlapEnd - overlapStart} threshold_min=${MIN_USABLE_OVERLAP_MIN} curr="${curr?.title || ''}" next="${next?.title || ''}"`);
      i++;
      continue;
    }

    const clampedEndHHMM = (() => {
      const h = Math.floor(clampedNextStart / 60);
      const m = clampedNextStart % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    })();

    console.log(`[fill-dead-gaps][${win.label}] Detected ${Math.round(gap / 60)}h${gap % 60 ? (gap % 60) + 'm' : ''} gap between "${curr.title}" (${curr.endTime}) and "${next.title}" (${next.startTime})${opts.isLastDay ? ' [last-day, clamped to ' + clampedEndHHMM + ']' : ''} — requesting filler`);
    console.log(`[DEAD_GAP_DECISION] day=${dayN} window=${win.label} decision=request_fill gap_min=${gap} between="${curr.title}"->"${next.title}" effectiveEnd=${clampedEndHHMM}`);

    let proposed: any = null;
    try {
      proposed = await proposeGapFiller({
        activities: work.map(a => ({ id: a.id, title: a.title, startTime: a.startTime, endTime: a.endTime })),
        destination: opts.destination,
        gapStartTime: curr.endTime!,
        gapEndTime: clampedEndHHMM,
        beforeId: curr.id,
        afterId: next.id,
        archetype: opts.archetype,
        dietaryRestrictions: opts.dietaryRestrictions,
        budgetTier: opts.budgetTier,
        tripCurrency: opts.tripCurrency,
        preferCategory: opts.preferCategory,
      }, { source: opts.isLastDay ? `gap-filler-lastday-${win.label}` : `gap-filler-auto-${win.label}` });
    } catch (e) {
      console.warn(`[fill-dead-gaps][${win.label}] proposeGapFiller threw:`, e);
      console.log(`[DEAD_GAP_DECISION] day=${dayN} window=${win.label} decision=skip_pair reason=filler_threw err="${e instanceof Error ? e.message : String(e)}"`);
    }

    if (!proposed) {
      skippedNoFiller++;
      console.log(`[fill-dead-gaps][${win.label}] No filler returned for gap after "${curr.title}" — leaving gap`);
      console.log(`[DEAD_GAP_DECISION] day=${dayN} window=${win.label} decision=skip_pair reason=no_filler_returned curr="${curr.title}"`);
      i++;
      continue;
    }

    work.splice(i + 1, 0, proposed);
    inserted.push({ afterId: curr.id, title: proposed.title, gapMinutes: gap });
    console.log(`[fill-dead-gaps][${win.label}] Inserted "${proposed.title}" (${proposed.startTime}-${proposed.endTime}) after "${curr.title}"`);
    console.log(`[DEAD_GAP_DECISION] day=${dayN} window=${win.label} decision=filled inserted="${proposed.title}" at=${proposed.startTime}-${proposed.endTime} gap_min=${gap} category=${proposed.category ?? '?'}`);
    i += 2;
  }

  console.log(`[DEAD_GAP_SUMMARY] day=${dayN} window=${win.label} pairs=${pairsScanned} filled=${inserted.length} skip_logistics=${skippedLogistics} skip_locked=${skippedLocked} skip_no_time=${skippedNoTime} skip_under_gap=${skippedUnderGap} skip_tiny_overlap=${skippedTinyOverlap} skip_no_filler=${skippedNoFiller} skip_max_inserts=${skippedMaxInserts}`);

  return { activities: work, inserted };
}

/**
 * Returns the (possibly mutated) activities array plus a list of inserts.
 * Always returns a fresh array so callers can drop it into their day object.
 *
 * Morning (09:00–12:30) window — fills the late-morning hole between an
 * early breakfast and lunch on non-arrival days. Per Density Protocol:
 * "Morning gaps filled with 1 paid + 1 free."
 */
export async function fillMorningDeadGaps(
  activities: any[],
  opts: FillDeadGapsOptions,
): Promise<FillDeadGapsResult> {
  return fillDeadGapsForWindow(activities, opts, MORNING_WINDOW);
}

/**
 * Afternoon (12:00–19:00) window — preserves legacy signature & behaviour.
 */
export async function fillAfternoonDeadGaps(
  activities: any[],
  opts: FillDeadGapsOptions,
): Promise<FillDeadGapsResult> {
  return fillDeadGapsForWindow(activities, opts, AFTERNOON_WINDOW);
}

/**
 * Bug 4: evening (18:00–22:00) window. Caller should pass
 * `preferCategory: 'dining'` so the filler prefers a dinner restaurant
 * when no dinner card was injected by the meal-guard.
 */
export async function fillEveningDeadGaps(
  activities: any[],
  opts: FillDeadGapsOptions,
): Promise<FillDeadGapsResult> {
  return fillDeadGapsForWindow(activities, opts, EVENING_WINDOW);
}

/** Internal — window-parameterized reporter. */
function reportRemainingDeadGapForWindow(
  activities: any[],
  latestUsableMins: number | undefined,
  win: GapWindow,
): number {
  if (!Array.isArray(activities) || activities.length < 2) return 0;
  const sorted = [...activities].sort((a, b) => {
    const sa = parseTime(a?.startTime) ?? 0;
    const sb = parseTime(b?.startTime) ?? 0;
    return sa - sb;
  });
  const upperBound = latestUsableMins !== undefined
    ? Math.min(win.toMins, latestUsableMins)
    : win.toMins;
  let largest = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const currEnd = parseTime(sorted[i]?.endTime) ?? parseTime(sorted[i]?.startTime);
    const nextStart = parseTime(sorted[i + 1]?.startTime);
    if (currEnd === null || nextStart === null) continue;
    const clampedNext = Math.min(nextStart, upperBound);
    // Measure only the portion of the gap that overlaps the window.
    const overlapStart = Math.max(currEnd, win.fromMins);
    const overlapEnd = Math.min(clampedNext, upperBound);
    const overlap = overlapEnd - overlapStart;
    if (overlap < MIN_USABLE_OVERLAP_MIN) continue;
    if (overlap < MIN_GAP_MIN) continue;
    if (overlap > largest) largest = overlap;
  }
  return largest;
}

/**
 * Inspect a finalized day for any remaining ≥180-min unplanned afternoon window.
 * Returns the largest such gap in minutes (0 if none). Non-mutating.
 *
 * Legacy 2-arg signature preserved.
 */
export function reportRemainingAfternoonDeadGap(activities: any[], latestUsableMins?: number): number {
  return reportRemainingDeadGapForWindow(activities, latestUsableMins, AFTERNOON_WINDOW);
}

/**
 * Bug 4 — same for the evening (18:00–22:00) window.
 * Optional `dayNumber` is only used for log context.
 */
export function reportRemainingEveningDeadGap(
  activities: any[],
  latestUsableMins?: number,
  dayNumber?: number,
): number {
  const largest = reportRemainingDeadGapForWindow(activities, latestUsableMins, EVENING_WINDOW);
  if (largest >= MIN_GAP_MIN) {
    console.warn(`[QUALITY] Day ${dayNumber ?? '?'} has ${largest}m unplanned ${EVENING_WINDOW.fromMins / 60}:00-${EVENING_WINDOW.toMins / 60}:00`);
  }
  return largest;
}

/**
 * Same for the morning (09:00–12:30) window.
 * Optional `dayNumber` is only used for log context.
 */
export function reportRemainingMorningDeadGap(
  activities: any[],
  latestUsableMins?: number,
  dayNumber?: number,
): number {
  const largest = reportRemainingDeadGapForWindow(activities, latestUsableMins, MORNING_WINDOW);
  if (largest >= MIN_GAP_MIN) {
    console.warn(`[QUALITY] Day ${dayNumber ?? '?'} has ${largest}m unplanned 9:00-12:30`);
  }
  return largest;
}
