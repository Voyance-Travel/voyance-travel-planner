/**
 * itinerary-integrity-contract — single authoritative definition of
 * "what a valid persisted trip looks like".
 *
 * Pure / dry-run. Returns a structured verdict. Wired at every code path
 * that can mark a trip `ready` / stamp `fully_persisted=true`:
 *
 *   • action-save-itinerary (user edits)            → `enforceReadyContract`
 *   • action-generate-trip-day Phase-6 freeze stamp → `enforceReadyContract`
 *   • generation-core Stage 6 freeze stamp          → `enforceReadyContract`
 *
 * The contract demotes a would-be-ready trip to `partial` and stamps
 * `metadata.integrity_contract = { ok, codes, ranAt, codeDetails }` so
 * the frontend can surface the exact reasons in a banner.
 *
 * Hard codes (block ready):
 *   - TEMPORAL_ROLE_TIME_MISMATCH    nightcap/cocktail/aperitif in morning
 *                                    OR meal scheduled outside its band
 *   - HOTEL_VENUE_BEFORE_CHECKIN     in-hotel venue before checkin row
 *   - REQUIRED_USER_INTENT_MISSING   user-selected place not scheduled
 *                                    when there WAS feasible time
 *   - NO_SIGHTSEEING_CAPACITY        intents exist but day has zero
 *                                    feasible activity window
 *   - LOGISTICS_ONLY_CURATED_DAY     curated full-day collapsed to
 *                                    arrival/departure only
 *
 * This contract is intentionally NARROW. It does not duplicate the
 * dozens of existing repair passes; it only locks the post-repair
 * persisted state against the patterns that have repeatedly survived
 * every prior layer and shipped to users.
 */

export type IntegrityCode =
  | 'TEMPORAL_ROLE_TIME_MISMATCH'
  | 'NIGHTLIFE_BEFORE_EVENING'
  | 'HOTEL_VENUE_BEFORE_CHECKIN'
  | 'REQUIRED_USER_INTENT_MISSING'
  | 'NO_SIGHTSEEING_CAPACITY'
  | 'LOGISTICS_ONLY_CURATED_DAY'
  | 'MEAL_COVERAGE_MISSING';

export interface IntegrityViolation {
  code: IntegrityCode;
  dayNumber: number;
  detail: string;
  activityTitle?: string;
  activityTime?: string | null;
}

export interface OmittedRequest {
  title: string;
  reason: 'infeasible_time' | 'not_scheduled';
}

export interface IntegrityVerdict {
  ok: boolean;
  ranAt: string;
  violations: IntegrityViolation[];
  codes: IntegrityCode[];
  /** Count of `partial`-class infeasibility (no sightseeing capacity).
   *  Persisted so the UI can render an "infeasible" explainer instead
   *  of treating the trip as broken. */
  infeasibleDays: number[];
  /** Structured manifest the UI surfaces: what was requested and didn't
   *  land, plus why. Empty when all required intents were scheduled. */
  omittedRequests: OmittedRequest[];
  /** Per-day meal-coverage report. Days with `missing.length > 0` and
   *  no infeasibility excuse will fail the contract. */
  mealCoverage: Array<{ dayNumber: number; required: string[]; scheduled: string[]; missing: string[] }>;
}

// ── role detection (kept minimal; mirrors `_shared/timing-spine.ts`)
const NIGHT_DRINK_RE = /\b(nightcap|cocktail|aperitif|aperitivo|rooftop\s+bar|speakeasy|wine\s+bar)\b/i;
const MEAL_TITLE_RE = /\b(breakfast|brunch|lunch|dinner|supper)\b/i;
const HOTEL_LOGISTICS_RE = /\b(check[-\s]?in|check[-\s]?out|return to|head back to|wind down|luggage drop|bag drop|freshen up)\b/i;
const ARRIVAL_LOGISTICS_RE = /\b(arrival|arrive|land(?:ing)?|transfer to|airport (?:pickup|transfer)|flight )\b/i;
const DEPARTURE_LOGISTICS_RE = /\b(departure|depart|transfer to (?:the )?airport|airport transfer|departure flight)\b/i;
const HOTEL_VENUE_HINT_RE = /\bat (?:the )?(hotel|resort|riad|lodge)\b|\b(hotel)\s+(restaurant|bar|spa|lounge|bistro)\b/i;
const LOCKED_SOURCE_RE = /^(user|user_added|manual|extracted|pinned)$/i;

function isLocked(a: any): boolean {
  if (!a) return false;
  if (a.isLocked === true || a.locked === true || a.is_locked === true) return true;
  if (a.lock_state === 'locked') return true;
  const src = String(a?.source || '').toLowerCase();
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

function isCheckinRow(a: any): boolean {
  const t = String(a?.title || a?.name || '');
  return /\bcheck[-\s]?in\b/i.test(t);
}

function isLogisticsRow(a: any): boolean {
  const cat = String(a?.category || '').toLowerCase();
  if (['transit', 'transport', 'transportation', 'flight', 'logistics', 'transfer', 'accommodation', 'stay'].includes(cat)) return true;
  const t = String(a?.title || a?.name || '');
  if (HOTEL_LOGISTICS_RE.test(t)) return true;
  if (ARRIVAL_LOGISTICS_RE.test(t)) return true;
  if (DEPARTURE_LOGISTICS_RE.test(t)) return true;
  return false;
}

function venueMatchesHotel(a: any, hotelName: string | null): boolean {
  if (!hotelName) return false;
  const venue = String(a?.location?.name || a?.venue_name || a?.title || a?.name || '').toLowerCase();
  if (!venue) return false;
  const tokens = hotelName.toLowerCase().split(/\s+/).filter((t) => t.length >= 4);
  if (tokens.length === 0) return false;
  return tokens.every((tok) => venue.includes(tok));
}

/** Unicode-aware normalize for venue-matching (handles "Park Güell"). */
export function normalizeVenueName(s: string): string {
  if (!s) return '';
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function activityMatchesIntent(act: any, intentTitle: string): boolean {
  const norm = normalizeVenueName(intentTitle);
  if (!norm) return false;
  const candidates = [
    act?.title, act?.name,
    act?.location?.name, act?.venue_name,
    act?.description,
  ].filter((v) => typeof v === 'string');
  for (const c of candidates) {
    const cn = normalizeVenueName(c);
    if (!cn) continue;
    if (cn === norm) return true;
    // Whole-word containment (avoid "park" matching "Carpark Hotel")
    if (new RegExp(`\\b${norm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(cn)) return true;
  }
  return false;
}

export interface IntegrityContext {
  /** Selected/explicit hotel name for the trip (best effort). */
  hotelName?: string | null;
  /** Required user must-dos (title only). Treated as REQUIRED (priority='must'). */
  requiredIntents?: Array<{ title: string; dayNumber?: number | null }>;
  /** Saved arrival time (HH:MM 24h) for Day 1 feasibility. */
  arrivalTime24?: string | null;
  /** Saved departure time (HH:MM 24h) for last-day feasibility. */
  departureTime24?: string | null;
  /** Per-day required meals from the meal policy. When provided, the
   *  contract enforces that each required meal has a scheduled card.
   *  Map key = dayNumber (1-indexed). */
  requiredMealsByDay?: Record<number, Array<'breakfast' | 'lunch' | 'dinner'>>;
}

const MORNING_CUTOFF_MIN = 11 * 60; // <11:00 is "morning"
const DINNER_FLOOR_MIN = 17 * 60;    // dinner can start ≥17:00

function isHotelCheckedInBefore(activities: any[], startIdx: number): boolean {
  for (let i = 0; i < startIdx; i++) {
    if (isCheckinRow(activities[i])) return true;
  }
  return false;
}

function feasibleActivityMinutes(arrivalMin: number | null, departureMin: number | null): number {
  const dayStart = arrivalMin !== null ? Math.max(arrivalMin + 90, 9 * 60) : 9 * 60;
  const dayEnd = departureMin !== null ? Math.max(0, departureMin - 180) : 22 * 60;
  return Math.max(0, dayEnd - dayStart);
}

// ── meal classification (mirrors meal-policy windows) ────────────────────
const MEAL_BANDS: Record<'breakfast' | 'lunch' | 'dinner', [number, number]> = {
  breakfast: [5 * 60, 11 * 60],        // 05:00 – 11:00 (brunch counts)
  lunch:     [11 * 60, 15 * 60 + 30],  // 11:00 – 15:30
  dinner:    [17 * 60 + 30, 23 * 60 + 30], // 17:30 – 23:30
};
const DRINKS_ONLY_RE = /\b(nightcap|cocktail|aperitif|aperitivo|drinks|wine\s+bar|speakeasy|rooftop\s+bar|pub|bar\s+crawl)\b/i;

function isMealCard(a: any): boolean {
  if (!a) return false;
  const cat = String(a?.category || '').toLowerCase();
  if (['dining', 'restaurant', 'food', 'meal', 'cafe', 'breakfast', 'brunch', 'lunch', 'dinner'].includes(cat)) return true;
  const title = String(a?.title || a?.name || '');
  return /\b(breakfast|brunch|lunch|dinner|supper)\b/i.test(title);
}

function classifyMealSlot(a: any): 'breakfast' | 'lunch' | 'dinner' | null {
  if (!isMealCard(a)) return null;
  const title = String(a?.title || a?.name || '').toLowerCase();
  if (DRINKS_ONLY_RE.test(title)) return null; // drinks-only NEVER satisfies dinner
  if (/\b(breakfast|brunch)\b/.test(title)) return 'breakfast';
  if (/\b(lunch)\b/.test(title)) return 'lunch';
  if (/\b(dinner|supper)\b/.test(title)) return 'dinner';
  // Fall back to time-band when title is neutral (e.g. "Roscioli")
  const start = pickStart(a);
  if (start === null) return null;
  if (start >= MEAL_BANDS.breakfast[0] && start <= MEAL_BANDS.breakfast[1]) return 'breakfast';
  if (start >= MEAL_BANDS.lunch[0] && start <= MEAL_BANDS.lunch[1]) return 'lunch';
  if (start >= MEAL_BANDS.dinner[0] && start <= MEAL_BANDS.dinner[1]) return 'dinner';
  return null;
}
export function checkItineraryIntegrity(
  days: readonly any[] | null | undefined,
  ctx: IntegrityContext = {},
): IntegrityVerdict {
  const ranAt = new Date().toISOString();
  const violations: IntegrityViolation[] = [];
  const infeasibleDays: number[] = [];
  const mealCoverage: IntegrityVerdict['mealCoverage'] = [];
  const omittedRequests: OmittedRequest[] = [];

  if (!Array.isArray(days) || days.length === 0) {
    return { ok: true, ranAt, violations: [], codes: [], infeasibleDays: [], omittedRequests, mealCoverage };
  }

  const totalDays = days.length;
  const hotelName = ctx.hotelName || null;
  const requiredIntents = Array.isArray(ctx.requiredIntents) ? ctx.requiredIntents : [];

  // Build a "scheduled set" of intent titles across the whole trip so we can
  // detect required intents that landed on ANY day.
  const scheduledIntents = new Set<string>();
  for (const day of days) {
    const acts = Array.isArray(day?.activities) ? day.activities : [];
    for (const intent of requiredIntents) {
      const key = normalizeVenueName(intent.title);
      if (!key) continue;
      if (scheduledIntents.has(key)) continue;
      for (const a of acts) {
        if (activityMatchesIntent(a, intent.title)) {
          scheduledIntents.add(key);
          break;
        }
      }
    }
  }

  for (let i = 0; i < days.length; i++) {
    const day = days[i] || {};
    const dayNumber = Number(day.dayNumber || i + 1);
    const isFirstDay = dayNumber === 1;
    const isLastDay = dayNumber === totalDays;
    const acts: any[] = Array.isArray(day.activities) ? day.activities : [];

    // ── TEMPORAL_ROLE_TIME_MISMATCH + NIGHTLIFE_BEFORE_EVENING
    // ── HOTEL_VENUE_BEFORE_CHECKIN
    for (let idx = 0; idx < acts.length; idx++) {
      const a = acts[idx];
      if (!a || isLocked(a)) continue;
      const start = pickStart(a);
      const title = String(a?.title || a?.name || '');
      // Nightcap/cocktail/aperitif/speakeasy/rooftop/wine bar before 17:00 is
      // a hard semantic mismatch — emit a dedicated code so the UI can
      // explain it ("nightcap was placed at 9 AM") instead of a vague
      // "temporal role" warning.
      if (start !== null && start < 17 * 60 && NIGHT_DRINK_RE.test(title)) {
        violations.push({
          code: 'NIGHTLIFE_BEFORE_EVENING',
          dayNumber,
          detail: `Nightlife card "${title}" scheduled at ${a.startTime || a.time} — must start at 17:00 or later.`,
          activityTitle: title,
          activityTime: a.startTime || a.time || null,
        });
      }
      if (isFirstDay && hotelName && !isCheckinRow(a) && !isLogisticsRow(a)) {
        const inHotel = venueMatchesHotel(a, hotelName) || HOTEL_VENUE_HINT_RE.test(title);
        if (inHotel && !isHotelCheckedInBefore(acts, idx)) {
          violations.push({
            code: 'HOTEL_VENUE_BEFORE_CHECKIN',
            dayNumber,
            detail: `"${title}" is at the hotel but scheduled before check-in.`,
            activityTitle: title,
            activityTime: a.startTime || a.time || null,
          });
        }
      }
    }

    // ── MEAL_COVERAGE_MISSING
    // When the meal policy says this day requires meals and none are
    // scheduled (or drinks-only cards are masquerading), block ready.
    const required = ctx.requiredMealsByDay?.[dayNumber] || [];
    if (required.length > 0) {
      const scheduledSet = new Set<'breakfast' | 'lunch' | 'dinner'>();
      for (const a of acts) {
        const slot = classifyMealSlot(a);
        if (slot) scheduledSet.add(slot);
      }
      const scheduled = Array.from(scheduledSet);
      const missing = required.filter((m) => !scheduledSet.has(m));
      mealCoverage.push({ dayNumber, required, scheduled, missing });
      if (missing.length > 0) {
        violations.push({
          code: 'MEAL_COVERAGE_MISSING',
          dayNumber,
          detail: `Day ${dayNumber} is missing required meal(s): ${missing.join(', ')}.`,
        });
      }
    }

    // ── LOGISTICS_ONLY_CURATED_DAY
    // A curated middle day with intents but zero non-logistics activities.
    if (!isFirstDay && !isLastDay && requiredIntents.length > 0) {
      const realCount = acts.filter((a) => a && !isLogisticsRow(a) && !isCheckinRow(a)).length;
      if (realCount === 0 && acts.length > 0) {
        violations.push({
          code: 'LOGISTICS_ONLY_CURATED_DAY',
          dayNumber,
          detail: `Day ${dayNumber} has only logistics rows but trip has required must-dos.`,
        });
      }
    }
  }

  // ── REQUIRED_USER_INTENT_MISSING / NO_SIGHTSEEING_CAPACITY
  if (requiredIntents.length > 0) {
    const arrivalMin = parseHM(ctx.arrivalTime24 || null);
    const departureMin = parseHM(ctx.departureTime24 || null);
    const totalFeasibleMin = days.reduce((acc, _d, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === days.length - 1;
      const a = isFirst ? arrivalMin : null;
      const d = isLast ? departureMin : null;
      return acc + feasibleActivityMinutes(a, d) + (isFirst || isLast ? 0 : 12 * 60);
    }, 0);
    // 90 min budget per required intent is the floor used here. If the trip
    // has zero feasible minutes, mark NO_SIGHTSEEING_CAPACITY instead of
    // failing for missing intents (the user's flight schedule made it
    // impossible to honor any of the selections).
    const needsMin = requiredIntents.length * 90;
    const infeasibleTrip = totalFeasibleMin === 0
      || (totalFeasibleMin < needsMin && totalFeasibleMin < 240);

    for (const intent of requiredIntents) {
      const key = normalizeVenueName(intent.title);
      if (!key) continue;
      if (scheduledIntents.has(key)) continue;
      if (infeasibleTrip) {
        // Surface once at trip-level via NO_SIGHTSEEING_CAPACITY below.
        continue;
      }
      violations.push({
        code: 'REQUIRED_USER_INTENT_MISSING',
        dayNumber: typeof intent.dayNumber === 'number' ? intent.dayNumber : 1,
        detail: `Required must-do "${intent.title}" was not scheduled on any day.`,
        activityTitle: intent.title,
      });
    }

    if (infeasibleTrip && scheduledIntents.size < requiredIntents.length) {
      violations.push({
        code: 'NO_SIGHTSEEING_CAPACITY',
        dayNumber: 1,
        detail:
          `Trip has ${requiredIntents.length} required must-do(s) but ${totalFeasibleMin} ` +
          `feasible activity minutes (arrival=${ctx.arrivalTime24 || '?'}, departure=${ctx.departureTime24 || '?'}).`,
      });
      // Mark days that are individually infeasible so the UI can explain.
      if (days.length >= 1) {
        const firstFeasible = feasibleActivityMinutes(arrivalMin, days.length === 1 ? departureMin : null);
        if (firstFeasible === 0) infeasibleDays.push(1);
      }
      if (days.length >= 2) {
        const lastFeasible = feasibleActivityMinutes(null, departureMin);
        if (lastFeasible === 0) infeasibleDays.push(days.length);
      }
    }
  }

  const codes = Array.from(new Set(violations.map((v) => v.code)));
  return {
    ok: violations.length === 0,
    ranAt,
    violations,
    codes,
    infeasibleDays,
  };
}

/**
 * Convenience: returns the metadata patch + corrected `itinerary_status`
 * for a freeze-stamp call site. If the contract fails:
 *   • status is forced to 'partial'
 *   • fully_persisted is still stamped (the JSON is the authoritative DB
 *     truth; we just refuse to call it ready)
 *   • metadata.integrity_contract carries the verdict for UI surfacing
 */
export function applyIntegrityContractToFreezeStamp(opts: {
  proposedStatus: 'ready' | 'generated' | 'partial' | 'failed';
  verdict: IntegrityVerdict;
}): {
  status: 'ready' | 'generated' | 'partial' | 'failed';
  metadataPatch: Record<string, any>;
} {
  const { proposedStatus, verdict } = opts;
  const blockReady = !verdict.ok
    && (proposedStatus === 'ready' || proposedStatus === 'generated');
  return {
    status: blockReady ? 'partial' : proposedStatus,
    metadataPatch: {
      integrity_contract: {
        ok: verdict.ok,
        ranAt: verdict.ranAt,
        codes: verdict.codes,
        infeasibleDays: verdict.infeasibleDays,
        violations: verdict.violations.slice(0, 30),
        blocked_ready: blockReady,
      },
    },
  };
}
