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

export type ScheduleSanityCode =
  | 'INVALID_PREDAWN_MEAL'
  | 'ARRIVAL_SEQUENCE_INVALID'
  | 'DUPLICATE_HOTEL_RETURN'
  | 'LANDMARK_AFTER_DARK'
  | 'INVALID_TIME_WRAP';

export interface ScheduleSanityIssue {
  code: ScheduleSanityCode;
  dayNumber: number;
  activityId?: string;
  title?: string;
  detail: string;
  repaired: boolean;
}

export interface ScheduleSanityResult {
  predawnMealsRepaired: number;
  predawnNonLockedDropped: number;
  invalidEndBeforeStartRepaired: number;
  duplicateHotelReturnsRemoved: number;
  fieldDriftRepaired: number;
  arrivalSequenceRepaired: number;
  landmarkAfterDarkFlagged: number;
  adjacentHotelTransitDropped: number;
  issues: ScheduleSanityIssue[];
}


function newResult(): ScheduleSanityResult {
  return {
    predawnMealsRepaired: 0,
    predawnNonLockedDropped: 0,
    invalidEndBeforeStartRepaired: 0,
    duplicateHotelReturnsRemoved: 0,
    fieldDriftRepaired: 0,
    arrivalSequenceRepaired: 0,
    landmarkAfterDarkFlagged: 0,
    adjacentHotelTransitDropped: 0,
    issues: [],
  };
}

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

// Daylight-sensitive categories that cannot start after dark.
// Outdoor landmarks like fountains/squares stay safe after dark, so they are
// NOT in this list — they're handled via the late-cap heuristic instead.
const INDOOR_DAYLIGHT_CATS = new Set([
  'museum', 'gallery', 'exhibit', 'exhibition',
]);
const INDOOR_DAYLIGHT_TITLE_RE = /\b(museum|gallery|chapel|cathedral|vatican|sistine|palace tour|botanical garden)\b/i;
const LATE_CAP_MIN = 17 * 60; // 17:00 — after this, daylight venues become suspect
const HARD_LATE_CAP_MIN = 19 * 60; // 19:00 — almost certainly closed/dark

export interface ScheduleSanityContext {
  /** First day's arrival clock (HH:MM 24h). Used by arrival-sequence repair. */
  arrivalTime24?: string | null;
  /** Last day's departure clock (HH:MM 24h). Reserved for future use. */
  departureTime24?: string | null;
  /** True if this is Day 1 (arrival day) — controls arrival-sequence pass. */
  isFirstDay?: boolean;
  /** True if this is the last day — controls future departure-sequence pass. */
  isLastDay?: boolean;
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
  opts: { dayNumber?: number } & ScheduleSanityContext = {},
): ScheduleSanityResult {
  const out: ScheduleSanityResult = newResult();
  if (!Array.isArray(activities) || activities.length === 0) return out;
  const day = opts.dayNumber ?? '?';
  const dayN = typeof opts.dayNumber === 'number' ? opts.dayNumber : 0;

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
      out.issues.push({
        code: 'INVALID_PREDAWN_MEAL',
        dayNumber: dayN,
        activityId: a.id,
        title: a.title || a.name,
        detail: `${kind || 'meal'} was scheduled in pre-dawn window; moved to ${newStart}.`,
        repaired: true,
      });
      console.log(`[SCHEDULE_SANITY] day=${day} action=predawn_meal_repaired title="${a.title || a.name || ''}" newStart=${newStart}`);
      survivors.push(a);
      continue;
    }

    if (isSightseeing(a)) {
      // Drop pre-dawn sightseeing — there's no safe automatic time to use.
      out.predawnNonLockedDropped++;
      out.issues.push({
        code: 'INVALID_TIME_WRAP',
        dayNumber: dayN,
        activityId: a.id,
        title: a.title || a.name,
        detail: 'Sightseeing started pre-dawn with no late-nightlife signal; dropped.',
        repaired: true,
      });
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

    // Hotel-return / accommodation bookends MUST NEVER wrap past midnight.
    // A "Return to Hotel 21:20 → 05:20" is impossible as a single bookend
    // card — clamp end to 23:59 unconditionally. The late-nightlife branch
    // (00:20 nightcap → 00:50 return) handles legit post-midnight bookends
    // via its own tagged path; those rows have start < 06:00, not 21:20.
    if (isHotelReturnBookend(a)) {
      setEnd(a, '23:59');
      out.invalidEndBeforeStartRepaired++;
      out.issues.push({
        code: 'INVALID_TIME_WRAP',
        dayNumber: dayN,
        activityId: a.id,
        title: a.title || a.name,
        detail: `Hotel-return bookend wrapped past midnight (${fmtHM(s)} → ${fmtHM(e)}); clamped end to 23:59.`,
        repaired: true,
      });
      console.log(`[SCHEDULE_SANITY] day=${day} action=hotel_return_wrap_clamped title="${a.title || a.name || ''}" before=${fmtHM(s)}-${fmtHM(e)} newEnd=23:59`);
      continue;
    }

    // Legit wrap (non-bookend only): late-night card (start >= 21:00)
    // ending in early AM (<06:00), AND explicitly tagged late_nightlife
    // OR matching a nightlife title. Otherwise the wrap is corruption.
    if (s >= 21 * 60 && e < 6 * 60 && isLateNightlifeTagged(a)) continue;

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
    out.issues.push({
      code: 'INVALID_TIME_WRAP',
      dayNumber: dayN,
      activityId: a.id,
      title: a.title || a.name,
      detail: `endTime < startTime; repaired endTime to ${fmtHM(s + dur)}.`,
      repaired: true,
    });
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
      // MUST-DO ANCHOR DROP TELEMETRY — surface root cause for the
      // CDMX `e4217b97…` class where injected anchors silently vanished.
      for (const i of drop) {
        const a = activities[i] as any;
        if (a && (a.source === 'must-do-injection' || a.anchorSource === 'must_do')) {
          console.warn(`[MUST_DO_ANCHOR_DROPPED] day=${dayN} venue="${a.title || a.name || ''}" reason=duplicate_hotel_return site=sanitizeSchedule:dup_hotel_returns id=${a.id || 'n/a'}`);
        }
      }
      const next = activities.filter((_, i) => !drop.has(i));
      activities.length = 0;
      activities.push(...next);
      out.duplicateHotelReturnsRemoved += drop.size;
      out.issues.push({
        code: 'DUPLICATE_HOTEL_RETURN',
        dayNumber: dayN,
        detail: `Dropped ${drop.size} duplicate hotel-return bookend(s); kept the terminal one.`,
        repaired: true,
      });
      console.log(`[SCHEDULE_SANITY] day=${day} action=dup_hotel_returns_removed count=${drop.size}`);
    }
  }

  // ─── Pass 4b: drop adjacent "Travel to <hotel>" transit stubs near a
  // terminal hotel return. Rome Day 1 had a 23:50 transport to the same
  // hotel as the 23:59 terminal return — pure noise.
  {
    const terminalIdx = (() => {
      for (let i = activities.length - 1; i >= 0; i--) {
        if (isHotelReturnBookend(activities[i]) && !isMidwayAccom(activities[i])) return i;
      }
      return -1;
    })();
    if (terminalIdx > 0) {
      const tStart = pickStart(activities[terminalIdx]);
      const drop = new Set<number>();
      for (let i = 0; i < terminalIdx; i++) {
        const a = activities[i];
        if (!a || isLocked(a)) continue;
        const cat = String(a.category || '').toLowerCase();
        const title = String(a.title || a.name || '');
        const isHotelTransit =
          (cat === 'transport' || cat === 'transit' || cat === 'transportation') &&
          /\b(travel to|walk to|taxi to|transfer to)\b/i.test(title) &&
          (HOTEL_RETURN_RE.test(title) || /\b(hotel|riad|resort|hostel|airbnb|accommodation)\b/i.test(title));
        if (!isHotelTransit) continue;
        const s = pickStart(a);
        if (s === null || tStart === null) continue;
        // Within 90 min before the terminal return.
        if (tStart - s <= 90 && tStart - s >= 0) drop.add(i);
      }
      if (drop.size > 0) {
        for (const i of drop) {
          const a = activities[i] as any;
          if (a && (a.source === 'must-do-injection' || a.anchorSource === 'must_do')) {
            console.warn(`[MUST_DO_ANCHOR_DROPPED] day=${dayN} venue="${a.title || a.name || ''}" reason=adjacent_hotel_transit site=sanitizeSchedule:adjacent_hotel_transit id=${a.id || 'n/a'}`);
          }
        }
        const next = activities.filter((_, i) => !drop.has(i));
        activities.length = 0;
        activities.push(...next);
        out.adjacentHotelTransitDropped += drop.size;
        console.log(`[SCHEDULE_SANITY] day=${day} action=adjacent_hotel_transit_dropped count=${drop.size}`);
      }
    }
  }

  // ─── Pass 5: arrival-sequence ordering (Day 1 only) ────────────────────
  // Rome Day 1 had luggage-drop at 05:30 BEFORE arrival flight at 02:30 in
  // normalized tables, and even worse — Roscioli dinner at 00:00 before any
  // arrival logistics in JSON. Anchor on the arrival flight: any luggage
  // drop / check-in / first real activity that starts before the flight ends
  // is invalid. Repair by shifting the offender behind flight end + 60min
  // buffer (or by flagging only when locked).
  if (opts.isFirstDay) {
    const FLIGHT_TITLE_RE = /\b(arrival|arriving|arrives|landing|lands|flight)\b/i;
    const flightIdx = activities.findIndex((a) => {
      const cat = String(a?.category || '').toLowerCase();
      const title = String(a?.title || a?.name || '');
      return cat === 'flight' || /\barrival\s+flight\b/i.test(title) || (FLIGHT_TITLE_RE.test(title) && /\barrival|arrive\b/i.test(title));
    });
    const flight = flightIdx >= 0 ? activities[flightIdx] : null;
    const flightEnd = flight ? pickEnd(flight) : null;
    const arrCtxMin = parseHM(opts.arrivalTime24 || undefined);
    // Anchor min — flightEnd if present, else arrivalTime + 60min.
    const anchorEnd = flightEnd ?? (arrCtxMin !== null ? arrCtxMin + 60 : null);
    if (anchorEnd !== null) {
      for (let i = 0; i < activities.length; i++) {
        const a = activities[i];
        if (!a) continue;
        if (i === flightIdx) continue;
        if (isLogistics(a) && i < flightIdx) {
          // Logistics that aren't arrival flight but precede arrival flight is the bug pattern.
          // Skip cleaning locked rows — surface only.
        }
        const s = pickStart(a);
        if (s === null) continue;
        if (s >= anchorEnd) continue;
        // Activity starts before arrival anchor.
        if (isLocked(a)) {
          out.issues.push({
            code: 'ARRIVAL_SEQUENCE_INVALID',
            dayNumber: dayN,
            activityId: a.id,
            title: a.title || a.name,
            detail: `Starts at ${fmtHM(s)} before arrival anchor ${fmtHM(anchorEnd)}.`,
            repaired: false,
          });
          continue;
        }
        // Compute shifted slot: anchor + 60min buffer + 15min spacing per offender index.
        const e = pickEnd(a);
        const dur = (e !== null && e > s) ? (e - s) : 60;
        const isLuggage = /\b(luggage drop|bag drop|check[-\s]?in)\b/i.test(String(a.title || a.name || ''));
        const newStart = anchorEnd + (isLuggage ? 60 : 90);
        setStart(a, fmtHM(newStart));
        setEnd(a, fmtHM(newStart + Math.min(180, dur)));
        out.arrivalSequenceRepaired++;
        out.issues.push({
          code: 'ARRIVAL_SEQUENCE_INVALID',
          dayNumber: dayN,
          activityId: a.id,
          title: a.title || a.name,
          detail: `Started at ${fmtHM(s)} before arrival anchor ${fmtHM(anchorEnd)}; moved to ${fmtHM(newStart)}.`,
          repaired: true,
        });
        console.log(`[SCHEDULE_SANITY] day=${day} action=arrival_sequence_repaired title="${a.title || a.name || ''}" newStart=${fmtHM(newStart)}`);
      }
    }
  }

  // ─── Pass 6: indoor-daylight landmark after dark (flag only) ───────────
  // Colosseum exterior at 21:30 is fine; Vatican Museums at 21:30 is not.
  // Auto-moving has too high a risk of clobbering legitimate ticket-time
  // anchors, so this pass FLAGS the issue and lets the validator surface it.
  for (const a of activities) {
    if (!a || typeof a !== 'object') continue;
    if (isLocked(a)) continue;
    const cat = String(a.category || '').toLowerCase();
    const title = String(a.title || a.name || '');
    const isDaylightVenue =
      INDOOR_DAYLIGHT_CATS.has(cat) || INDOOR_DAYLIGHT_TITLE_RE.test(title);
    if (!isDaylightVenue) continue;
    const s = pickStart(a);
    if (s === null) continue;
    if (s < LATE_CAP_MIN) continue;
    const sev = s >= HARD_LATE_CAP_MIN ? 'hard' : 'soft';
    out.landmarkAfterDarkFlagged++;
    out.issues.push({
      code: 'LANDMARK_AFTER_DARK',
      dayNumber: dayN,
      activityId: a.id,
      title: a.title || a.name,
      detail: `Indoor daylight venue starts at ${fmtHM(s)} (${sev === 'hard' ? 'after closing' : 'after late-day cap'}).`,
      repaired: false,
    });
    console.log(`[SCHEDULE_SANITY] day=${day} action=landmark_after_dark_flagged title="${title}" start=${fmtHM(s)} sev=${sev}`);
  }

  return out;
}

/**
 * Apply the sanity pass to a `days` array. Returns aggregate counters.
 */
export function sanitizeSchedule(
  days: readonly any[] | null | undefined,
  opts: { site?: string; arrivalTime24?: string | null; departureTime24?: string | null } = {},
): { days: any[]; counters: ScheduleSanityResult; touchedDays: number } {
  const counters: ScheduleSanityResult = newResult();
  const list = Array.isArray(days) ? [...days] : [];
  const totalDays = list.length;
  let touched = 0;
  for (let i = 0; i < list.length; i++) {
    const day = list[i];
    if (!day || !Array.isArray(day.activities)) continue;
    const before = JSON.stringify(day.activities);
    const dayNumber = day.dayNumber ?? i + 1;
    const isFirstDay = dayNumber === 1;
    const isLastDay = dayNumber === totalDays;
    const r = sanitizeDaySchedule(day.activities, {
      dayNumber,
      isFirstDay,
      isLastDay,
      arrivalTime24: isFirstDay ? opts.arrivalTime24 ?? null : null,
      departureTime24: isLastDay ? opts.departureTime24 ?? null : null,
    });
    counters.predawnMealsRepaired += r.predawnMealsRepaired;
    counters.predawnNonLockedDropped += r.predawnNonLockedDropped;
    counters.invalidEndBeforeStartRepaired += r.invalidEndBeforeStartRepaired;
    counters.duplicateHotelReturnsRemoved += r.duplicateHotelReturnsRemoved;
    counters.fieldDriftRepaired += r.fieldDriftRepaired;
    counters.arrivalSequenceRepaired += r.arrivalSequenceRepaired;
    counters.landmarkAfterDarkFlagged += r.landmarkAfterDarkFlagged;
    counters.adjacentHotelTransitDropped += r.adjacentHotelTransitDropped;
    counters.issues.push(...r.issues);
    if (JSON.stringify(day.activities) !== before) touched++;
  }
  const total =
    counters.predawnMealsRepaired +
    counters.predawnNonLockedDropped +
    counters.invalidEndBeforeStartRepaired +
    counters.duplicateHotelReturnsRemoved +
    counters.fieldDriftRepaired +
    counters.arrivalSequenceRepaired +
    counters.landmarkAfterDarkFlagged +
    counters.adjacentHotelTransitDropped;
  if (total > 0 || counters.issues.length > 0) {
    console.log(
      `[SCHEDULE_SANITY_SUMMARY] site=${opts.site || 'unknown'} touchedDays=${touched} ` +
      `predawnMeals=${counters.predawnMealsRepaired} predawnDropped=${counters.predawnNonLockedDropped} ` +
      `endBeforeStart=${counters.invalidEndBeforeStartRepaired} dupReturns=${counters.duplicateHotelReturnsRemoved} ` +
      `fieldDrift=${counters.fieldDriftRepaired} arrivalSeq=${counters.arrivalSequenceRepaired} ` +
      `landmarkAfterDark=${counters.landmarkAfterDarkFlagged} adjHotelTransit=${counters.adjacentHotelTransitDropped} ` +
      `issues=${counters.issues.length}`,
    );
  }
  return { days: list, counters, touchedDays: touched };
}
