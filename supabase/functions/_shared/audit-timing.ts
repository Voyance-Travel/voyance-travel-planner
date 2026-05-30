/**
 * audit-timing — Canonical READ-ONLY timing auditor.
 *
 * Shared by write-time (`persist-itinerary.ts`) and read-time
 * (`audit-trip-timing/index.ts`) so legacy trips surface the same
 * violation codes a fresh write would catch.
 *
 * NEVER mutates input. NEVER throws. Always returns a typed list of
 * violations with `{ code, dayNumber, activityIds[], detail }`.
 *
 * Closes the three blind spots in the Rome diagnosis:
 *   1) Bad data written before logs existed (read-time pass).
 *   2) Sanitizer rule set too narrow (rules listed below).
 *   3) JSON ↔ normalized-table drift (JSON_TABLE_PARITY rule).
 *
 * Rules (each becomes one AuditCode):
 *   - INVALID_PREDAWN_MEAL        meal at 00:00–05:00 with no late-nightlife signal
 *   - ARRIVAL_SEQUENCE            first non-bookend before arrival flight + buffer
 *   - MEAL_WINDOW                 breakfast >11:00, lunch outside 11:00–15:30, dinner outside 17:30–23:30
 *   - LANDMARK_AFTER_DARK         daylight-only landmark/indoor venue starting after sunset proxy
 *   - MULTIPLE_BOOKEND_RETURNS    more than one "Return to Hotel" row in one day
 *   - JSON_TABLE_PARITY           per-day activity count mismatch JSON vs itinerary_activities
 *   - CROSS_DAY_BLEED             Day N tail ≥22:00 AND Day N+1 head <06:00 (non-bookend)
 *   - INVERTED_WINDOW             endTime < startTime with no legit late-night wrap
 *   - MISSING_DINNER              full day with no dinner (warn-level)
 *   - DUPLICATE_TITLE_SAME_DAY    same venue listed twice in one day
 */

export type AuditCode =
  | 'INVALID_PREDAWN_MEAL'
  | 'ARRIVAL_SEQUENCE'
  | 'MEAL_WINDOW'
  | 'LANDMARK_AFTER_DARK'
  | 'MULTIPLE_BOOKEND_RETURNS'
  | 'JSON_TABLE_PARITY'
  | 'CROSS_DAY_BLEED'
  | 'INVERTED_WINDOW'
  | 'MISSING_DINNER'
  | 'DUPLICATE_TITLE_SAME_DAY'
  // Must-do injection mirror — fires when an injected anchor persisted with
  // empty address AND empty description (bare stub). Closes Amsterdam/Lisbon/
  // Tokyo/Faro/Istanbul/Buenos Aires cohort where 17/18 injected anchors
  // shipped as bare cards. See mem://constraints/itinerary/must-do-coverage-injection.
  | 'MUST_DO_BARE_STUB'
  // Schedule-Executioner mirrors (read-time surfacing of write-time actions).
  | 'EXEC_FLIGHT_ANCHOR_FIXED'
  | 'EXEC_MIDNIGHT_SPILL_TRIMMED'
  | 'EXEC_BUFFER_CASCADE_APPLIED'
  | 'EXEC_GEO_OUTLIER_DROPPED'
  | 'EXEC_GAP_REFILLED';

export type AuditSeverity = 'critical' | 'warn';

export interface AuditViolation {
  code: AuditCode;
  severity: AuditSeverity;
  dayNumber: number;
  activityIds: string[];
  detail: string;
}

export interface AuditTripCtx {
  /** First day's arrival clock (HH:MM 24h). Used by ARRIVAL_SEQUENCE. */
  arrivalTime24?: string | null;
  /** Last day's departure clock (HH:MM 24h). Reserved. */
  departureTime24?: string | null;
  /** Activity row count per `dayNumber` in `itinerary_activities` table. */
  tableActivityCountsByDay?: Record<number, number>;
  /** Trip-level destination, used for diagnostics only. */
  destination?: string | null;
}

export interface AuditResult {
  violations: AuditViolation[];
  jsonDayCount: number;
  jsonActivityCount: number;
  tableDayCount: number;
  tableActivityCount: number;
  parityDelta: number; // |tableActivityCount - jsonActivityCount|
  ranAt: string;
  countsByCode: Record<AuditCode, number>;
}

// ─── helpers (mirror sanitize-schedule-timing, kept pure) ────────────────

const MEAL_TITLE_RE = /\b(breakfast|brunch|lunch|dinner|supper)\b/i;
const HOTEL_RETURN_RE = /\b(return to|head back to|back to|wind down at|retire to|end of day at)\b/i;
const LOCKED_SOURCE_RE = /^(user|user_added|manual|extracted|pinned)$/i;
const INDOOR_DAYLIGHT_CATS = new Set(['museum', 'gallery', 'exhibit', 'exhibition']);
const INDOOR_DAYLIGHT_TITLE_RE = /\b(museum|gallery|chapel|cathedral|vatican|sistine|palace tour|botanical garden|colosseum|pantheon|forum|acropolis|uffizi|louvre|prado|rijksmuseum)\b/i;
const LOGISTICS_TITLE_RE = /\b(flight|airport|transfer|train|departure|arrival)\b/i;

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
function actId(a: any): string {
  return String(a?.id ?? a?.external_id ?? a?.activityId ?? a?.title ?? a?.name ?? '');
}
function title(a: any): string {
  return String(a?.title ?? a?.name ?? '');
}
function cat(a: any): string {
  return String(a?.category ?? '').toLowerCase();
}
function isLogistics(a: any): boolean {
  const c = cat(a);
  if (c === 'transit' || c === 'transport' || c === 'transportation' || c === 'flight' || c === 'logistics' || c === 'transfer') return true;
  return LOGISTICS_TITLE_RE.test(title(a));
}
function isHotelReturnBookend(a: any): boolean {
  const c = cat(a);
  if (c !== 'accommodation' && c !== 'stay' && c !== 'hotel') return false;
  if (HOTEL_RETURN_RE.test(title(a))) return true;
  const src = String(a?.source ?? '').toLowerCase();
  return src.startsWith('bookend-') || src === 'late_nightlife_bookend';
}
function isMealCard(a: any): boolean {
  const c = cat(a);
  if (c === 'dining' || c === 'restaurant' || c === 'food' || c === 'meal') return true;
  return MEAL_TITLE_RE.test(title(a));
}
function isLateNightlifeTagged(a: any): boolean {
  const src = String(a?.source ?? '').toLowerCase();
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
function mealKind(a: any): 'breakfast' | 'brunch' | 'lunch' | 'dinner' | null {
  const t = title(a).toLowerCase();
  if (/\bbreakfast\b/.test(t)) return 'breakfast';
  if (/\bbrunch\b/.test(t)) return 'brunch';
  if (/\blunch\b/.test(t)) return 'lunch';
  if (/\bdinner|supper\b/.test(t)) return 'dinner';
  return null;
}
function isIndoorDaylight(a: any): boolean {
  if (INDOOR_DAYLIGHT_CATS.has(cat(a))) return true;
  return INDOOR_DAYLIGHT_TITLE_RE.test(title(a));
}

// ─── auditors ─────────────────────────────────────────────────────────────

function auditDay(
  day: any,
  dayNumber: number,
  ctx: AuditTripCtx,
  isFirstDay: boolean,
): AuditViolation[] {
  const out: AuditViolation[] = [];
  const acts: any[] = Array.isArray(day?.activities) ? day.activities : [];
  if (acts.length === 0) return out;

  // INVALID_PREDAWN_MEAL — meal at 00:00–05:00 with no late-nightlife signal.
  for (const a of acts) {
    if (!isMealCard(a)) continue;
    const s = pickStart(a);
    if (s === null) continue;
    if (s >= 0 && s < 5 * 60 && !isLateNightlifeTagged(a)) {
      out.push({
        code: 'INVALID_PREDAWN_MEAL',
        severity: 'critical',
        dayNumber,
        activityIds: [actId(a)],
        detail: `${title(a)} starts at ${a?.startTime ?? a?.start_time ?? a?.time} with no late-nightlife signal`,
      });
    }
  }

  // ARRIVAL_SEQUENCE — first non-bookend before arrivalTime + 60min buffer.
  if (isFirstDay && ctx.arrivalTime24) {
    const arr = parseHM(ctx.arrivalTime24);
    if (arr !== null) {
      const buffer = 60;
      const earliest = arr + buffer;
      const sorted = acts
        .filter((a) => !isHotelReturnBookend(a) && !isLogistics(a))
        .map((a) => ({ a, s: pickStart(a) }))
        .filter((x) => x.s !== null) as Array<{ a: any; s: number }>;
      sorted.sort((x, y) => x.s - y.s);
      for (const { a, s } of sorted) {
        if (s < earliest) {
          out.push({
            code: 'ARRIVAL_SEQUENCE',
            severity: 'critical',
            dayNumber,
            activityIds: [actId(a)],
            detail: `${title(a)} starts ${a?.startTime ?? a?.start_time} before arrival+buffer (${ctx.arrivalTime24} + 60m)`,
          });
        }
      }
    }
  }

  // MEAL_WINDOW — wrong-clock meals.
  for (const a of acts) {
    const k = mealKind(a);
    if (!k) continue;
    const s = pickStart(a);
    if (s === null) continue;
    if (isLateNightlifeTagged(a)) continue;
    let bad = false;
    let want = '';
    if (k === 'breakfast' && (s < 5 * 60 || s > 11 * 60)) { bad = true; want = '05:00–11:00'; }
    else if (k === 'brunch' && (s < 9 * 60 || s > 12 * 60 + 30)) { bad = true; want = '09:00–12:30'; }
    else if (k === 'lunch' && (s < 11 * 60 || s > 15 * 60 + 30)) { bad = true; want = '11:00–15:30'; }
    else if (k === 'dinner' && (s < 17 * 60 + 30 || s > 23 * 60 + 30)) { bad = true; want = '17:30–23:30'; }
    if (bad) {
      out.push({
        code: 'MEAL_WINDOW',
        severity: 'critical',
        dayNumber,
        activityIds: [actId(a)],
        detail: `${k} at ${a?.startTime ?? a?.start_time} outside ${want}`,
      });
    }
  }

  // LANDMARK_AFTER_DARK — indoor/daylight venues after 19:00.
  for (const a of acts) {
    if (!isIndoorDaylight(a)) continue;
    const s = pickStart(a);
    if (s === null) continue;
    if (s >= 19 * 60) {
      out.push({
        code: 'LANDMARK_AFTER_DARK',
        severity: 'warn',
        dayNumber,
        activityIds: [actId(a)],
        detail: `${title(a)} starts at ${a?.startTime ?? a?.start_time} (likely closed/dark)`,
      });
    }
  }

  // MULTIPLE_BOOKEND_RETURNS — more than one hotel-return row.
  const bookendIds = acts.filter(isHotelReturnBookend).map(actId);
  if (bookendIds.length > 1) {
    out.push({
      code: 'MULTIPLE_BOOKEND_RETURNS',
      severity: 'critical',
      dayNumber,
      activityIds: bookendIds,
      detail: `${bookendIds.length} hotel-return bookends on the same day`,
    });
  }

  // INVERTED_WINDOW — endTime < startTime that isn't a legit wrap.
  for (const a of acts) {
    const s = pickStart(a);
    const e = pickEnd(a);
    if (s === null || e === null) continue;
    if (e < s) {
      const isLegitWrap = e < 6 * 60 && s >= 18 * 60; // 22:00 → 01:30
      if (!isLegitWrap) {
        out.push({
          code: 'INVERTED_WINDOW',
          severity: 'critical',
          dayNumber,
          activityIds: [actId(a)],
          detail: `${title(a)} end ${a?.endTime ?? a?.end_time} before start ${a?.startTime ?? a?.start_time}`,
        });
      }
    }
  }

  // MISSING_DINNER — full day with no dinner card.
  // Only flag when day has >=3 timed activities (skip arrival/departure days).
  const timed = acts.filter((a) => pickStart(a) !== null && !isHotelReturnBookend(a) && !isLogistics(a));
  if (timed.length >= 3) {
    const hasDinner = acts.some((a) => mealKind(a) === 'dinner');
    if (!hasDinner) {
      out.push({
        code: 'MISSING_DINNER',
        severity: 'warn',
        dayNumber,
        activityIds: [],
        detail: `day has ${timed.length} timed activities but no dinner`,
      });
    }
  }

  // DUPLICATE_TITLE_SAME_DAY.
  const seen = new Map<string, string[]>();
  for (const a of acts) {
    if (isHotelReturnBookend(a) || isLogistics(a)) continue;
    const key = title(a).trim().toLowerCase();
    if (!key) continue;
    const arr = seen.get(key) ?? [];
    arr.push(actId(a));
    seen.set(key, arr);
  }
  for (const [key, ids] of seen.entries()) {
    if (ids.length > 1) {
      out.push({
        code: 'DUPLICATE_TITLE_SAME_DAY',
        severity: 'warn',
        dayNumber,
        activityIds: ids,
        detail: `"${key}" appears ${ids.length}× in the same day`,
      });
    }
  }

  return out;
}

function auditCrossDayBleed(days: any[]): AuditViolation[] {
  const out: AuditViolation[] = [];
  for (let i = 0; i < days.length - 1; i++) {
    const a = days[i];
    const b = days[i + 1];
    const aActs: any[] = Array.isArray(a?.activities) ? a.activities : [];
    const bActs: any[] = Array.isArray(b?.activities) ? b.activities : [];
    if (!aActs.length || !bActs.length) continue;
    const aTailEnd = Math.max(...aActs.map((x) => pickEnd(x) ?? -1));
    if (aTailEnd < 22 * 60) continue;
    const bHead = bActs
      .map((x) => ({ x, s: pickStart(x) }))
      .filter((y) => y.s !== null)
      .sort((p, q) => (p.s as number) - (q.s as number))[0];
    if (!bHead) continue;
    if ((bHead.s as number) < 6 * 60 && !isHotelReturnBookend(bHead.x) && !isLogistics(bHead.x)) {
      out.push({
        code: 'CROSS_DAY_BLEED',
        severity: 'critical',
        dayNumber: typeof b.dayNumber === 'number' ? b.dayNumber : i + 2,
        activityIds: [actId(bHead.x)],
        detail: `${title(bHead.x)} starts ${bHead.x?.startTime} on Day ${i + 2} after prior day ended ≥22:00`,
      });
    }
  }
  return out;
}

function emptyCounts(): Record<AuditCode, number> {
  return {
    INVALID_PREDAWN_MEAL: 0,
    ARRIVAL_SEQUENCE: 0,
    MEAL_WINDOW: 0,
    LANDMARK_AFTER_DARK: 0,
    MULTIPLE_BOOKEND_RETURNS: 0,
    JSON_TABLE_PARITY: 0,
    CROSS_DAY_BLEED: 0,
    INVERTED_WINDOW: 0,
    MISSING_DINNER: 0,
    DUPLICATE_TITLE_SAME_DAY: 0,
    MUST_DO_BARE_STUB: 0,
    EXEC_FLIGHT_ANCHOR_FIXED: 0,
    EXEC_MIDNIGHT_SPILL_TRIMMED: 0,
    EXEC_BUFFER_CASCADE_APPLIED: 0,
    EXEC_GEO_OUTLIER_DROPPED: 0,
    EXEC_GAP_REFILLED: 0,
  };
}

// MUST_DO_BARE_STUB — injected anchor persisted with empty address+description.
function auditMustDoBareStubs(days: any[]): AuditViolation[] {
  const out: AuditViolation[] = [];
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const dn = typeof d?.dayNumber === 'number' ? d.dayNumber : i + 1;
    const acts: any[] = Array.isArray(d?.activities) ? d.activities : [];
    for (const a of acts) {
      const src = String(a?.source ?? '').toLowerCase();
      if (src !== 'must-do-injection') continue;
      const addr = String(a?.location?.address || '').trim();
      const desc = String(a?.description || '').trim();
      if (addr.length === 0 && desc.length === 0) {
        out.push({
          code: 'MUST_DO_BARE_STUB',
          severity: 'warn',
          dayNumber: dn,
          activityIds: [actId(a)],
          detail: `${title(a) || '(untitled)'} persisted with empty address + empty description`,
        });
      }
    }
  }
  return out;
}

/**
 * Main entry. `daysJson` is the array from `trips.itinerary_data.days`.
 * Returns a fully-typed result; never throws.
 */
export function auditTimingViolations(
  daysJson: any[] | null | undefined,
  ctx: AuditTripCtx = {},
): AuditResult {
  const days = Array.isArray(daysJson) ? daysJson : [];
  const all: AuditViolation[] = [];
  let jsonActivityCount = 0;
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const dn = typeof d?.dayNumber === 'number' ? d.dayNumber : i + 1;
    const acts: any[] = Array.isArray(d?.activities) ? d.activities : [];
    jsonActivityCount += acts.length;
    all.push(...auditDay(d, dn, ctx, i === 0));
  }
  all.push(...auditCrossDayBleed(days));

  // JSON_TABLE_PARITY — per-day diff if table counts provided.
  let tableActivityCount = 0;
  let tableDayCount = 0;
  if (ctx.tableActivityCountsByDay) {
    const seenDays = new Set<number>();
    for (const [k, v] of Object.entries(ctx.tableActivityCountsByDay)) {
      const dn = parseInt(k, 10);
      if (!Number.isFinite(dn)) continue;
      seenDays.add(dn);
      tableActivityCount += v ?? 0;
    }
    tableDayCount = seenDays.size;
    for (let i = 0; i < days.length; i++) {
      const d = days[i];
      const dn = typeof d?.dayNumber === 'number' ? d.dayNumber : i + 1;
      const jsonCount = Array.isArray(d?.activities) ? d.activities.length : 0;
      const tableCount = ctx.tableActivityCountsByDay[dn] ?? 0;
      if (jsonCount !== tableCount) {
        all.push({
          code: 'JSON_TABLE_PARITY',
          severity: 'warn',
          dayNumber: dn,
          activityIds: [],
          detail: `JSON has ${jsonCount} activities, itinerary_activities table has ${tableCount}`,
        });
      }
    }
  }

  const counts = emptyCounts();
  for (const v of all) counts[v.code]++;

  return {
    violations: all,
    jsonDayCount: days.length,
    jsonActivityCount,
    tableDayCount,
    tableActivityCount,
    parityDelta: Math.abs(tableActivityCount - jsonActivityCount),
    ranAt: new Date().toISOString(),
    countsByCode: counts,
  };
}

export const __test_only = {
  parseHM, pickStart, pickEnd, isMealCard, isHotelReturnBookend, mealKind, isIndoorDaylight,
};
