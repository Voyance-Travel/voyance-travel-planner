/**
 * Clock-gated must-do scheduler.
 *
 * Given a trip's days + flight clock, picks a (dayNumber, startTime, endTime)
 * for each missing must-do venue, respecting:
 *  - Day 1 arrival buffer (arrival + bufferMins before any sightseeing).
 *  - Day N departure buffer (must end ≥ dep − bufferMins − 60).
 *  - Daylight-only landmarks (default 09:00–17:00) vs after-dark-safe
 *    landmarks (Trevi Fountain, Colosseum exterior, etc — 09:00–21:00).
 *  - Existing activities on the day: skip any half-hour that overlaps a
 *    locked/user/manual row; otherwise float on top (cascade will sort).
 *
 * Pure function — no I/O. Used by `inject-missing-must-dos.ts` at chain-
 * finalization and reusable in seeding paths.
 *
 * See mem://constraints/itinerary/must-do-deterministic-injection.
 */

export interface MustDoSlot {
  venue: string;
  /** Canonical title to write into the card. */
  title: string;
  dayNumber: number;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  durationMinutes: number;
  /** Why this slot was picked — for telemetry. */
  slotReason: string;
  /** Whether the landmark is safe to schedule after dark. */
  afterDarkOk: boolean;
}

export interface ScheduleInput {
  days: Array<{ dayNumber: number; activities?: any[] }>;
  /** "HH:MM" 24h. Day 1 arrival clock. */
  arrivalTime24?: string | null;
  /** "HH:MM" 24h. Day N departure clock. */
  departureTime24?: string | null;
  /** Departure buffer (flight=180, train=120). */
  departureBufferMins?: number;
  /** Arrival buffer (luggage drop etc — default 120). */
  arrivalBufferMins?: number;
  /** Transfer minutes to airport on last day. */
  transferMinsToAirport?: number;
  /** First day = 1; last day = days.length. */
}

// Landmarks that look great after dark — exterior-only, illuminated, public.
// Daylight-only landmarks (museums, interiors) fall through to default.
const AFTER_DARK_OK = new Set<string>([
  'trevi fountain',
  'colosseum',     // exterior only — interior closes ~19:00 but exterior fine
  'pantheon',      // exterior + piazza
  'spanish steps',
  'piazza navona',
  'eiffel tower',
  'tour eiffel',
  'sagrada familia', // illuminated
  'zocalo', 'zócalo', 'plaza de la constitución', // CDMX main square — illuminated
]);

/**
 * Long-haul / half-day excursions requiring a contiguous multi-hour block.
 * These landmarks are typically outside the city center and MUST NOT be
 * crammed into morning-arrival or last-day-departure windows.
 *
 * Lowercase matcher → required minimum contiguous free block (minutes).
 */
const LONG_HAUL_LANDMARKS: Array<{ match: string; minBlock: number }> = [
  { match: 'teotihuacan', minBlock: 360 },  // CDMX — 50km out, ~6h round trip
  { match: 'teotihuacán', minBlock: 360 },
  { match: 'versailles', minBlock: 300 },
  { match: 'pompeii', minBlock: 300 },
  { match: 'herculaneum', minBlock: 270 },
  { match: 'petra', minBlock: 300 },
  { match: 'machu picchu', minBlock: 480 },
  { match: 'giza', minBlock: 300 },
  { match: 'angkor wat', minBlock: 360 },
  { match: 'great wall', minBlock: 360 },
  { match: 'ephesus', minBlock: 300 },
  { match: 'chichen itza', minBlock: 360 },
  { match: 'chichén itzá', minBlock: 360 },
];

function longHaulMinBlock(title: string): number | null {
  const t = title.toLowerCase();
  for (const { match, minBlock } of LONG_HAUL_LANDMARKS) {
    if (t.includes(match)) return minBlock;
  }
  return null;
}

// Default duration per venue keyword.
function defaultDuration(title: string): number {
  const longHaul = longHaulMinBlock(title);
  if (longHaul !== null) return longHaul;
  const t = title.toLowerCase();
  if (/vatican|louvre|prado|uffizi|met museum|sistine/.test(t)) return 210; // long museum block
  if (/museum|gallery/.test(t)) return 120;
  if (/cathedral|basilica|duomo|sagrada|notre dame/.test(t)) return 75;
  if (/fountain|piazza|square|bridge|stairs|steps|tower|monument|zocalo|zócalo/.test(t)) return 45;
  if (/colosseum|forum|acropolis|alhambra/.test(t)) return 150;
  return 90;
}

function parseHHMM(t?: string | null): number | null {
  if (!t || typeof t !== 'string') return null;
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
}

function fmtHHMM(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function isAfterDarkOk(title: string): boolean {
  const t = title.toLowerCase();
  for (const k of AFTER_DARK_OK) {
    if (t.includes(k)) return true;
  }
  return false;
}

interface BusyWindow { start: number; end: number; locked: boolean }

function busyWindows(activities: any[]): BusyWindow[] {
  if (!Array.isArray(activities)) return [];
  const out: BusyWindow[] = [];
  for (const a of activities) {
    const s = parseHHMM(a?.startTime || a?.start_time || a?.time);
    const e = parseHHMM(a?.endTime || a?.end_time);
    if (s === null || e === null || e <= s) continue;
    const locked = !!(a?.isLocked || a?.locked || a?.userAdded || a?.userEdited || a?.extracted || a?.pinned || a?.isManual);
    out.push({ start: s, end: e, locked });
  }
  return out;
}

/** Find the earliest [start, start+dur] window in [winStart, winEnd] that
 *  doesn't overlap a LOCKED busy window. Non-locked overlaps are allowed
 *  (cascade will sort). Returns null if no fit. */
function firstFreeSlot(
  busy: BusyWindow[],
  durationMins: number,
  winStart: number,
  winEnd: number,
): number | null {
  // Granularity 15 minutes.
  const lockedBusy = busy.filter(b => b.locked).sort((a, b) => a.start - b.start);
  let cursor = winStart;
  for (const b of lockedBusy) {
    if (b.end <= cursor) continue;
    if (cursor + durationMins <= b.start) return cursor;
    cursor = Math.max(cursor, b.end);
  }
  if (cursor + durationMins <= winEnd) return cursor;
  return null;
}

interface EligibleDay {
  dayNumber: number;
  earliestStart: number;
  latestEnd: number;
  existingLandmarkCount: number;
  busy: BusyWindow[];
}

function buildEligibleDays(input: ScheduleInput): EligibleDay[] {
  const days = Array.isArray(input.days) ? input.days : [];
  if (days.length === 0) return [];
  const arrival = parseHHMM(input.arrivalTime24 || null);
  const departure = parseHHMM(input.departureTime24 || null);
  const arrBuf = input.arrivalBufferMins ?? 120;
  const depBuf = input.departureBufferMins ?? 180;
  const transfer = input.transferMinsToAirport ?? 60;

  const lastDayNumber = Math.max(...days.map(d => Number(d.dayNumber) || 0));

  return days.map(d => {
    const dn = Number(d.dayNumber) || 0;
    const isFirst = dn === 1;
    const isLast = dn === lastDayNumber;
    let earliest = 9 * 60; // 09:00 default
    let latest = 21 * 60;  // 21:00 default
    if (isFirst && arrival !== null) {
      earliest = Math.max(earliest, arrival + arrBuf);
    }
    if (isLast && departure !== null) {
      latest = Math.min(latest, departure - depBuf - transfer - 30);
    }
    const acts = Array.isArray(d.activities) ? d.activities : [];
    const existingLandmarkCount = acts.filter(a => {
      const cat = String(a?.category || '').toLowerCase();
      return /sight|landmark|monument|museum|gallery|cultural|historic|religious|church|palace|castle/.test(cat);
    }).length;
    return {
      dayNumber: dn,
      earliestStart: earliest,
      latestEnd: latest,
      existingLandmarkCount,
      busy: busyWindows(acts),
    };
  }).filter(d => d.latestEnd - d.earliestStart >= 30);
}

/**
 * Schedule every venue in `missing`. Greedy: per venue, pick the eligible
 * day with the fewest existing landmarks where a free slot exists.
 * Returns one slot per venue (or null if no day can host it).
 */
export function scheduleMustDos(
  missing: string[],
  input: ScheduleInput,
): Array<MustDoSlot | null> {
  const eligible = buildEligibleDays(input);
  const days = Array.isArray(input.days) ? input.days : [];
  const lastDayNumber = days.length > 0 ? Math.max(...days.map(d => Number(d.dayNumber) || 0)) : 0;
  const hasArrivalClock = parseHHMM(input.arrivalTime24 || null) !== null;
  const hasDepartureClock = parseHHMM(input.departureTime24 || null) !== null;
  const out: Array<MustDoSlot | null> = [];

  for (const venue of missing) {
    if (!venue || typeof venue !== 'string') { out.push(null); continue; }
    const title = venue;
    const dur = defaultDuration(title);
    const afterDark = isAfterDarkOk(title);
    // Daylight ceiling 17:00 unless after-dark-safe (then 21:00).
    const venueCeiling = afterDark ? 21 * 60 : 17 * 60;

    // Long-haul excursions (Teotihuacan, Versailles, etc.) require a
    // contiguous multi-hour block AND must skip morning-arrival Day 1 and
    // last-day departure when a flight clock is set. Crammed into a tight
    // window the downstream cascade silently strips them.
    const longHaul = longHaulMinBlock(title);
    const requireLongHaul = longHaul !== null;

    const candidates = [...eligible]
      .filter(d => {
        if (!requireLongHaul) return true;
        // Reject Day 1 if there's an arrival clock (morning-arrival hurts feasibility).
        if (d.dayNumber === 1 && hasArrivalClock) return false;
        // Reject last day if there's a departure clock.
        if (d.dayNumber === lastDayNumber && hasDepartureClock) return false;
        // Require the contiguous free window to be at least longHaul minutes.
        return (d.latestEnd - d.earliestStart) >= longHaul!;
      })
      .sort((a, b) =>
        a.existingLandmarkCount - b.existingLandmarkCount || a.dayNumber - b.dayNumber
      );

    let picked: MustDoSlot | null = null;
    for (const d of candidates) {
      const winEnd = Math.min(d.latestEnd, venueCeiling);
      const start = firstFreeSlot(d.busy, dur, d.earliestStart, winEnd);
      if (start === null) continue;
      picked = {
        venue,
        title,
        dayNumber: d.dayNumber,
        startTime: fmtHHMM(start),
        endTime: fmtHHMM(start + dur),
        durationMinutes: dur,
        slotReason: `day=${d.dayNumber} existingLandmarks=${d.existingLandmarkCount} afterDarkOk=${afterDark}${requireLongHaul ? ` longHaul=${longHaul}m` : ''}`,
        afterDarkOk: afterDark,
      };
      // Reserve so the next must-do doesn't pick the same slot.
      d.busy.push({ start, end: start + dur, locked: true });
      d.existingLandmarkCount += 1;
      break;
    }
    out.push(picked);
  }

  return out;
}

export const __test__ = { defaultDuration, isAfterDarkOk, parseHHMM, fmtHHMM, firstFreeSlot, buildEligibleDays, longHaulMinBlock };
