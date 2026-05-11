/**
 * Canonical activity-cost row resolver — shared by useTripFinancialSnapshot
 * (header total) and usePayableItems (line items) so the two views agree.
 *
 * Applies, in order:
 *   1. Toggle filter (hotel/flight inclusion).
 *   2. Orphan-id rescue: if activity_id is gone from the live itinerary,
 *      try to repair by (dayNumber, normalized-category). Otherwise drop.
 *   3. $0 JSON rescue: if DB row is $0 but the live JSON activity carries a
 *      positive `cost`, count the JSON cost × travelers (paid categories only).
 *
 * Pure & deterministic so both consumers compute identical sums.
 */

import { shouldCountRow } from './tripBudgetService';
import { isWalkingLeg } from '@/lib/cost-estimation';

export interface CanonicalCostInputRow {
  cost_per_person_usd: number | null;
  num_travelers: number | null;
  category: string | null;
  day_number: number | null;
  activity_id: string | null;
  source?: string | null;
  is_paid?: boolean | null;
  paid_amount_usd?: number | null;
  id?: string;
}

export interface CanonicalLiveActivity {
  id: string;
  dayNumber: number;
  name: string;
  category: string;
  jsonCost: number;
}

export interface ResolvedRow {
  rowKey: string;                         // stable key for the source row
  effectiveActivityId: string | null;     // post-rescue
  dayNumber: number;
  category: string;                       // raw category from activity_costs
  cents: number;                          // post-rescue, post-toggle
  rescueTag?: 'orphan-id' | 'json-zero' | 'json-missing-row';
  isLogisticsRow: boolean;
  /** Display name (live JSON title) when known. */
  name: string | null;
  /** num_travelers from the source row (defaults to 1). */
  numTravelers: number;
  /** is_paid mirror from activity_costs (best-effort). */
  isPaid: boolean;
  /** paid_amount_usd from activity_costs (null when row never paid). */
  paidAmountUsd: number | null;
  /** source field from activity_costs ('logistics-sync', 'manual', etc.). */
  source: string | null;
}

export interface ResolveResult {
  rows: ResolvedRow[];
  /** Pure canonical total from activity_costs (pre manual fold). */
  totalCents: number;
  hotelCents: number;       // committed (pre-toggle), for reserve math
  flightCents: number;      // committed (pre-toggle), for reserve math
  loggedMiscCents: number;  // for reserve math
  /** Day-0 canonical hotel / flight cents (pre-toggle, pre-manual). */
  canonicalDay0HotelCents: number;
  canonicalDay0FlightCents: number;
  /** Manual-payment fold (override-aware for hotel/flight, additive for others). */
  manualHotelCents: number;
  manualFlightCents: number;
  manualOtherCents: number;
  manualHotelDelta: number;   // (manualHotel - canonicalDay0Hotel) when canonical exists, else manualHotel
  manualFlightDelta: number;  // ditto for flight
  /** totalCents + manualHotelDelta(if includeHotel) + manualFlightDelta(if includeFlight) + manualOtherCents, clamped >=0. */
  effectiveTotalCents: number;
}

export interface CanonicalManualPayment {
  item_type: string;
  item_id: string;
  amount_cents: number;
  quantity?: number | null;
}

const DINING_RE = /\b(breakfast|brunch|lunch|dinner|supper|cafe|café|coffee|bakery|tapas|cocktails?|nightcap|aperitif|drinks?)\b/i;

const PAID_CATS = new Set([
  'dining', 'restaurant', 'breakfast', 'brunch', 'lunch', 'dinner',
  'cafe', 'bar', 'nightlife', 'spa', 'wellness',
]);

export function normalizeCanonicalCategory(rawCat: string, name: string): string {
  const c = (rawCat || '').toLowerCase();
  if (c === 'dining' || c === 'food' || c === 'restaurant' || DINING_RE.test(name)) return 'dining';
  if (['transport', 'transportation', 'taxi', 'metro', 'transit', 'transfer', 'rideshare'].includes(c)) return 'transport';
  if (c === 'nightlife') return 'nightlife';
  if (c === 'shopping') return 'shopping';
  if (c) return 'activity';
  return '';
}

function rowCentsFor(row: CanonicalCostInputRow): number {
  const perPerson = row.cost_per_person_usd || 0;
  const travelers = row.num_travelers || 1;
  // DEV-mode sanity guard: catch rows where cost_per_person_usd was stored
  // as the already-multiplied total (legacy double-store), which would render
  // as 2× the correct amount on Payments and the budget ledger.
  if (
    typeof import.meta !== 'undefined' &&
    (import.meta as any).env?.DEV &&
    travelers > 1 &&
    perPerson > 500
  ) {
    // eslint-disable-next-line no-console
    console.warn('[canonicalCostRows] suspiciously high per-person cost', {
      activity_id: (row as any).activity_id,
      category: (row as any).category,
      cost_per_person_usd: perPerson,
      num_travelers: travelers,
      hint: 'value may have been stored as total instead of per-person',
    });
  }
  return Math.round(perPerson * travelers * 100);
}

export interface ResolveCanonicalArgs {
  costs: CanonicalCostInputRow[];
  liveActivities: CanonicalLiveActivity[];
  includeHotel: boolean;
  includeFlight: boolean;
  /** Optional: trip_payments rows. When provided, manual hotel/flight/other
   *  fold-in is computed inside the resolver so snapshot + payable items
   *  cannot diverge. */
  manualPayments?: CanonicalManualPayment[];
}

export function resolveCanonicalCostRows({
  costs,
  liveActivities,
  includeHotel,
  includeFlight,
  manualPayments,
}: ResolveCanonicalArgs): ResolveResult {
  const liveById = new Map<string, CanonicalLiveActivity>();
  const rescueByDayCat = new Map<string, CanonicalLiveActivity[]>();
  for (const a of liveActivities) {
    liveById.set(a.id, a);
    const mapped = normalizeCanonicalCategory(a.category, a.name);
    if (!mapped) continue;
    const k = `${a.dayNumber}|${mapped}`;
    const arr = rescueByDayCat.get(k) || [];
    arr.push(a);
    rescueByDayCat.set(k, arr);
  }

  const consumed = new Set<string>();
  const cursors = new Map<string, number>();
  const popRescue = (day: number, mapped: string): CanonicalLiveActivity | null => {
    const k = `${day}|${mapped}`;
    const queue = rescueByDayCat.get(k);
    if (!queue || !queue.length) return null;
    let cursor = cursors.get(k) ?? 0;
    while (cursor < queue.length) {
      const e = queue[cursor++];
      if (!consumed.has(e.id)) {
        cursors.set(k, cursor);
        return e;
      }
    }
    cursors.set(k, cursor);
    return null;
  };

  const out: ResolvedRow[] = [];
  let totalCents = 0;
  let hotelCents = 0;
  let flightCents = 0;
  let loggedMiscCents = 0;

  // Two-pass partitioning: rows that directly match a live activity claim
  // their JSON id first, so orphan rescue cannot reassign that same activity
  // to a stale row in the same (day, category) bucket.
  //
  // "Logistics row" means a non-itinerary row that's surfaced separately as
  // hotel-selection / flight-selection (day-0 or null day_number). The
  // `source='logistics-sync'` tag alone is NOT enough — logistics-sync rows
  // can also appear on real itinerary days (e.g. costed transfer legs), and
  // when that happens they must render as normal payable rows in Payments.
  // Treating them as logistics-only was the source of the persistent
  // "Totals differ by $X" drift on transit-heavy itineraries.
  const isLogistics = (row: CanonicalCostInputRow): boolean =>
    row.day_number == null || row.day_number === 0;

  const directRows: CanonicalCostInputRow[] = [];
  const orphanRows: CanonicalCostInputRow[] = [];
  for (const row of costs) {
    if (isLogistics(row)) {
      directRows.push(row);
      continue;
    }
    if (row.activity_id && liveById.has(row.activity_id)) {
      directRows.push(row);
      consumed.add(row.activity_id);
    } else {
      orphanRows.push(row);
    }
  }

  for (const row of [...directRows, ...orphanRows]) {
    const cat = (row.category || '').toLowerCase();
    const dayNumber = row.day_number ?? 0;
    const isLogisticsRow = isLogistics(row);

    let effectiveActivityId: string | null = row.activity_id || null;
    let rescueTag: ResolvedRow['rescueTag'];
    let lookup: CanonicalLiveActivity | null = effectiveActivityId
      ? liveById.get(effectiveActivityId) || null
      : null;

    if (!isLogisticsRow && row.activity_id && !lookup) {
      const mapped = normalizeCanonicalCategory(cat, '');
      const rescued = mapped ? popRescue(dayNumber, mapped) : null;
      if (rescued) {
        consumed.add(rescued.id);
        effectiveActivityId = rescued.id;
        lookup = rescued;
        rescueTag = 'orphan-id';
      } else {
        // Drop: no live activity for this slot.
        continue;
      }
    }

    // Walking legs are always free, regardless of stored category. Skip
    // entirely so the header total agrees with Payments.
    if (lookup && isWalkingLeg({ title: lookup.name })) continue;

    let cents = rowCentsFor(row);

    // $0 JSON rescue (paid categories only)
    if (cents <= 0 && lookup) {
      const looksPaid = PAID_CATS.has(cat) || PAID_CATS.has(lookup.category.toLowerCase());
      if (looksPaid && lookup.jsonCost > 0) {
        cents = Math.round(lookup.jsonCost * (row.num_travelers || 1) * 100);
        rescueTag = rescueTag || 'json-zero';
      }
    }

    // Bookkeeping (pre-toggle, for reserve math)
    if (cat === 'hotel') hotelCents += cents;
    else if (cat === 'flight') flightCents += cents;
    else if (cat === 'misc') loggedMiscCents += cents;

    if (!shouldCountRow(row, includeHotel, includeFlight)) continue;
    if (cents <= 0) continue;

    totalCents += cents;
    out.push({
      rowKey: row.id || `${row.activity_id || 'noid'}_d${dayNumber}_${cat}`,
      effectiveActivityId,
      dayNumber,
      category: cat,
      cents,
      rescueTag,
      isLogisticsRow,
      name: lookup?.name ?? null,
      numTravelers: row.num_travelers || 1,
      isPaid: row.is_paid === true,
      paidAmountUsd: row.paid_amount_usd ?? null,
      source: row.source ?? null,
    });
  }

  // Day-0 canonical hotel/flight (pre-toggle, pre-manual). Used both for
  // override-vs-add manual delta math and exposed for downstream consumers.
  let canonicalDay0HotelCents = 0;
  let canonicalDay0FlightCents = 0;
  for (const row of costs) {
    if (row.day_number !== 0) continue;
    const cat = (row.category || '').toLowerCase();
    const rowCents = rowCentsFor(row);
    if (cat === 'hotel') canonicalDay0HotelCents += rowCents;
    else if (cat === 'flight') canonicalDay0FlightCents += rowCents;
  }

  // Manual-payment fold (override-aware for hotel/flight, additive otherwise).
  // Mirrors the legacy useTripFinancialSnapshot logic but lives here so every
  // consumer (snapshot + payable items) computes identical numbers.
  const isManualId = (id: unknown): id is string =>
    typeof id === 'string' && /^manual[-_]/i.test(id.trim());
  let manualHotelCents = 0;
  let manualFlightCents = 0;
  let manualOtherCents = 0;
  for (const p of manualPayments || []) {
    if (!isManualId(p.item_id)) continue;
    const cents = (p.amount_cents || 0) * (p.quantity || 1);
    const t = (p.item_type || '').toLowerCase();
    if (t === 'hotel') manualHotelCents += cents;
    else if (t === 'flight' || t === 'flights') manualFlightCents += cents;
    else manualOtherCents += cents;
  }
  const manualHotelDelta = canonicalDay0HotelCents > 0
    ? (manualHotelCents - canonicalDay0HotelCents)
    : manualHotelCents;
  const manualFlightDelta = canonicalDay0FlightCents > 0
    ? (manualFlightCents - canonicalDay0FlightCents)
    : manualFlightCents;
  let effectiveTotalCents = totalCents;
  if (includeHotel) effectiveTotalCents += manualHotelDelta;
  if (includeFlight) effectiveTotalCents += manualFlightDelta;
  effectiveTotalCents += manualOtherCents;
  effectiveTotalCents = Math.max(0, effectiveTotalCents);

  return {
    rows: out,
    totalCents,
    hotelCents,
    flightCents,
    loggedMiscCents,
    canonicalDay0HotelCents,
    canonicalDay0FlightCents,
    manualHotelCents,
    manualFlightCents,
    manualOtherCents,
    manualHotelDelta,
    manualFlightDelta,
    effectiveTotalCents,
  };
}
