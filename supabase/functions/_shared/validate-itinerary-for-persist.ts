/**
 * Itinerary persist-time validation gate.
 *
 * Pure, dry-run-only. Composes the invariants we already enforce elsewhere
 * and returns a structured verdict. The save action uses this to convert
 * a silent broken save into an HTTP 422 + per-day banner so the user
 * surfaces regressions at the moment of generation, not 5 cities later.
 *
 * Plan: .lovable/plan.md (Stage 1 — close LOCK 3).
 *
 * Codes:
 *   - MISSING_REQUIRED_MEAL     (error)   day's meal-policy unmet
 *   - MISSING_HOTEL_RETURN      (warning) day ends past 19:00 with no return/checkout
 *   - EMPTY_DINING_DESCRIPTION  (error)   dining card persisted with empty description
 *   - PHANTOM_PREDAWN_CARD      (error)   non-locked card 00:00–04:59, not allowlisted
 *   - OVERLONG_ACTIVITY         (error)   non-logistics > 6h
 *   - WRAP_GAP_OVER_3H          (warning) >3h gap inside the active day window
 *   - CURRENCY_MISMATCH         (warning) destination currency vs. activity currency
 *   - EMPTY_DAY                 (error)   no real activities at all
 */

import { deriveMealPolicy, type RequiredMeal } from '../generate-itinerary/meal-policy.ts';
import { detectMealSlots } from '../generate-itinerary/day-validation.ts';
import { isDiningActivity } from './dining-description-backfill.ts';

export type PersistValidationCode =
  | 'MISSING_REQUIRED_MEAL'
  | 'MISSING_HOTEL_RETURN'
  | 'EMPTY_DINING_DESCRIPTION'
  | 'PHANTOM_PREDAWN_CARD'
  | 'OVERLONG_ACTIVITY'
  | 'WRAP_GAP_OVER_3H'
  | 'CURRENCY_MISMATCH'
  | 'EMPTY_DAY';

export type PersistValidationSeverity = 'error' | 'warning';

export interface PersistValidationIssue {
  code: PersistValidationCode;
  severity: PersistValidationSeverity;
  dayNumber: number;
  activityId?: string;
  detail: string;
}

export interface PersistVerdict {
  ok: boolean;
  errors: PersistValidationIssue[];
  warnings: PersistValidationIssue[];
}

export interface ValidatePersistContext {
  destination?: string | null;
  arrivalTime24?: string;
  departureTime24?: string;
}

/* ----------------------------- helpers ----------------------------- */

function parseHM(t?: string): number | null {
  if (!t || typeof t !== 'string') return null;
  const m = t.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
  return h * 60 + mm;
}

function isLocked(a: any): boolean {
  if (!a) return false;
  if (a.locked === true || a.is_locked === true || a.isLocked === true) return true;
  if (a.lock_state === 'locked') return true;
  const source = String(a.source || '').toLowerCase();
  if (['user', 'manual', 'extracted', 'pinned'].includes(source)) return true;
  if (a.metadata?.preserveAsManualPick === true) return true;
  return false;
}

const HOTEL_RETURN_RE = /\b(return to|back to|head to|night cap at|nightcap at)?\s*(hotel|riad|lodge|resort|villa|hostel|airbnb|accommodation|check[- ]?in|check[- ]?out)\b/i;
const HOTEL_BRAND_RE = /\b(marriott|cipriani|aman|gritti|hilton|hyatt|ritz|four seasons|st\.?\s*regis|peninsula|belmond|mandarin|rosewood|raffles|bvlgari|conrad|edition|sofitel|fairmont|shangri-?la|ihg|westin|sheraton|nobu)\b/i;
const TERMINAL_LOGISTICS_RE = /\b(flight|airport|transfer to airport|departure|train station)\b/i;

function isHotelReturnish(a: any): boolean {
  if (!a) return false;
  const cat = String(a.category || '').toLowerCase();
  if (cat === 'accommodation' || cat === 'hotel' || cat === 'lodging') return true;
  const title = String(a.title || a.name || '');
  const venue = String(a.location?.name || a.venue_name || '');
  if (HOTEL_RETURN_RE.test(title) || HOTEL_RETURN_RE.test(venue)) return true;
  if (HOTEL_BRAND_RE.test(title) || HOTEL_BRAND_RE.test(venue)) return true;
  return false;
}

function isLogistics(a: any): boolean {
  if (!a) return false;
  const cat = String(a.category || '').toLowerCase();
  if (['transit', 'transport', 'transportation', 'flight', 'logistics', 'transfer'].includes(cat)) return true;
  const title = String(a.title || a.name || '');
  if (TERMINAL_LOGISTICS_RE.test(title)) return true;
  return false;
}

function isRealActivity(a: any): boolean {
  if (!a) return false;
  if (isLogistics(a)) return false;
  if (isHotelReturnish(a)) return false;
  return true;
}

/* --------------- destination → expected currency (best effort) --------------- */
// Conservative: only assert for unambiguous city tokens. Others fall through.
const CITY_CURRENCY: Array<{ re: RegExp; iso: string }> = [
  { re: /\bhong\s*kong\b/i, iso: 'HKD' },
  { re: /\b(macau|macao)\b/i, iso: 'MOP' },
  { re: /\b(tokyo|kyoto|osaka|japan)\b/i, iso: 'JPY' },
  { re: /\b(seoul|busan|south korea|korea)\b/i, iso: 'KRW' },
  { re: /\b(bangkok|phuket|chiang mai|thailand)\b/i, iso: 'THB' },
  { re: /\b(singapore)\b/i, iso: 'SGD' },
  { re: /\b(london|manchester|edinburgh|uk|united kingdom|england|scotland)\b/i, iso: 'GBP' },
  { re: /\b(zurich|geneva|switzerland)\b/i, iso: 'CHF' },
  { re: /\b(sydney|melbourne|brisbane|australia)\b/i, iso: 'AUD' },
  { re: /\b(toronto|vancouver|montreal|canada)\b/i, iso: 'CAD' },
  { re: /\b(dubai|abu dhabi|uae|united arab emirates)\b/i, iso: 'AED' },
];

function expectedCurrencyFor(destination?: string | null): string | null {
  if (!destination) return null;
  for (const { re, iso } of CITY_CURRENCY) {
    if (re.test(destination)) return iso;
  }
  return null;
}

function activityCurrency(a: any): string | null {
  const c = a?.cost?.currency || a?.estimatedCost?.currency || a?.transportation?.estimatedCost?.currency;
  if (!c || typeof c !== 'string') return null;
  return c.toUpperCase();
}

/* ----------------------------- main ----------------------------- */

const PREDAWN_OK_SOURCES = new Set([
  'late_nightlife_bookend',
  'bookend-overnight',
  'bookend-readtime',
]);

export function validateItineraryForPersist(
  days: any[],
  ctx: ValidatePersistContext = {},
): PersistVerdict {
  const issues: PersistValidationIssue[] = [];
  const push = (i: PersistValidationIssue) => issues.push(i);

  if (!Array.isArray(days) || days.length === 0) {
    return { ok: true, errors: [], warnings: [] };
  }

  const totalDays = days.length;
  const expectedIso = expectedCurrencyFor(ctx.destination ?? null);

  for (let i = 0; i < days.length; i++) {
    const day = days[i] || {};
    const dayNumber = Number(day.dayNumber || i + 1);
    const isFirstDay = dayNumber === 1;
    const isLastDay = dayNumber === totalDays;
    const acts: any[] = Array.isArray(day.activities) ? day.activities : [];

    // EMPTY_DAY — no real activities at all.
    if (acts.filter(isRealActivity).length === 0) {
      push({
        code: 'EMPTY_DAY', severity: 'error', dayNumber,
        detail: 'Day has no real activities (logistics/hotel-only).',
      });
      continue;
    }

    // MISSING_REQUIRED_MEAL — derive policy + check
    let policy: { requiredMeals: RequiredMeal[] };
    try {
      const cached = day?.metadata?.quality?.meal_policy_at_generation;
      policy = (cached && Array.isArray(cached.requiredMeals))
        ? { requiredMeals: cached.requiredMeals as RequiredMeal[] }
        : deriveMealPolicy({
            dayNumber, totalDays, isFirstDay, isLastDay,
            arrivalTime24: isFirstDay ? ctx.arrivalTime24 : undefined,
            departureTime24: isLastDay ? ctx.departureTime24 : undefined,
          }) as any;
    } catch {
      policy = { requiredMeals: [] };
    }
    if (policy.requiredMeals?.length) {
      const detected = detectMealSlots(acts);
      const missing = policy.requiredMeals.filter(m => !detected.includes(m));
      for (const m of missing) {
        push({
          code: 'MISSING_REQUIRED_MEAL', severity: 'error', dayNumber,
          detail: `Day ${dayNumber} is missing ${m}.`,
        });
      }
    }

    // EMPTY_DINING_DESCRIPTION
    for (const a of acts) {
      if (!isDiningActivity(a)) continue;
      const desc = typeof a.description === 'string' ? a.description.trim() : '';
      if (desc.length < 10) {
        push({
          code: 'EMPTY_DINING_DESCRIPTION', severity: 'error', dayNumber,
          activityId: a.id,
          detail: `${a.title || 'Dining card'} has no description.`,
        });
      }
    }

    // PHANTOM_PREDAWN_CARD
    for (const a of acts) {
      if (isLocked(a)) continue;
      const start = parseHM(a.startTime || a.start_time || a.time);
      if (start === null) continue;
      if (start >= 0 && start < 5 * 60) {
        const src = String(a.source || a.metadata?.source || '');
        if (PREDAWN_OK_SOURCES.has(src)) continue;
        push({
          code: 'PHANTOM_PREDAWN_CARD', severity: 'error', dayNumber,
          activityId: a.id,
          detail: `${a.title || 'Activity'} starts at ${a.startTime} (pre-dawn).`,
        });
      }
    }

    // OVERLONG_ACTIVITY (>6h non-logistics)
    for (const a of acts) {
      if (isLogistics(a)) continue;
      const s = parseHM(a.startTime || a.start_time);
      const e = parseHM(a.endTime || a.end_time);
      if (s === null || e === null) continue;
      let dur = e - s;
      if (dur < 0) dur += 24 * 60;
      if (dur > 6 * 60) {
        push({
          code: 'OVERLONG_ACTIVITY', severity: 'error', dayNumber,
          activityId: a.id,
          detail: `${a.title || 'Activity'} spans ${Math.round(dur / 60)}h (>6h).`,
        });
      }
    }

    // WRAP_GAP_OVER_3H — within active window (08:00 → last activity end)
    const timed = acts
      .filter(isRealActivity)
      .map(a => ({
        s: parseHM(a.startTime || a.start_time),
        e: parseHM(a.endTime || a.end_time),
      }))
      .filter(x => x.s !== null && x.e !== null)
      .sort((a, b) => (a.s as number) - (b.s as number));
    for (let k = 1; k < timed.length; k++) {
      const prev = timed[k - 1];
      const cur = timed[k];
      const gap = (cur.s as number) - (prev.e as number);
      if (gap > 180 && (cur.s as number) > 8 * 60) {
        push({
          code: 'WRAP_GAP_OVER_3H', severity: 'warning', dayNumber,
          detail: `Day ${dayNumber} has a ${Math.round(gap / 60)}h gap.`,
        });
        break; // one nudge per day
      }
    }

    // MISSING_HOTEL_RETURN
    if (!isLastDay) {
      const lastReal = acts
        .filter(a => isRealActivity(a) || isHotelReturnish(a))
        .map(a => ({ a, e: parseHM(a.endTime || a.end_time) }))
        .filter(x => x.e !== null)
        .sort((a, b) => (a.e as number) - (b.e as number))
        .pop();
      if (lastReal && (lastReal.e as number) >= 19 * 60 && !isHotelReturnish(lastReal.a) && !isLogistics(lastReal.a)) {
        push({
          code: 'MISSING_HOTEL_RETURN', severity: 'warning', dayNumber,
          detail: `Day ${dayNumber} ends at ${lastReal.a.endTime} with no return-to-hotel card.`,
        });
      }
    }

    // CURRENCY_MISMATCH
    if (expectedIso) {
      const seen = new Set<string>();
      for (const a of acts) {
        const c = activityCurrency(a);
        if (c && c !== expectedIso && c !== 'USD') seen.add(c);
      }
      if (seen.size > 0) {
        push({
          code: 'CURRENCY_MISMATCH', severity: 'warning', dayNumber,
          detail: `Day ${dayNumber} has costs in ${[...seen].join(', ')} but destination uses ${expectedIso}.`,
        });
      }
    }
  }

  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  return { ok: errors.length === 0, errors, warnings };
}
