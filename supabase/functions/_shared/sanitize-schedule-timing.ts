/**
 * sanitize-schedule-timing — Canonical timing sanity pass.
 *
 * Runs as a chokepoint inside `persistTripItinerary` (and may be called
 * directly from generators / save handlers) so no write path can persist
 * obvious timing corruption such as:
 *
 *   • Dinner card starting at 00:00 with endTime 01:15 (Day 1 Rome class)
 *   • Non-locked meal/sightseeing card starting in [00:00, 05:00) on Day 1
 *     when no late-nightlife signal is present
 *   • Multiple "Return to Hotel" bookends on the same day (keep last,
 *     drop earlier non-locked duplicates)
 *   • endTime < startTime that is NOT a legitimate late-night wrap
 *
 * The pass is conservative on purpose: it only repairs or drops things
 * that cannot represent any believable schedule. Locked/manual/extracted/
 * pinned/user/booked rows are NEVER mutated.
 *
 * Returns counts for telemetry. Mutates `activities` in place.
 *
 * Sentinels:
 *   [SCHEDULE_SANITY] day=N action=… title="…"
 */

const MEAL_TITLE_RE = /\b(breakfast|brunch|lunch|dinner|supper)\b/i;
const SIGHT_CATS = new Set([
  'sightseeing', 'culture', 'cultural', 'museum', 'gallery',
  'attraction', 'tour', 'experience', 'shopping',
]);
const LOGISTICS_CATS = new Set([
  'transit', 'transport', 'transportation', 'flight', 'logistics', 'transfer',
]);
const HOTEL_RETURN_RE = /\b(return to|head back to|back to|wind down at|retire to|end of day at)\b/i;

const LOCKED_SOURCE_RE = /^(user|user_added|manual|extracted|pinned)$/i;

function isLocked(a: any): boolean {
  if (!a) return false;
  if (a.isLocked === true || a.locked === true || a.is_locked === true) return true;
  if (a.lock_state === 'locked') return true;
  const src = String(a.source || '').toLowerCase();
  if (LOCKED_SOURCE_RE.test(src)) return true;
  const basis = String(a?.cost?.basis || a?.estimatedCost?.basis || '').toLowerCase();
  if (basis === 'user' || basis === 'user_override' || basis === 'booked') return true;
  return false;
}

function parseHM(raw: unknown): number | null {
  if (typeof raw !== 'string' || !raw) return null;
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
  return h * 60 + mm;
}

function pickStart(a: any): number | null {
  return parseHM(a?.startTime) ?? parseHM(a?.start_time) ?? parseHM(a?.time);
}
function pickEnd(a: any): number | null {
  return parseHM(a?.endTime) ?? parseHM(a?.end_time);
}

function isHotelReturnBookend(a: any): boolean {
  if (!a) return false;
  const cat = String(a.category || '').toLowerCase();
  if (cat !== 'accommodation' && cat !== 'stay' && cat !== 'hotel') return false;
  const title = String(a.title || a.name || '');
  if (HOTEL_RETURN_RE.test(title)) return true;
  // bookend-tagged accommodation rows
  const src = String(a.source || '').toLowerCase();
  if (src.startsWith('bookend-') || src === 'late_nightlife_bookend') return true;
  return false;
}

function isMidwayAccom(a: any): boolean {
  // Freshen-up / luggage drop / check-in: never count as terminal bookend.
  const title = String(a?.title || a?.name || '').toLowerCase();
  return /freshen[-\s]?up|luggage\s+drop|bag\s+drop|check[-\s]?in/i.test(title);
}

function isLogistics(a: any): boolean {
  const cat = String(a?.category || '').toLowerCase();
  if (LOGISTICS_CATS.has(cat)) return true;
  const title = String(a?.title || a?.name || '');
  if (/\b(flight|airport|transfer)\b/i.test(title)) return true;
  return false;
}

function isMealCard(a: any): boolean {
  const cat = String(a?.category || '').toLowerCase();
  if (cat === 'dining' || cat === 'restaurant' || cat === 'food' || cat === 'meal') return true;
  const title = String(a?.title || a?.name || '');
  return MEAL_TITLE_RE.test(title);
}

function isSightseeing(a: any): boolean {
  const cat = String(a?.category || '').toLowerCase();
  if (SIGHT_CATS.has(cat)) return true;
  return false;
}

function isLateNightlifeTagged(a: any): boolean {
  const src = String(a?.source || '').toLowerCase();
  if (src === 'late_nightlife_bookend') return true;
  const tags = a?.tags;
  if (Array.isArray(tags)) {
    for (const t of tags) {
      const s = String(t).toLowerCase();
      if (s === 'late_nightlife_bookend' || s === 'nightlife' || s === 'nightcap') return true;
    }
  }
  return false;
}

export interface ScheduleSanityResult {
  predawnMealsRepaired: number;
  predawnNonLockedDropped: number;
  invalidEndBeforeStartRepaired: number;
  duplicateHotelReturnsRemoved: number;
  fieldDriftRepaired: number;
}

const DEFAULT_RESULT: ScheduleSanityResult = {
  predawnMealsRepaired: 0,
  predawnNonLockedDropped: 0,
  invalidEndBeforeStartRepaired: 0,
  duplicateHotelReturnsRemoved: 0,
  fieldDriftRepaired: 0,
};

function setStart(a: any, hhmm: string) {
  a.startTime = hhmm;
  a.start_time = hhmm;
  a.time = hhmm;
}
function setEnd(a: any, hhmm: string) {
  a.endTime = hhmm;
  a.end_time = hhmm;
}
function fmtHM(min: number): string {
  const m = ((min % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * Run the per-day sanity pass. Mutates `activities` in place.
 *
 * Locked / manual / extracted / pinned / booked rows are NEVER mutated.
 * Logistics (flight / airport / transfer / checkout) ARE allowed in the
 * pre-dawn window because real flights land at 03:00.
 */
export function sanitizeDaySchedule(
  activities: any[],
  opts: { dayNumber?: number } = {},
): ScheduleSanityResult {
  const out: ScheduleSanityResult = { ...DEFAULT_RESULT };
  if (!Array.isArray(activities) || activities.length === 0) return out;
  const day = opts.dayNumber ?? '?';

  // ─── Pass 1: reconcile field drift between startTime/start_time/time ───
  // When startTime/start_time/time disagree (e.g. Rome Day 1 dinner has
  // startTime=00:00, time=20:15 implied by end_time=20:15 vs endTime=01:15),
  // prefer the value that yields a non-inverted [start, end] window.
  for (const a of activities) {
    if (!a || typeof a !== 'object') continue;
    if (isLocked(a)) continue;
    const s = parseHM(a.startTime);
    const sAlt = parseHM(a.start_time) ?? parseHM(a.time);
    const e = parseHM(a.endTime);
    const eAlt = parseHM(a.end_time);
    // Repair end alias drift
    if (e !== null && eAlt !== null && e !== eAlt) {
      // Trust the value that gives a sane window relative to start.
      const startCandidate = s ?? sAlt;
      if (startCandidate !== null) {
        const useE = (e > startCandidate) ? e : (eAlt > startCandidate ? eAlt : Math.max(e, eAlt));
        setEnd(a, fmtHM(useE));
        out.fieldDriftRepaired++;
        console.log(`[SCHEDULE_SANITY] day=${day} action=end_alias_drift_repaired title="${a.title || a.name || ''}" used=${fmtHM(useE)}`);
      }
    }
    // Repair start alias drift
    if (s !== null && sAlt !== null && s !== sAlt) {
      const endCandidate = parseHM(a.endTime) ?? parseHM(a.end_time);
      // Prefer the value that yields start < end (with allowance for wrap).
      let useS = s;
      if (endCandidate !== null) {
        const sValid = s < endCandidate || (endCandidate < 6 * 60 && s >= 18 * 60);
        const sAltValid = sAlt < endCandidate || (endCandidate < 6 * 60 && sAlt >= 18 * 60);
        if (!sValid && sAltValid) useS = sAlt;
      }
      setStart(a, fmtHM(useS));
      out.fieldDriftRepaired++;
      console.log(`[SCHEDULE_SANITY] day=${day} action=start_alias_drift_repaired title="${a.title || a.name || ''}" used=${fmtHM(useS)}`);
    }
  }

  // ─── Pass 2: pre-dawn meals/sightseeing on non-locked rows ─────────────
  // Meals scheduled at 00:00–05:00 with no late-nightlife signal are
  // almost always corruption. Repair into a believable slot.
  const SLOT_BY_KIND: Record<string, string> = {
    breakfast: '08:30',
    brunch: '11:00',
    lunch: '13:00',
    dinner: '19:30',
    supper: '19:30',
  };
  const survivors: any[] = [];
  for (const a of activities) {
    if (!a || typeof a !== 'object') { survivors.push(a); continue; }
    if (isLocked(a)) { survivors.push(a); continue; }
    const s = pickStart(a);
    if (s === null || s >= 5 * 60) { survivors.push(a); continue; }
    if (isLogistics(a)) { survivors.push(a); continue; }
    if (isLateNightlifeTagged(a)) { survivors.push(a); continue; }

    if (isMealCard(a)) {
      const title = String(a.title || a.name || '').toLowerCase();
      const kind = (['breakfast', 'brunch', 'lunch', 'dinner', 'supper'] as const).find(k => title.includes(k));
      const newStart = SLOT_BY_KIND[kind || 'dinner'] || '19:30';
      const newStartMin = parseHM(newStart)!;
      const e = pickEnd(a);
      const dur = (e !== null && e > s) ? Math.min(180, e - s) : 75;
      setStart(a, newStart);
      setEnd(a, fmtHM(newStartMin + dur));
      out.predawnMealsRepaired++;
      console.log(`[SCHEDULE_SANITY] day=${day} action=predawn_meal_repaired title="${a.title || a.name || ''}" newStart=${newStart}`);
      survivors.push(a);
      continue;
    }

    if (isSightseeing(a)) {
      // Drop pre-dawn sightseeing — there's no safe automatic time to use.
      out.predawnNonLockedDropped++;
      console.log(`[SCHEDULE_SANITY] day=${day} action=predawn_sightseeing_dropped title="${a.title || a.name || ''}"`);
      continue;
    }

    survivors.push(a);
  }
  if (survivors.length !== activities.length) {
    activities.length = 0;
    activities.push(...survivors);
  }

  // ─── Pass 3: endTime < startTime that is not a legit wrap ──────────────
  for (const a of activities) {
    if (!a || typeof a !== 'object') continue;
    if (isLocked(a)) continue;
    const s = pickStart(a);
    const e = pickEnd(a);
    if (s === null || e === null) continue;
    if (e >= s) continue;
    // Legit wrap: late-night card (start >= 21:00) ending in early AM (<06:00)
    if (s >= 21 * 60 && e < 6 * 60) continue;
    // Otherwise: assume the end is right and shift start back to a sane offset,
    // OR if end-before-start is huge (e.g. start 00:00, end 01:15 — would
    // already be a wrap), use a reasonable +75min from start.
    const dur = Math.min(180, Math.max(30, (e + 24 * 60 - s) % (24 * 60)));
    if (s < 6 * 60 && e < 6 * 60) {
      // Both in pre-dawn: treat as drop candidate handled above; skip.
      continue;
    }
    setEnd(a, fmtHM(s + dur));
    out.invalidEndBeforeStartRepaired++;
    console.log(`[SCHEDULE_SANITY] day=${day} action=end_before_start_repaired title="${a.title || a.name || ''}" newEnd=${fmtHM(s + dur)}`);
  }

  // ─── Pass 4: collapse duplicate hotel-return bookends ──────────────────
  // Keep the LAST one; drop earlier non-locked duplicates.
  const returnIdx: number[] = [];
  for (let i = 0; i < activities.length; i++) {
    const a = activities[i];
    if (isHotelReturnBookend(a) && !isMidwayAccom(a)) returnIdx.push(i);
  }
  if (returnIdx.length > 1) {
    const keep = returnIdx[returnIdx.length - 1];
    const drop = new Set<number>();
    for (const i of returnIdx) {
      if (i === keep) continue;
      if (isLocked(activities[i])) continue;
      drop.add(i);
    }
    if (drop.size > 0) {
      const next = activities.filter((_, i) => !drop.has(i));
      activities.length = 0;
      activities.push(...next);
      out.duplicateHotelReturnsRemoved += drop.size;
      console.log(`[SCHEDULE_SANITY] day=${day} action=dup_hotel_returns_removed count=${drop.size}`);
    }
  }

  return out;
}

/**
 * Apply the sanity pass to a `days` array. Returns aggregate counters.
 */
export function sanitizeSchedule(
  days: readonly any[] | null | undefined,
  opts: { site?: string } = {},
): { days: any[]; counters: ScheduleSanityResult; touchedDays: number } {
  const counters: ScheduleSanityResult = { ...DEFAULT_RESULT };
  const list = Array.isArray(days) ? [...days] : [];
  let touched = 0;
  for (let i = 0; i < list.length; i++) {
    const day = list[i];
    if (!day || !Array.isArray(day.activities)) continue;
    const before = JSON.stringify(day.activities);
    const dayNumber = day.dayNumber ?? i + 1;
    const r = sanitizeDaySchedule(day.activities, { dayNumber });
    counters.predawnMealsRepaired += r.predawnMealsRepaired;
    counters.predawnNonLockedDropped += r.predawnNonLockedDropped;
    counters.invalidEndBeforeStartRepaired += r.invalidEndBeforeStartRepaired;
    counters.duplicateHotelReturnsRemoved += r.duplicateHotelReturnsRemoved;
    counters.fieldDriftRepaired += r.fieldDriftRepaired;
    if (JSON.stringify(day.activities) !== before) touched++;
  }
  const total =
    counters.predawnMealsRepaired +
    counters.predawnNonLockedDropped +
    counters.invalidEndBeforeStartRepaired +
    counters.duplicateHotelReturnsRemoved +
    counters.fieldDriftRepaired;
  if (total > 0) {
    console.log(
      `[SCHEDULE_SANITY_SUMMARY] site=${opts.site || 'unknown'} touchedDays=${touched} ` +
      `predawnMeals=${counters.predawnMealsRepaired} predawnDropped=${counters.predawnNonLockedDropped} ` +
      `endBeforeStart=${counters.invalidEndBeforeStartRepaired} dupReturns=${counters.duplicateHotelReturnsRemoved} ` +
      `fieldDrift=${counters.fieldDriftRepaired}`,
    );
  }
  return { days: list, counters, touchedDays: touched };
}
