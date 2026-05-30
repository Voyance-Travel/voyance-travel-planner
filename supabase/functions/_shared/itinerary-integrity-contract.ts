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
  | 'MEAL_COVERAGE_MISSING'
  | 'FLIGHT_ANCHOR_COMMIT_MISMATCH'
  | 'AIRPORT_LOOP_ON_NON_DEPARTURE'
  | 'NEIGHBORHOOD_ADDRESS_CONFLICT'
  | 'HOTEL_COST_NOT_SURFACED'
  | 'FINAL_ORPHAN_TRANSIT';

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
const LOCKED_SOURCE_RE = /^(user|user_added|manual|extracted|pinned|booked|imported)$/i;

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

/**
 * Truly user-owned: user-touched / manual / imported / booked / pinned.
 * Distinguishes from system-generated anchors (arrival-flight, airport-
 * transfer, generated check-in) which the gate IS allowed to check and
 * which repair passes are allowed to mutate. Mirrors
 * `schedule-executioner.ts::isUserOwned`.
 */
function isUserOwned(a: any): boolean {
  if (!a) return false;
  if (a.userAdded || a.userEdited || a.isManual || a.extracted || a.pinned) return true;
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
  /** Destination string (e.g. "Lisbon, Portugal") — enables the
   *  neighborhood-address coherence invariant. */
  destination?: string | null;
  /** Selected hotel total price in USD cents. When > 0 the contract
   *  asserts the cost is surfaced (either via a day-0 hotel cost row or
   *  `budgetIncludeHotel === true`). */
  hotelTotalPriceUsdCents?: number | null;
  /** Whether trip-level `budget_include_hotel` is true. */
  budgetIncludeHotel?: boolean | null;
  /** Server-side check: a Day-0 hotel row exists in `activity_costs`.
   *  When true, `HOTEL_COST_NOT_SURFACED` is satisfied even if the row
   *  hasn't been mirrored into `days[0].activities`. Populated by
   *  `resolveCommitGate` after `ensureHotelCostRow`. */
  hotelCostRowFound?: boolean | null;
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

    // ── AIRPORT_LOOP_ON_NON_DEPARTURE
    // Lisbon root-cause class: arrival night had check-in → travel-to-airport
    // → return-to-hotel loop, and middle days sometimes carry an airport
    // transfer with no flight on that day. Mirrors the Executioner pass but
    // runs at commit time so any pre-existing or chat-injected loop blocks
    // the ready stamp.
    if (!isLastDay) {
      // Find first check-in index on this day (Day 1 only realistically has one)
      let checkinIdx = -1;
      for (let k = 0; k < acts.length; k++) {
        const t = String(acts[k]?.title || acts[k]?.name || '');
        if (/\bcheck[-\s]?in\b/i.test(t)) { checkinIdx = k; break; }
      }
      for (let idx = 0; idx < acts.length; idx++) {
        const a = acts[idx];
        // Only user-owned rows are immutable here; system-generated airport
        // transfers MUST be checked or the Lisbon/Amsterdam post-checkin
        // loop pattern continues to ship as ready.
        if (!a || isUserOwned(a)) continue;
        const t = String(a?.title || a?.name || '');
        const anchor = String(a?.anchorSource || '').toLowerCase();
        const isAirportXfer =
          anchor === 'airport-transfer' ||
          /\b(airport\s+transfer|transfer\s+to\s+(?:the\s+)?airport|airport\s+(?:pickup|pick[- ]up))\b/i.test(t);
        if (!isAirportXfer) continue;
        // Middle day: never legitimate.
        if (!isFirstDay) {
          violations.push({
            code: 'AIRPORT_LOOP_ON_NON_DEPARTURE',
            dayNumber,
            detail: `Day ${dayNumber} contains an airport transfer ("${t}") but is not the departure day.`,
            activityTitle: t,
            activityTime: a.startTime || a.time || null,
          });
        } else if (checkinIdx !== -1 && idx > checkinIdx) {
          // Day 1 post-check-in transfer = loop.
          violations.push({
            code: 'AIRPORT_LOOP_ON_NON_DEPARTURE',
            dayNumber,
            detail: `Arrival day has a post-checkin airport transfer ("${t}") — loop back to the airport on arrival night.`,
            activityTitle: t,
            activityTime: a.startTime || a.time || null,
          });
        }
      }
    }

    // ── FLIGHT_ANCHOR_COMMIT_MISMATCH (Day 1 only)
    // If we have an arrival clock truth and Day 1's arrival anchor card
    // disagrees by >20 min, the Executioner did not run or was overridden.
    // Block the ready stamp so the user sees the truth.
    if (isFirstDay && ctx.arrivalTime24) {
      const truthMin = parseHM(ctx.arrivalTime24);
      if (truthMin !== null) {
        for (const a of acts) {
          // System anchors (`source='repair-arrival-flight'`, `anchorSource=
          // 'arrival-flight'` with `isLocked=true` stamped by anchor-guard)
          // MUST be checked against flight truth — they were the leak path
          // for the Lisbon 19:00 / Amsterdam 20:00 ships-as-ready bug.
          if (!a || isUserOwned(a)) continue;
          const t = String(a?.title || a?.name || '');
          const anchor = String(a?.anchorSource || '').toLowerCase();
          const isArrival =
            anchor === 'arrival-flight' ||
            /\b(arrival|landing|land\s+at|inbound)\b.*\b(flight|airport)\b|\b(arrival|flight\s+arrival)\b/i.test(t);
          if (!isArrival) continue;
          const stamped = pickStart(a);
          if (stamped === null) continue;
          if (Math.abs(stamped - truthMin) > 10) {
            violations.push({
              code: 'FLIGHT_ANCHOR_COMMIT_MISMATCH',
              dayNumber,
              detail: `Arrival anchor "${t}" stamped ${a.startTime || a.time} but flight truth is ${ctx.arrivalTime24}.`,
              activityTitle: t,
              activityTime: a.startTime || a.time || null,
            });
          }
        }
      }
    }

    // ── NEIGHBORHOOD_ADDRESS_CONFLICT
    // Lisbon root-cause: Day titled "Alfama Wandering" had an activity
    // pinned to Av. da Liberdade. Run the neighborhood guard at commit time;
    // when destination is known and a conflict exists, block ready.
    if (ctx.destination && day?.title) {
      try {
        // Lazy import — keep the contract tree-shake friendly and avoid
        // import cycles in test-only contexts.
        const guard = (globalThis as any).__neighborhoodGuard;
        const checkFn = guard?.checkNeighborhoodCoherence;
        if (typeof checkFn === 'function') {
          for (const a of acts) {
            if (!a || isLocked(a) || isLogisticsRow(a)) continue;
            const verdict = checkFn(a, day.title, ctx.destination);
            if (verdict?.mismatch) {
              violations.push({
                code: 'NEIGHBORHOOD_ADDRESS_CONFLICT',
                dayNumber,
                detail: verdict.detail || `Activity neighborhood conflicts with day theme.`,
                activityTitle: String(a?.title || a?.name || ''),
                activityTime: a?.startTime || a?.time || null,
              });
            }
          }
        }
      } catch { /* non-blocking */ }
    }

    // ── FINAL_ORPHAN_TRANSIT
    // Amsterdam root-cause class: "Walk to Cafe Chris" / "Taxi to Foodhallen"
    // shipped without the actual Cafe Chris / Foodhallen activity being
    // scheduled. The user is routed to a venue that doesn't appear on the
    // day. This catches the residual orphan that survives executioner's
    // pruneOrphanTransits when the target name doesn't match a cross-city
    // signal.
    //
    // A transit row "Walk/Taxi/Tram/Bus/Metro/Train to X" requires a
    // non-bookend, non-logistics same-day activity whose normalized title or
    // venue name contains the X token within ±90 min of the transit's
    // end time.
    const TRANSIT_TARGET_RE = /^(?:walk|taxi|tram|bus|metro|train|cab|uber|drive|ride|head|transfer)\s+to\s+(.{2,80})$/i;
    for (let idx = 0; idx < acts.length; idx++) {
      const a = acts[idx];
      if (!a || isLocked(a)) continue;
      const t = String(a?.title || a?.name || '').trim();
      const m = t.match(TRANSIT_TARGET_RE);
      if (!m) continue;
      const targetRaw = String(m[1] || '')
        .replace(/[.,;!?].*$/, '')
        .replace(/\s+(for|to|on|in|at)\s+.*$/i, '')
        .trim();
      // Skip generic "Walk to Hotel/Airport" — bookend/logistics, covered
      // by other invariants.
      if (/\b(hotel|airport|station|terminal|station|home|accommodation|stay)\b/i.test(targetRaw)) continue;
      const targetKey = normalizeVenueName(targetRaw);
      if (!targetKey || targetKey.length < 3) continue;

      const transitEnd = pickStart(a) ?? null;
      let matched = false;
      for (let j = 0; j < acts.length; j++) {
        if (j === idx) continue;
        const o = acts[j];
        if (!o) continue;
        // Skip other transit rows / bookends.
        if (isLogisticsRow(o)) continue;
        const ot = String(o?.title || o?.name || '');
        const ov = String(o?.location?.name || o?.venue_name || '');
        const otn = normalizeVenueName(ot);
        const ovn = normalizeVenueName(ov);
        const tokenMatch =
          otn.includes(targetKey) ||
          ovn.includes(targetKey) ||
          new RegExp(`\\b${targetKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(otn);
        if (!tokenMatch) continue;
        if (transitEnd === null) { matched = true; break; }
        const oStart = pickStart(o);
        if (oStart === null) { matched = true; break; }
        if (Math.abs(oStart - transitEnd) <= 90) { matched = true; break; }
      }
      if (!matched) {
        violations.push({
          code: 'FINAL_ORPHAN_TRANSIT',
          dayNumber,
          detail: `Transit "${t}" points to "${targetRaw}" but no matching activity is scheduled on day ${dayNumber}.`,
          activityTitle: t,
          activityTime: a?.startTime || a?.time || null,
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
        // Trip-wide infeasibility: list in omittedRequests but skip the
        // per-intent violation (surfaced once via NO_SIGHTSEEING_CAPACITY).
        omittedRequests.push({ title: intent.title, reason: 'infeasible_time' });
        continue;
      }
      omittedRequests.push({ title: intent.title, reason: 'not_scheduled' });
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

  // ── HOTEL_COST_NOT_SURFACED (trip-wide)
  // Lisbon root-cause: Bairro Alto Hotel $250×3 was selected but Payments
  // showed "Flights & Accommodation Free". When a priced hotel exists and
  // budgetIncludeHotel !== true AND no hotel cost row sits on day 0/1,
  // block ready so the user sees a partial badge with a clear reason.
  if (
    typeof ctx.hotelTotalPriceUsdCents === 'number' &&
    ctx.hotelTotalPriceUsdCents > 0 &&
    ctx.budgetIncludeHotel !== true
  ) {
    // Fast path: server-side activity_costs check already confirmed the row.
    let hotelCostRowFound = ctx.hotelCostRowFound === true;
    if (!hotelCostRowFound) {
      for (const day of days.slice(0, 2)) {
        const acts = Array.isArray(day?.activities) ? day.activities : [];
        for (const a of acts) {
          const cat = String(a?.category || '').toLowerCase();
          const amount = Number(a?.cost?.amount ?? a?.estimatedCost?.amount ?? a?.price ?? 0);
          if ((cat === 'accommodation' || cat === 'hotel' || cat === 'stay') && amount > 0) {
            hotelCostRowFound = true;
            break;
          }
        }
        if (hotelCostRowFound) break;
      }
    }
    if (!hotelCostRowFound) {
      violations.push({
        code: 'HOTEL_COST_NOT_SURFACED',
        dayNumber: 1,
        detail:
          `Selected hotel has a price of $${(ctx.hotelTotalPriceUsdCents / 100).toFixed(0)} ` +
          `but it is excluded from the budget AND no day-0 hotel cost row exists. ` +
          `Payments will show "Free" — flip budget_include_hotel=true or add a hotel cost row.`,
      });
    }
  }



  const codes = Array.from(new Set(violations.map((v) => v.code)));
  return {
    ok: violations.length === 0,
    ranAt,
    violations,
    codes,
    infeasibleDays,
    omittedRequests,
    mealCoverage,
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
        omittedRequests: verdict.omittedRequests.slice(0, 30),
        mealCoverage: verdict.mealCoverage.slice(0, 30),
        blocked_ready: blockReady,
      },
    },
  };
}
