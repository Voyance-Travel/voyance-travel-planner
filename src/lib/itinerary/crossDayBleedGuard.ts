/**
 * Cross-Day Bleed Guard (frontend mirror).
 *
 * Read-time / parse-time port of `supabase/functions/_shared/cross-day-bleed-guard.ts`.
 * Self-heals legacy persisted trips (Amsterdam-class data already on disk)
 * by moving an untagged pre-dawn head row on Day N+1 back to Day N's tail
 * when Day N ended late (≥22:00).
 *
 * Sentinel: `[DAY1_BLEED_GUARD] day=N+1 site=… action=moved_to_prev_day_tail`.
 *
 * See mem://constraints/itinerary/day1-past-midnight-no-day2-cascade.
 */

const BOOKEND_SOURCE_RE =
  /^(bookend-readtime|bookend-overnight|bookend-validator|bookend-synthesized|late_nightlife_bookend)$/i;

const DEPARTURE_LOGISTICS_RE =
  /^(airport[-_ ]?transfer|transfer[-_ ]?to[-_ ]?airport|flight|checkout|check[-_ ]?out)$/i;

const TAIL_LATE_THRESHOLD_MIN = 22 * 60;
const HEAD_PREDAWN_BOUNDARY_MIN = 6 * 60;

function parseTimeMin(raw: unknown): number | null {
  if (typeof raw !== 'string' || !raw) return null;
  const m = raw.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (/pm/i.test(raw) && h < 12) h += 12;
  if (/am/i.test(raw) && h === 12) h = 0;
  if (Number.isNaN(h) || Number.isNaN(mm)) return null;
  return h * 60 + mm;
}

function pickStartMin(a: any): number | null {
  return parseTimeMin(a?.startTime) ?? parseTimeMin(a?.start_time) ?? parseTimeMin(a?.time);
}
function pickEndMin(a: any): number | null {
  return parseTimeMin(a?.endTime) ?? parseTimeMin(a?.end_time);
}

function isBookendSourceLike(a: any): boolean {
  if (!a) return false;
  const src = String(a?.source || '').toLowerCase();
  if (BOOKEND_SOURCE_RE.test(src)) return true;
  const tags = a?.tags;
  if (Array.isArray(tags)) {
    for (const t of tags) {
      if (BOOKEND_SOURCE_RE.test(String(t).toLowerCase())) return true;
    }
  }
  return false;
}

function isLockedLike(a: any): boolean {
  if (!a) return false;
  if (a.isLocked === true || a.locked === true) return true;
  const src = String(a?.source || '').toLowerCase();
  if (
    src === 'user' ||
    src === 'user_added' ||
    src === 'manual' ||
    src === 'extracted' ||
    src === 'pinned'
  ) {
    return true;
  }
  const basis = String(a?.cost?.basis || a?.estimatedCost?.basis || '').toLowerCase();
  if (basis === 'user' || basis === 'user_override' || basis === 'booked') return true;
  return false;
}

function isDepartureLogistics(a: any): boolean {
  if (!a) return false;
  const cat = String(a?.category || '').toLowerCase();
  if (DEPARTURE_LOGISTICS_RE.test(cat)) return true;
  const tags = a?.tags;
  if (Array.isArray(tags)) {
    for (const t of tags) {
      if (DEPARTURE_LOGISTICS_RE.test(String(t).toLowerCase())) return true;
    }
  }
  const title = String(a?.title || a?.name || '').toLowerCase();
  if (/\b(airport|flight|check[-\s]?out)\b/.test(title)) return true;
  return false;
}

function lastEligibleEndMin(activities: readonly any[]): number | null {
  for (let i = activities.length - 1; i >= 0; i--) {
    const a = activities[i];
    if (!a) continue;
    const end = pickEndMin(a) ?? pickStartMin(a);
    if (end === null) continue;
    return end;
  }
  return null;
}

export interface CrossDayBleedResult<TDay = any> {
  days: TDay[];
  movedCount: number;
  changed: boolean;
}

export function assertNoCrossDayBleed<
  TDay extends { dayNumber?: number; activities?: any[] } = any,
>(
  days: readonly TDay[] | null | undefined,
  ctx: { site?: string } = {},
): CrossDayBleedResult<TDay> {
  if (!Array.isArray(days) || days.length < 2) {
    return {
      days: Array.isArray(days) ? [...(days as TDay[])] : [],
      movedCount: 0,
      changed: false,
    };
  }

  const next: TDay[] = days.map((d) => ({
    ...(d as any),
    activities: Array.isArray((d as any)?.activities) ? [...(d as any).activities] : [],
  })) as TDay[];

  let movedCount = 0;

  for (let i = 0; i < next.length - 1; i++) {
    const dayN = next[i] as any;
    const dayNext = next[i + 1] as any;
    if (!Array.isArray(dayN?.activities) || !Array.isArray(dayNext?.activities)) continue;
    if (dayNext.activities.length === 0) continue;

    const tailEnd = lastEligibleEndMin(dayN.activities);
    if (tailEnd === null || tailEnd < TAIL_LATE_THRESHOLD_MIN) continue;

    while (dayNext.activities.length > 0) {
      const head = dayNext.activities[0];
      const headStart = pickStartMin(head);
      if (headStart === null || headStart >= HEAD_PREDAWN_BOUNDARY_MIN) break;
      if (isBookendSourceLike(head)) break;
      if (isLockedLike(head)) break;
      if (isDepartureLogistics(head)) break;

      const moved = { ...head, dayNumber: dayN.dayNumber ?? i + 1 };
      dayN.activities.push(moved);
      dayNext.activities.shift();
      movedCount += 1;

      const title = String((head as any)?.title || (head as any)?.name || '').slice(0, 60);
      const startStr = String(
        (head as any)?.startTime || (head as any)?.start_time || (head as any)?.time || '?',
      );
      // eslint-disable-next-line no-console
      console.log(
        `[DAY1_BLEED_GUARD] day=${i + 2} site=${ctx.site || 'parser'} action=moved_to_prev_day_tail title="${title}" start=${startStr}`,
      );
    }
  }

  return { days: next, movedCount, changed: movedCount > 0 };
}
