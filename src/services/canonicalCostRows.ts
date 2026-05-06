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
  category: string;                       // raw
  cents: number;                          // post-rescue
  rescueTag?: 'orphan-id' | 'json-zero';
  isLogisticsRow: boolean;
}

export interface ResolveResult {
  rows: ResolvedRow[];
  totalCents: number;
  hotelCents: number;       // committed (pre-toggle), for reserve math
  flightCents: number;      // committed (pre-toggle), for reserve math
  loggedMiscCents: number;  // for reserve math
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
  return Math.round((row.cost_per_person_usd || 0) * (row.num_travelers || 1) * 100);
}

export interface ResolveCanonicalArgs {
  costs: CanonicalCostInputRow[];
  liveActivities: CanonicalLiveActivity[];
  includeHotel: boolean;
  includeFlight: boolean;
}

export function resolveCanonicalCostRows({
  costs,
  liveActivities,
  includeHotel,
  includeFlight,
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

  for (const row of costs) {
    const cat = (row.category || '').toLowerCase();
    const dayNumber = row.day_number ?? 0;
    const isLogisticsRow =
      row.source === 'logistics-sync' || row.day_number == null || row.day_number === 0;

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
    });
  }

  return { rows: out, totalCents, hotelCents, flightCents, loggedMiscCents };
}
