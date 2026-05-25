/**
 * Pre-dawn cascade normalizer.
 *
 * Defense layer for the "Day 2 schedule displaced into overnight hours"
 * symptom (Amsterdam: Moco Museum 01:33, walks 03:26 / 06:31). The four
 * upstream prevention layers (`stripBookendsForPrompt`, parser stale-head
 * drop, `dayChronoKey` wrap-aware sort, `Late Night` band) cover bookend
 * leaks and display reordering, but they do NOT reject a real activity that
 * the LLM independently emits at 01:33 on Day N≥2, and they do NOT heal
 * legacy persisted trips that already have those bad timestamps.
 *
 * For Day N≥2, this finds the LEADING block of consecutive non-bookend,
 * non-locked, non-departure-logistics activities whose startTime is in
 * [00:00, 05:00). It shifts the entire block forward so the first card
 * lands at 09:00, preserving relative spacing. The cascade rule
 * (`enforceTimingAndBuffers`) settles any seam with the next card.
 *
 * Locked / `manual` / `extracted` / `pinned` / `user_added` rows AND
 * legitimate bookend-source rows (`bookend-readtime`, `bookend-overnight`,
 * `bookend-validator`, `bookend-synthesized`, `late_nightlife_bookend`)
 * AND departure logistics (`airport-transfer`, `transfer-to-airport`,
 * `flight`, `checkout`) are ALWAYS exempt.
 *
 * Sentinel: `[PREDAWN_CASCADE_NORMALIZE] day=N count=K shiftMin=±M`.
 *
 * See mem://constraints/itinerary/late-nightlife-no-next-day-bleed.
 */

const BOOKEND_SOURCE_RE =
  /^(bookend-readtime|bookend-overnight|bookend-validator|bookend-synthesized|late_nightlife_bookend)$/i;

const PREDAWN_BOUNDARY_MIN = 5 * 60; // [00:00, 05:00)
const TARGET_FIRST_START_MIN = 9 * 60; // 09:00

const DEPARTURE_LOGISTICS_RE =
  /^(airport[-_ ]?transfer|transfer[-_ ]?to[-_ ]?airport|flight|checkout|check[-_ ]?out)$/i;

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
  return (
    parseTimeMin(a?.startTime) ??
    parseTimeMin(a?.start_time) ??
    parseTimeMin(a?.time)
  );
}

function pickEndMin(a: any): number | null {
  return parseTimeMin(a?.endTime) ?? parseTimeMin(a?.end_time);
}

function fmtHM(min: number): string {
  const m = ((min % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
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

const ANCHOR_IMMOVABLE_RE = /^(arrival-flight|airport-transfer)$/i;

function isDepartureLogistics(a: any): boolean {
  if (!a) return false;
  const anchor = String(a?.anchorSource || '').toLowerCase();
  if (ANCHOR_IMMOVABLE_RE.test(anchor)) return true;
  const src = String(a?.source || '').toLowerCase();
  if (src === 'repair-arrival-flight' || src === 'repair-airport-transfer') return true;
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


function isInPredawnWindow(a: any): boolean {
  const m = pickStartMin(a);
  if (m === null) return false;
  return m >= 0 && m < PREDAWN_BOUNDARY_MIN;
}

function shiftActivityTimes<T extends Record<string, any>>(a: T, shiftMin: number): T {
  const next: any = { ...a };
  const startM = pickStartMin(a);
  const endM = pickEndMin(a);
  if (startM !== null) {
    const newStart = fmtHM(startM + shiftMin);
    if (a.startTime !== undefined) next.startTime = newStart;
    if (a.start_time !== undefined) next.start_time = newStart;
    if (a.time !== undefined) next.time = newStart;
    if (a.startTime === undefined && a.start_time === undefined && a.time === undefined) {
      next.startTime = newStart;
    }
  }
  if (endM !== null) {
    const newEnd = fmtHM(endM + shiftMin);
    if (a.endTime !== undefined) next.endTime = newEnd;
    if (a.end_time !== undefined) next.end_time = newEnd;
    if (a.endTime === undefined && a.end_time === undefined) {
      next.endTime = newEnd;
    }
  }
  return next as T;
}

export interface PredawnNormalizeResult<TAct = any> {
  activities: TAct[];
  count: number;
  shiftMin: number;
  changed: boolean;
}

/**
 * Normalize the leading pre-dawn block of a Day N≥2 activities array.
 * Returns `{ activities, count, shiftMin, changed }`. Idempotent.
 *
 * `dayIndex` is 0-based (Day 1 = 0). No-op for `dayIndex === 0`.
 */
export function normalizePredawnCascade<TAct extends Record<string, any> = any>(
  activities: readonly TAct[] | null | undefined,
  dayIndex: number,
  ctx: { dayNumber?: number | string; site?: string } = {},
): PredawnNormalizeResult<TAct> {
  const list = Array.isArray(activities) ? [...activities] : [];
  if (list.length === 0) {
    return { activities: list, count: 0, shiftMin: 0, changed: false };
  }

  // Walk the leading pre-dawn window. Bookend-source rows still break the
  // walk (parser strips those separately and we never shift the bookend
  // itself). Locked / booked / departure-logistics rows are SKIPPED but
  // don't end the walk — that way a single locked museum at 00:30 can't
  // strand the rest of the morning at 03:26 / 06:31. Day 1 is now in
  // scope (no `dayIndex <= 0` early-return) since upstream gen cascades
  // can produce the same bleed on Day 1 too.
  const shiftIdx: number[] = [];
  let firstShiftStart: number | null = null;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (isBookendSourceLike(a)) break;
    if (!isInPredawnWindow(a)) break;
    if (isLockedLike(a) || isDepartureLogistics(a)) continue;
    shiftIdx.push(i);
    if (firstShiftStart === null) firstShiftStart = pickStartMin(a);
  }

  if (shiftIdx.length === 0 || firstShiftStart === null) {
    return { activities: list, count: 0, shiftMin: 0, changed: false };
  }

  const shiftMin = TARGET_FIRST_START_MIN - firstShiftStart;
  if (shiftMin === 0) {
    return { activities: list, count: 0, shiftMin: 0, changed: false };
  }

  const shiftSet = new Set(shiftIdx);
  const next: TAct[] = list.map((a, i) => (shiftSet.has(i) ? shiftActivityTimes(a, shiftMin) : a));

  // eslint-disable-next-line no-console
  console.log(
    `[PREDAWN_CASCADE_NORMALIZE] day=${ctx.dayNumber ?? dayIndex + 1} site=${ctx.site || 'unknown'} count=${shiftIdx.length} shiftMin=${shiftMin >= 0 ? '+' : ''}${shiftMin}`,
  );

  return { activities: next, count: shiftIdx.length, shiftMin, changed: true };
}
