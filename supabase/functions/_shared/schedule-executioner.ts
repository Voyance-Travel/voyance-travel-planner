/**
 * schedule-executioner — deterministic scheduling enforcement layer.
 *
 * Sits AFTER the AI generator, repair/quality/gap-fill passes, and BEFORE
 * persist + response. Acts on hard truth (flight times, clocks, coords) —
 * never re-prompts the model. The "Executioner": defects are either
 * repaired in place or marked for refill — they never ship raw.
 *
 * Closes:
 *   1A — flight arrival anchor drifts (Tokyo flight 22:00 vs generated 21:30)
 *   1B — silent midnight bleed (Golden Gai 22:55→00:55 + hotel return 01:20)
 *   1C — buffer-conflict warnings shipped despite cascade ability to fix them
 *   1D — geo outlier in themed neighborhood day (Senso-ji on Shinjuku day)
 *
 * Universal-Locking respected: locked/user/manual/extracted/pinned/booked
 * activities are NEVER mutated or dropped.
 *
 * Telemetry: counters returned and stamped at
 *   day.metadata.quality.executioner = { ... }
 */

import {
  parseTime,
  enforceTimingAndBuffers,
  haversineMeters,
  type CascadeActivity,
} from './timing-cascade.ts';
import { qualifiesAsLateNightlife } from './late-nightlife-predicate.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ExecutionerCode =
  | 'FLIGHT_ANCHOR_MISMATCH'
  | 'MIDNIGHT_SPILLOVER_ALLOWED'
  | 'MIDNIGHT_SPILLOVER_DROPPED'
  | 'BUFFER_CASCADE_REPAIRED'
  | 'GEO_OUTLIER'
  | 'GAP_REFILLED'
  | 'AIRPORT_LOOP_DROPPED'
  | 'TRANSFER_DURATION_CLAMPED'
  | 'DEPARTURE_TRANSFER_WITHOUT_CLOCK';

export interface ExecutionerIssue {
  code: ExecutionerCode;
  activityId?: string;
  title?: string;
  detail: string;
  repaired: boolean;
}

export interface ExecutionerCounters {
  flightAnchorRepaired: number;
  midnightSpilloversAllowed: number;
  midnightSpilloversDropped: number;
  bufferRepairs: number;
  overlapRepairs: number;
  transitRecomputed: number;
  geoOutliersFlagged: number;
  geoOutliersDropped: number;
  airportLoopsDropped: number;
  transfersClamped: number;
  departureTransfersStripped: number;
  droppedActivities: number;
  gapsRefilled: number;
  issues: ExecutionerIssue[];
}

export interface ExecutionerContext {
  dayNumber: number;
  totalDays: number;
  isFirstDay: boolean;
  isLastDay: boolean;
  /** Truth arrival clock (HH:MM 24h) from flight_selection's destination-arrival leg. */
  arrivalTime24?: string | null;
  /** Truth departure clock (HH:MM 24h). */
  departureTime24?: string | null;
  /** Day title for geo coherence keyword matching. */
  dayTitle?: string | null;
  /** Budget tier — drives geo outlier distance tolerance. */
  budgetTier?: string | null;
  /** When true the geo coherence pass only flags, never drops. */
  geoFlagOnly?: boolean;
  /**
   * Hard override: when true, geo coherence WILL drop outliers regardless of
   * geoFlagOnly. Wired from env `EXECUTIONER_GEO_DROP_ENABLED=true` once
   * telemetry shows <2% false-positive rate.
   */
  geoDropEnabled?: boolean;
}

export interface ExecutionerResult {
  activities: any[];
  counters: ExecutionerCounters;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const LOCKED_SOURCE_RE = /^(user|user_added|manual|extracted|pinned|booked|imported)$/i;
const ARRIVAL_TITLE_RE = /\b(arrival|landing|land\s+at|inbound)\b.*\b(flight|airport)\b|\b(arrival|flight\s+arrival)\b/i;
const AIRPORT_TRANSFER_RE = /\b(airport\s+transfer|transfer\s+(to|from)\s+(your\s+)?hotel|airport\s+(pickup|pick[- ]up))\b/i;
const HOTEL_TITLE_RE = /\b(hotel|check[-\s]?in|check[-\s]?out|return to|head back to|wind down)\b/i;
const LOGISTICS_CATS = new Set(['transit', 'transport', 'transportation', 'flight', 'logistics', 'transfer', 'accommodation', 'stay', 'hotel', 'lodging']);

/**
 * Truly immutable: user-touched, manually added, imported from a booking,
 * or pinned. NEVER includes system-emitted anchors (arrival-flight /
 * airport-transfer / check-in), which the Executioner is allowed to repair
 * against flight/hotel truth.
 */
function isUserOwned(a: any): boolean {
  if (!a) return false;
  if (a.userAdded || a.userEdited || a.isManual || a.extracted || a.pinned) return true;
  const src = String(a.source || '').toLowerCase();
  if (LOCKED_SOURCE_RE.test(src)) return true;
  const basis = String(a?.cost?.basis || a?.estimatedCost?.basis || '').toLowerCase();
  if (basis === 'user' || basis === 'user_override' || basis === 'booked') return true;
  return false;
}

/**
 * General "do not move" guard. Used by passes where preserving locked
 * non-anchor cards matters (geo, midnight). Flight-anchor and impossible-
 * logistics passes use `isUserOwned` instead so they CAN repair system
 * anchors whose `isLocked=true` was stamped by anchor-guard.
 */
function isLocked(a: any): boolean {
  if (!a) return false;
  if (isUserOwned(a)) return true;
  // Non-user-owned isLocked=true is treated as moveable by truth-repair
  // passes (anchor-guard stamps system anchors as locked). Other passes
  // still get the "don't touch" semantics via this fn.
  if (a.isLocked === true || a.locked === true || a.is_locked === true) return true;
  if (a.lock_state === 'locked') return true;
  return false;
}

function pickStart(a: any): number | null {
  const v = a?.startTime ?? a?.start_time ?? a?.time;
  return typeof v === 'string' ? parseTime(v) : null;
}
function pickEnd(a: any): number | null {
  const v = a?.endTime ?? a?.end_time;
  return typeof v === 'string' ? parseTime(v) : null;
}
function fmtHM(min: number): string {
  const m = ((min % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
function setStart(a: any, hhmm: string) { a.startTime = hhmm; a.start_time = hhmm; a.time = hhmm; }
function setEnd(a: any, hhmm: string) { a.endTime = hhmm; a.end_time = hhmm; }

function actId(a: any): string {
  return String(a?.id ?? a?.external_id ?? a?.activityId ?? a?.title ?? '');
}
function title(a: any): string {
  return String(a?.title ?? a?.name ?? '');
}
function isArrivalCard(a: any): boolean {
  const t = title(a);
  const anchor = String(a?.anchorSource || '').toLowerCase();
  if (anchor === 'arrival-flight') return true;
  if (ARRIVAL_TITLE_RE.test(t)) return true;
  const cat = String(a?.category || '').toLowerCase();
  if (cat === 'flight' && /\barriv|landing\b/i.test(t)) return true;
  return false;
}
function isAirportTransfer(a: any): boolean {
  const t = title(a);
  if (AIRPORT_TRANSFER_RE.test(t)) return true;
  const anchor = String(a?.anchorSource || '').toLowerCase();
  return anchor === 'airport-transfer';
}
function isLogistics(a: any): boolean {
  const cat = String(a?.category || '').toLowerCase();
  if (LOGISTICS_CATS.has(cat)) return true;
  const t = title(a);
  if (/\b(flight|airport|transfer|check[-\s]?in|check[-\s]?out)\b/i.test(t)) return true;
  return false;
}

function extractCoords(a: any): { lat: number; lng: number } | null {
  const lat = a?.location?.lat ?? a?.coordinates?.lat ?? a?.lat;
  const lng = a?.location?.lng ?? a?.coordinates?.lng ?? a?.lng;
  if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }
  return null;
}

function newCounters(): ExecutionerCounters {
  return {
    flightAnchorRepaired: 0,
    midnightSpilloversAllowed: 0,
    midnightSpilloversDropped: 0,
    bufferRepairs: 0,
    overlapRepairs: 0,
    transitRecomputed: 0,
    geoOutliersFlagged: 0,
    geoOutliersDropped: 0,
    airportLoopsDropped: 0,
    transfersClamped: 0,
    departureTransfersStripped: 0,
    droppedActivities: 0,
    gapsRefilled: 0,
    issues: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pass 1 — Flight anchor enforcement
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Day 1 only. If a generated arrival/airport card disagrees with the flight
 * truth, retime it to the truth. If no arrival card exists, do nothing —
 * the generator/anchor-guard already handles injection.
 *
 * Also drops any non-logistics, non-locked card that starts before the
 * arrival clock (LLM occasionally schedules sightseeing at noon for a
 * 22:00 arrival). The existing 2h buffer pass widens this; we just close
 * the strict-pre-arrival case here for transparency.
 */
export function enforceFlightAnchors(
  activities: any[],
  ctx: ExecutionerContext,
  counters: ExecutionerCounters,
): any[] {
  if (!ctx.isFirstDay || !ctx.arrivalTime24) return activities;
  const truthMin = parseTime(ctx.arrivalTime24);
  if (truthMin === null) return activities;
  const TOLERANCE = 5;

  for (const a of activities) {
    if (!a || isUserOwned(a)) continue;
    if (!isArrivalCard(a)) continue;
    const startMin = pickStart(a);
    const endMin = pickEnd(a);
    if (startMin === null && endMin === null) continue;
    const stamped = startMin ?? endMin!;
    if (Math.abs(stamped - truthMin) <= TOLERANCE) continue;

    const before = `${a.startTime ?? a.start_time ?? a.time ?? ''}`;
    const beforeEnd = `${a.endTime ?? a.end_time ?? ''}`;
    setStart(a, ctx.arrivalTime24);
    // Preserve duration when it's a *plausible* landing-block duration.
    // If the AI stamped a 2-hour "Arrival in X" with a wrong start, treat it
    // as a stale convention and collapse to a short 15-min landing block —
    // the actual airport-transfer card handles the trip-to-hotel time.
    let dur = (startMin !== null && endMin !== null && endMin > startMin)
      ? (endMin - startMin)
      : 15;
    if (dur > 30) dur = 15;
    setEnd(a, fmtHM(truthMin + dur));
    counters.flightAnchorRepaired++;
    counters.issues.push({
      code: 'FLIGHT_ANCHOR_MISMATCH',
      activityId: actId(a),
      title: title(a),
      detail: `Arrival card retimed ${before}→${beforeEnd} to ${ctx.arrivalTime24}→${a.endTime} (flight truth)`,
      repaired: true,
    });
    console.log(`[EXECUTIONER] FLIGHT_ANCHOR_MISMATCH day=${ctx.dayNumber} title="${title(a)}" was=${before}→${beforeEnd} truth=${ctx.arrivalTime24}→${a.endTime}`);
  }

  // Drop any non-locked, non-logistics card that starts strictly before the
  // arrival truth. The wider 2h buffer is enforced elsewhere — this is the
  // pure-pre-arrival safety net.
  const before = activities.length;
  const survivors = activities.filter((a) => {
    if (!a || isLocked(a)) return true;
    if (isArrivalCard(a) || isAirportTransfer(a) || isLogistics(a)) return true;
    const s = pickStart(a);
    if (s === null) return true;
    if (s < truthMin) {
      counters.droppedActivities++;
      counters.issues.push({
        code: 'FLIGHT_ANCHOR_MISMATCH',
        activityId: actId(a),
        title: title(a),
        detail: `Dropped non-logistics card starting before arrival (${a.startTime ?? a.start_time} < ${ctx.arrivalTime24})`,
        repaired: true,
      });
      console.log(`[EXECUTIONER] pre-arrival drop day=${ctx.dayNumber} title="${title(a)}" start=${a.startTime}`);
      return false;
    }
    return true;
  });
  if (survivors.length !== before) {
    activities.length = 0;
    activities.push(...survivors);
  }
  return activities;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pass 2 — Midnight spillover handling
// ─────────────────────────────────────────────────────────────────────────────

const NIGHTLIFE_TITLE_RE = /\b(bar|club|speakeasy|cocktail|nightcap|nightclub|lounge|live\s+music|jazz|nightlife|izakaya|golden\s+gai|after[-\s]?party)\b/i;

function isNightlife(a: any): boolean {
  const cat = String(a?.category || '').toLowerCase();
  if (cat === 'nightlife' || cat === 'bar' || cat === 'evening') return true;
  return NIGHTLIFE_TITLE_RE.test(title(a));
}

/**
 * For each activity:
 *  - If endTime < startTime (wrap past midnight), allow ONLY when the row is
 *    bona-fide nightlife (nightclub/speakeasy/bar/late-nightlife bookend).
 *  - Allowed spills: stamp `metadata.spillsPastMidnight = true` +
 *    `spilloverMinutes` so the UI/health can render "continues past midnight"
 *    instead of silently sorting them next-day.
 *  - Disallowed wraps that are non-locked, non-logistics → clamp endTime to
 *    23:59 (the universal late-cap) so the day visibly ends in-day.
 */
export function enforceMidnightSpill(
  activities: any[],
  ctx: ExecutionerContext,
  counters: ExecutionerCounters,
): any[] {
  for (const a of activities) {
    if (!a) continue;
    const s = pickStart(a);
    const e = pickEnd(a);
    if (s === null || e === null) continue;
    if (e >= s) continue; // not a wrap

    // Pass nulls so qualifiesAsLateNightlife only uses title/category — the
    // time-anchored fallback inside that predicate would over-allow any
    // late wrap (e.g. a museum at 23:30→00:30) and defeat the safety net.
    const allowed = isNightlife(a) || qualifiesAsLateNightlife(a, null, null);
    if (allowed) {
      const spillMin = e; // minutes since midnight on next day
      a.metadata = a.metadata || {};
      a.metadata.spillsPastMidnight = true;
      a.metadata.spilloverMinutes = spillMin;
      counters.midnightSpilloversAllowed++;
      counters.issues.push({
        code: 'MIDNIGHT_SPILLOVER_ALLOWED',
        activityId: actId(a),
        title: title(a),
        detail: `Allowed late-night spill ${a.startTime ?? a.start_time}→${a.endTime ?? a.end_time} (+${spillMin}m past midnight)`,
        repaired: false,
      });
      console.log(`[EXECUTIONER] MIDNIGHT_SPILLOVER_ALLOWED day=${ctx.dayNumber} title="${title(a)}" spill=${spillMin}m`);
      continue;
    }
    if (isLocked(a)) continue;

    // Disallowed wrap → clamp to in-day. Prefer clamping endTime to start+dur
    // capped at 23:59, never the start (which is well-defined).
    const beforeEnd = `${a.endTime ?? a.end_time ?? ''}`;
    const clamped = Math.min(23 * 60 + 59, s + 60);
    setEnd(a, fmtHM(clamped));
    counters.midnightSpilloversDropped++;
    counters.issues.push({
      code: 'MIDNIGHT_SPILLOVER_DROPPED',
      activityId: actId(a),
      title: title(a),
      detail: `Clamped invalid past-midnight wrap (${a.startTime ?? a.start_time}→${beforeEnd}) to ${a.endTime}`,
      repaired: true,
    });
    console.log(`[EXECUTIONER] MIDNIGHT_SPILLOVER_DROPPED day=${ctx.dayNumber} title="${title(a)}" end=${beforeEnd}→${a.endTime}`);
  }
  return activities;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pass 3 — Buffer + overlap cascade (response-path parity with persist)
// ─────────────────────────────────────────────────────────────────────────────

export function enforceBufferCascade(
  activities: any[],
  ctx: ExecutionerContext,
  counters: ExecutionerCounters,
): any[] {
  if (!Array.isArray(activities) || activities.length < 2) return activities;
  const lockedIds = new Set<string>(
    activities.filter((a: any) => isLocked(a)).map((a: any) => String(a.id || '')).filter(Boolean),
  );
  try {
    const res = enforceTimingAndBuffers(activities as CascadeActivity[], { lockedIds });
    if (res.repairs.length > 0) {
      for (const r of res.repairs) {
        if (r.type === 'buffer_fix') counters.bufferRepairs++;
        else if (r.type === 'overlap_fix' || r.type === 'same_start_fix') counters.overlapRepairs++;
        else if (r.type === 'transit_recomputed') counters.transitRecomputed++;
      }
      if (counters.bufferRepairs + counters.overlapRepairs > 0) {
        counters.issues.push({
          code: 'BUFFER_CASCADE_REPAIRED',
          detail: `Cascade repaired ${counters.bufferRepairs} buffer + ${counters.overlapRepairs} overlap`,
          repaired: true,
        });
      }
      console.log(`[EXECUTIONER] BUFFER_CASCADE day=${ctx.dayNumber} buffer=${counters.bufferRepairs} overlap=${counters.overlapRepairs} transit=${counters.transitRecomputed}`);
      return res.activities as any[];
    }
  } catch (e) {
    console.warn(`[EXECUTIONER] cascade failed day=${ctx.dayNumber}:`, e);
  }
  return activities;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pass 4 — Geographic coherence
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract neighborhood tokens from the day title. "Shinjuku Soul & Hidden
 * Alleys" → ["shinjuku"]. We deliberately keep this small and additive —
 * just enough to flag a Senso-ji card on a Shinjuku-themed day.
 */
function neighborhoodTokensFromTitle(dayTitle?: string | null): string[] {
  if (!dayTitle) return [];
  // Strip stop-words / decorative phrases.
  const cleaned = dayTitle
    .toLowerCase()
    .replace(/[&:|—–\-]+/g, ' ')
    .replace(/\b(day|morning|afternoon|evening|night|tour|walk|stroll|exploration|hidden|soul|food|culture|of|the|and|in|on|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return [];
  // Keep proper-noun-ish tokens (length ≥ 4, alphabetic).
  return cleaned.split(' ').filter((t) => t.length >= 4 && /^[a-zà-ÿ]+$/i.test(t));
}

function neighborhoodOf(a: any): string {
  return String(
    a?.neighborhood ??
      a?.location?.neighborhood ??
      a?.location?.address ??
      a?.address ??
      '',
  ).toLowerCase();
}

/**
 * Flag (and optionally drop) activities that don't belong with the cluster
 * the day is themed around. Two signals:
 *   1. Day title mentions a neighborhood; activity neighborhood/address
 *      doesn't contain it AND doesn't share coords within the cluster.
 *   2. Coord-based: activity sits > N meters from the median of the
 *      day's other non-logistics activities.
 *
 * Drops are conservative: only when ALL of {non-locked, non-logistics, not
 * a must-do anchor, signal is strong}. Other outliers are flagged only.
 * Refill is the caller's job — we set `needsRefill = true` on the dropped
 * activity for the cleanup/refill chain to pick up.
 */
export function enforceGeoCoherence(
  activities: any[],
  ctx: ExecutionerContext,
  counters: ExecutionerCounters,
): any[] {
  const tokens = neighborhoodTokensFromTitle(ctx.dayTitle);
  if (tokens.length === 0 && activities.length < 4) return activities;

  // Build the cluster centroid from non-logistics activities that have coords.
  const points: Array<{ a: any; lat: number; lng: number }> = [];
  for (const a of activities) {
    if (!a || isLogistics(a)) continue;
    const c = extractCoords(a);
    if (c) points.push({ a, lat: c.lat, lng: c.lng });
  }
  let centroid: { lat: number; lng: number } | null = null;
  if (points.length >= 2) {
    const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
    const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
    centroid = { lat, lng };
  }

  const tier = String(ctx.budgetTier || '').toLowerCase();
  const luxury = /luxury|luminary|splurge|premium/.test(tier);
  const OUTLIER_METERS = luxury ? 5000 : 7500;

  const flagged: any[] = [];
  for (const a of activities) {
    if (!a || isLocked(a) || isLogistics(a)) continue;
    if (a?.mustDoRef || a?.anchorSource || a?.required) continue;

    let strongOutlier = false;
    let detail = '';
    const hood = neighborhoodOf(a);

    // Title-token mismatch (uses cluster as the "intended" zone).
    if (tokens.length > 0 && hood) {
      const matches = tokens.some((tok) => hood.includes(tok));
      if (!matches) {
        // Only escalate to "strong" when we ALSO have a coord-distance signal,
        // OR the title contains a different well-known neighborhood
        // (heuristic: any 4+ letter capitalized token in the activity title
        // that isn't a day-theme token).
        const distMatch = centroid && (() => {
          const c = extractCoords(a);
          if (!c) return false;
          return haversineMeters(centroid!, c) > OUTLIER_METERS;
        })();
        const otherHood = (() => {
          const t = title(a);
          const caps = t.match(/\b([A-Z][a-zà-ÿ]{3,})\b/g) || [];
          return caps.some((c) => {
            const lc = c.toLowerCase();
            if (tokens.includes(lc)) return false;
            // Allow common non-neighborhood proper nouns
            return !/^(museum|gallery|park|garden|temple|shrine|market|tower|bridge|street|cafe|restaurant|bar|hotel|station|airport|theater|theatre)$/i.test(c);
          });
        })();
        if (distMatch || otherHood) {
          strongOutlier = true;
          detail = `Activity neighborhood "${hood}" does not match day theme "${tokens.join(', ')}"`;
        }
      }
    }

    // Coord-based outlier (no title signal needed).
    if (!strongOutlier && centroid) {
      const c = extractCoords(a);
      if (c) {
        const d = haversineMeters(centroid, c);
        if (d > OUTLIER_METERS) {
          strongOutlier = true;
          detail = `Activity ${Math.round(d)}m from day centroid (> ${OUTLIER_METERS}m)`;
        }
      }
    }

    if (strongOutlier) {
      counters.geoOutliersFlagged++;
      counters.issues.push({
        code: 'GEO_OUTLIER',
        activityId: actId(a),
        title: title(a),
        detail,
        repaired: false,
      });
      console.log(`[EXECUTIONER] GEO_OUTLIER day=${ctx.dayNumber} title="${title(a)}" ${detail}`);
      flagged.push(a);
      a.metadata = a.metadata || {};
      a.metadata.geoOutlier = true;
    }
  }

  const dropAllowed = ctx.geoDropEnabled === true || !ctx.geoFlagOnly;
  if (dropAllowed && flagged.length > 0) {
    const dropSet = new Set(flagged.map(actId));
    const before = activities.length;
    const survivors = activities.filter((a) => {
      if (!dropSet.has(actId(a))) return true;
      a.needsRefill = true; // hint for cleanup/refill chain
      counters.geoOutliersDropped++;
      counters.droppedActivities++;
      return false;
    });
    if (survivors.length !== before) {
      activities.length = 0;
      activities.push(...survivors);
    }
  }

  return activities;
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator
// ─────────────────────────────────────────────────────────────────────────────

export function runScheduleExecutioner(
  activities: any[],
  ctx: ExecutionerContext,
): ExecutionerResult {
  const counters = newCounters();
  if (!Array.isArray(activities)) return { activities: activities || [], counters };

  let working = activities;
  working = enforceFlightAnchors(working, ctx, counters);
  working = enforceMidnightSpill(working, ctx, counters);
  working = enforceGeoCoherence(working, ctx, counters);
  working = enforceBufferCascade(working, ctx, counters);

  return { activities: working, counters };
}

export const __test_only = {
  neighborhoodTokensFromTitle,
  isNightlife,
  isArrivalCard,
  isLocked,
};

// ─────────────────────────────────────────────────────────────────────────────
// Audit-code translation (read-time auditor parity)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert Executioner counters into the canonical audit-code list shared with
 * `auditTimingViolations`. The result is meant to be stamped onto
 * `day.metadata.quality.executioner_audit` and surfaced through the read-time
 * auditor / TripHealthPanel without needing a fresh write.
 */
export interface ExecutionerAuditCode {
  code:
    | 'EXEC_FLIGHT_ANCHOR_FIXED'
    | 'EXEC_MIDNIGHT_SPILL_TRIMMED'
    | 'EXEC_BUFFER_CASCADE_APPLIED'
    | 'EXEC_GEO_OUTLIER_DROPPED'
    | 'EXEC_GAP_REFILLED';
  count: number;
  dayNumber: number;
  detail: string;
}

export function toExecutionerAuditCodes(
  counters: ExecutionerCounters,
  dayNumber: number,
): ExecutionerAuditCode[] {
  const out: ExecutionerAuditCode[] = [];
  if (counters.flightAnchorRepaired > 0) {
    out.push({
      code: 'EXEC_FLIGHT_ANCHOR_FIXED',
      count: counters.flightAnchorRepaired,
      dayNumber,
      detail: `Retimed ${counters.flightAnchorRepaired} arrival card(s) to flight truth`,
    });
  }
  if (counters.midnightSpilloversDropped > 0) {
    out.push({
      code: 'EXEC_MIDNIGHT_SPILL_TRIMMED',
      count: counters.midnightSpilloversDropped,
      dayNumber,
      detail: `Clamped ${counters.midnightSpilloversDropped} illegal past-midnight wrap(s)`,
    });
  }
  if (counters.bufferRepairs + counters.overlapRepairs > 0) {
    out.push({
      code: 'EXEC_BUFFER_CASCADE_APPLIED',
      count: counters.bufferRepairs + counters.overlapRepairs,
      dayNumber,
      detail: `Cascade fixed ${counters.bufferRepairs} buffer + ${counters.overlapRepairs} overlap`,
    });
  }
  if (counters.geoOutliersDropped > 0) {
    out.push({
      code: 'EXEC_GEO_OUTLIER_DROPPED',
      count: counters.geoOutliersDropped,
      dayNumber,
      detail: `Dropped ${counters.geoOutliersDropped} off-theme geo outlier(s)`,
    });
  }
  if (counters.gapsRefilled > 0) {
    out.push({
      code: 'EXEC_GAP_REFILLED',
      count: counters.gapsRefilled,
      dayNumber,
      detail: `Refilled ${counters.gapsRefilled} gap(s) opened by cleanup`,
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Refill pass (optional, async)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Caller-supplied refill bridge. Returns ONE activity to insert into the
 * largest >=90min gap left by Executioner drops, or null to no-op. Kept
 * generic so the Executioner doesn't depend on `_shared/fill-gap.ts` directly.
 */
export type ExecutionerRefillFn = (input: {
  activities: any[];
  gapStartTime: string;
  gapEndTime: string;
  beforeId?: string;
  afterId?: string;
  dayNumber: number;
}) => Promise<any | null>;

const REFILL_MIN_GAP_MIN = 90;
const ACTIVE_WINDOW_START_MIN = 9 * 60;
const ACTIVE_WINDOW_END_MIN = 22 * 60;

/**
 * Locate the single largest gap inside the active window and call `refill`
 * once. Inserts at most one card. Honors Universal Locking — never refills
 * over a locked neighbour. Stamps `source: 'executioner_refill'` on inserts.
 */
export async function runExecutionerRefill(
  result: ExecutionerResult,
  ctx: ExecutionerContext,
  refill: ExecutionerRefillFn,
): Promise<ExecutionerResult> {
  const { activities, counters } = result;
  if (counters.droppedActivities === 0) return result;
  if (!Array.isArray(activities) || activities.length < 1) return result;

  // Build sorted timed neighbours within the active window.
  const sorted = activities
    .map((a) => ({ a, s: pickStart(a), e: pickEnd(a) }))
    .filter((x) => x.s !== null && x.e !== null) as Array<{ a: any; s: number; e: number }>;
  sorted.sort((x, y) => x.s - y.s);
  if (sorted.length < 2) return result;

  let best: { gap: number; before: typeof sorted[0]; after: typeof sorted[0] } | null = null;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const gapStart = Math.max(a.e, ACTIVE_WINDOW_START_MIN);
    const gapEnd = Math.min(b.s, ACTIVE_WINDOW_END_MIN);
    const gap = gapEnd - gapStart;
    if (gap < REFILL_MIN_GAP_MIN) continue;
    if (!best || gap > best.gap) best = { gap, before: a, after: b };
  }
  if (!best) return result;

  try {
    const inserted = await refill({
      activities,
      gapStartTime: fmtHM(Math.max(best.before.e, ACTIVE_WINDOW_START_MIN)),
      gapEndTime: fmtHM(Math.min(best.after.s, ACTIVE_WINDOW_END_MIN)),
      beforeId: actId(best.before.a),
      afterId: actId(best.after.a),
      dayNumber: ctx.dayNumber,
    });
    if (!inserted) return result;
    inserted.source = inserted.source || 'executioner_refill';
    inserted.metadata = inserted.metadata || {};
    inserted.metadata.executionerRefill = true;
    activities.push(inserted);
    counters.gapsRefilled++;
    counters.issues.push({
      code: 'GAP_REFILLED',
      activityId: actId(inserted),
      title: title(inserted),
      detail: `Refilled ${best.gap}m gap between ${title(best.before.a)} and ${title(best.after.a)}`,
      repaired: true,
    });
    console.log(`[EXECUTIONER] GAP_REFILLED day=${ctx.dayNumber} gap=${best.gap}m title="${title(inserted)}"`);
  } catch (err) {
    console.warn(`[EXECUTIONER] refill failed day=${ctx.dayNumber}:`, err);
  }
  return result;
}
