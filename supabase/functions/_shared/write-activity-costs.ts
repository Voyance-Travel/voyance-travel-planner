/**
 * Shared writer for activity_costs — table-driven from cost_reference.
 * Extracted from generation-core.ts Phase 4 so both generation paths
 * (legacy whole-trip + per-day chain) produce an identical canonical
 * activity_costs snapshot at the end of generation.
 *
 * IMPORTANT: This is a `delete + insert` writer. It owns the trip's
 * activity_costs table (apart from rows the snapshot DOES NOT delete —
 * see logic below). Call ONLY at end of a generation pass.
 *
 * The AI does NOT set costs. All costs come from the cost_reference table
 * for the destination city + budget tier. See mem://core "Cost Integrity".
 */

import { isWalkingLeg } from "./walking-leg.ts";
import { ALWAYS_FREE_VENUE_PATTERNS } from "./always-free-venue-patterns.ts";

export interface WriteCostsContext {
  destination: string;
  travelers: number;
  budgetTier?: string | null;
  /** When set, day totals exceeding budgetCap*1.2 are scaled to budgetCap*1.1. */
  actualDailyBudgetPerPerson?: number | null;
  /**
   * INSERT-only mode for frozen trips. When true, we only INSERT rows for
   * activity_ids that have no existing snapshot row — never delete, never
   * update existing rows. Existing prices stay exactly as the user first saw
   * them. See mem://constraints/itinerary/frozen-after-ready.
   */
  insertOnly?: boolean;
}

export interface WriteCostsResult {
  inserted: number;
  skippedExisting?: number;
  skippedReason?: string;
}

const transportKw: Record<string, string[]> = {
  taxi: ['taxi', 'cab', 'uber', 'grab', 'lyft', 'ride', 'private car', 'rideshare'],
  airport_transfer: ['airport transfer', 'airport shuttle', 'airport bus', 'airport express'],
  metro: ['metro', 'subway', 'mrt', 'mtr', 'underground'],
  bus: ['bus', 'shuttle bus', 'city bus'],
  train: ['train', 'rail', 'shinkansen'],
  ferry: ['ferry', 'boat', 'water taxi', 'star ferry', 'junk boat'],
};
const diningKw: Record<string, string[]> = {
  street_food: ['street food', 'hawker', 'night market food', 'dai pai dong', 'food stall'],
  cafe: ['cafe', 'café', 'coffee', 'bakery'],
  breakfast: ['breakfast', 'morning meal'],
  lunch: ['lunch', 'brunch'],
  dinner: ['dinner', 'supper'],
  ramen: ['ramen', 'noodle shop'],
  fine_dining: ['fine dining', 'michelin', 'omakase', 'tasting menu'],
};

function inferSubcategory(title: string, category: string): string | null {
  const t = title.toLowerCase();
  if (category === 'transport') {
    for (const [sub, kws] of Object.entries(transportKw)) {
      if (kws.some(kw => t.includes(kw))) return sub;
    }
  }
  if (category === 'dining') {
    for (const [sub, kws] of Object.entries(diningKw)) {
      if (kws.some(kw => t.includes(kw))) return sub;
    }
  }
  if (category === 'activity') {
    if (t.includes('museum')) return 'museum';
    if (t.includes('temple') || t.includes('shrine')) return 'temple';
    if (t.includes('tour')) return 'tour';
  }
  return null;
}

const categoryMap: Record<string, string> = {
  dining: 'dining', breakfast: 'dining', brunch: 'dining', lunch: 'dining',
  dinner: 'dining', cafe: 'dining', coffee: 'dining', food: 'dining', restaurant: 'dining',
  transport: 'transport', transportation: 'transport', taxi: 'transport', metro: 'transport',
  activity: 'activity', attraction: 'activity', museum: 'activity', tour: 'activity',
  sightseeing: 'activity', experience: 'activity', entertainment: 'activity',
  nightlife: 'nightlife', bar: 'nightlife', club: 'nightlife',
  shopping: 'shopping', market: 'shopping',
  // Logistics categories — preserved as-is so flight/hotel rows aren't
  // misclassified as 'activity' (closes "Arrival Flight" → category=activity bug).
  flight: 'flight', flights: 'flight',
  hotel: 'hotel', accommodation: 'hotel', stay: 'hotel',
};

const USER_AUTHORED_BASES = new Set(['user', 'user_override', 'imported', 'booked']);
const PRESERVE_CATEGORY_SET = new Set(['flight', 'hotel']);

/**
 * Extract the per-person USD price the AI / repair pipeline emitted on this
 * activity. Returns null when no usable price is on the JSON. Order mirrors
 * the card-side reader (`getActivityCostInfo` in EditorialItinerary.tsx) so
 * ledger writes match what the card already chose to display.
 */
function extractJsonPerPersonUsd(act: any, travelers: number): { amount: number; basis: string; source: string } | null {
  if (!act) return null;
  const t = Math.max(1, travelers || 1);
  const costObj = act.cost && typeof act.cost === 'object' ? act.cost : null;
  const rawAmount = costObj && typeof costObj.amount === 'number' && !isNaN(costObj.amount) ? costObj.amount : undefined;
  const basis = String(costObj?.basis || '').toLowerCase();
  const sourceRaw = String(costObj?.source || '').toLowerCase();

  // Explicit per-person basis
  if (rawAmount !== undefined && rawAmount > 0 && basis === 'per_person') {
    return { amount: rawAmount, basis: 'per_person', source: USER_AUTHORED_BASES.has(sourceRaw) ? sourceRaw : (sourceRaw || 'json') };
  }
  // Group/flat total — divide back to per-person
  if (rawAmount !== undefined && rawAmount > 0 && (basis === 'flat' || basis === 'group' || basis === 'total')) {
    return { amount: rawAmount / t, basis: 'flat', source: USER_AUTHORED_BASES.has(sourceRaw) ? sourceRaw : (sourceRaw || 'json') };
  }
  // Normalised root-level price fields
  const pp = typeof act.price_per_person === 'number' ? act.price_per_person : undefined;
  if (pp !== undefined && pp > 0) {
    return { amount: pp, basis: 'per_person', source: 'json' };
  }
  const epp = typeof act.estimated_price_per_person === 'number' ? act.estimated_price_per_person : undefined;
  if (epp !== undefined && epp > 0) {
    return { amount: epp, basis: 'per_person', source: 'json' };
  }
  // Legacy AI rows: bare cost.amount with no basis — every downstream reader
  // (card via getLedgerOverride, snapshot, payments) already treats this as
  // per-person, so the writer must too.
  if (rawAmount !== undefined && rawAmount > 0) {
    return { amount: rawAmount, basis: 'per_person', source: USER_AUTHORED_BASES.has(sourceRaw) ? sourceRaw : (sourceRaw || 'json') };
  }
  return null;
}

export async function writeActivityCostsFromItinerary(
  supabase: any,
  tripId: string,
  days: any[],
  context: WriteCostsContext,
): Promise<WriteCostsResult> {
  if (!Array.isArray(days) || days.length === 0) {
    return { inserted: 0, skippedReason: 'no-days' };
  }

  const destinationCity = (context.destination || '').split(',')[0].trim();
  const cityKey = destinationCity.toLowerCase();
  const budgetTier = (context.budgetTier || 'moderate').toLowerCase();

  // Load cost_reference for this destination + global fallbacks
  const { data: allRefs } = await supabase
    .from('cost_reference')
    .select('*')
    .or(`destination_city.ilike.${destinationCity},destination_city.eq._global`);

  // Build lookup map: city|category|subcategory → ref row (city-specific wins over global)
  const refMap = new Map<string, any>();
  if (allRefs) {
    const sorted = [...allRefs].sort((a: any, b: any) =>
      (a.destination_city === '_global' ? 0 : 1) - (b.destination_city === '_global' ? 0 : 1)
    );
    for (const r of sorted) {
      const prefix = r.destination_city === '_global' ? '_global' : cityKey;
      if (r.subcategory) {
        refMap.set(`${prefix}|${r.category}|${r.subcategory}`, r);
        if (r.destination_city === '_global') {
          refMap.set(`_fb|${r.category}|${r.subcategory}`, r);
        }
      }
      const catKey = `${prefix}|${r.category}|`;
      if (!refMap.has(catKey)) refMap.set(catKey, r);
      if (r.destination_city === '_global') {
        const fbCatKey = `_fb|${r.category}|`;
        if (!refMap.has(fbCatKey)) refMap.set(fbCatKey, r);
      }
    }
  }

  const costRows: Array<Record<string, unknown>> = [];

  for (const day of days) {
    for (const act of (day?.activities || [])) {
      const cat = (act.category || 'activity').toLowerCase();
      if (['downtime', 'free_time', 'accommodation'].includes(cat)) continue;

      const mappedCategory = categoryMap[cat] || 'activity';
      const titleStr = ((act as any).title || '').trim();
      const titleLower = titleStr.toLowerCase();

      // Walking legs are always free.
      if (isWalkingLeg({
        title: (act as any).title || (act as any).name,
        description: (act as any).description,
        bookingRequired: (act as any).booking_required,
      })) {
        costRows.push({
          trip_id: tripId,
          activity_id: act.id,
          day_number: day.dayNumber || 1,
          cost_per_person_usd: 0,
          num_travelers: context.travelers || 1,
          category: mappedCategory,
          source: 'walking_free',
          confidence: 'high',
          notes: '[Walking — free]',
        });
        continue;
      }

      // Unverified meal slots stay $0.
      const venueStr = ((act as any).location?.name || (act as any).venue_name || '').trim();
      const meta = (act as any).metadata || {};
      const isUnverifiedMeal =
        mappedCategory === 'dining' && (
          meta.needsVenuePick === true ||
          meta.unverified_venue === true ||
          /(highly|top|well)[-\s]rated\s+(neighborhood\s+)?(restaurant|caf[eé]|bistro|trattoria|spot|eatery|venue|place)/i.test(titleStr) ||
          /(highly|top|well)[-\s]rated\s+(neighborhood\s+)?(restaurant|caf[eé]|bistro|trattoria|spot|eatery|venue|place)/i.test(venueStr) ||
          /[—\-:]\s*pick a (restaurant|caf[eé])\b/i.test(titleStr) ||
          /^pick a (restaurant|caf[eé])$/i.test(venueStr) ||
          /^local\s+specialty\s+caf[eé]$/i.test(venueStr)
        );
      if (isUnverifiedMeal) {
        costRows.push({
          trip_id: tripId,
          activity_id: act.id,
          day_number: day.dayNumber || 1,
          cost_per_person_usd: 0,
          num_travelers: context.travelers || 1,
          category: mappedCategory,
          source: 'unverified_meal',
          confidence: 'low',
        });
        continue;
      }

      // Free venue check
      const allActivityText = [
        (act as any).title || '',
        (act as any).description || '',
        (act as any).venue_name || '',
        (act as any).place_name || '',
        (act as any).location?.name || '',
        (act as any).address || '',
        (act as any).restaurant?.name || '',
      ].join(' ');

      const isPaidExp = (act as any).booking_required ||
        /\b(tour|guided|ticket|admission|entry|botanical|bot[âa]nico)\b/i.test(allActivityText);

      if (ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test(allActivityText)) && !isPaidExp) {
        costRows.push({
          trip_id: tripId,
          activity_id: act.id,
          day_number: day.dayNumber || 1,
          cost_per_person_usd: 0,
          num_travelers: context.travelers || 1,
          category: mappedCategory,
          source: 'free_venue',
          confidence: 'high',
        });
        continue;
      }

      // STEP 1: Honor the per-person USD price the AI/repair pipeline already
      // wrote onto this activity. This makes the ledger faithfully record what
      // the card was meant to show; otherwise we silently overwrite a $60
      // dinner with a $30 city-tier reference and the card vs Budget tab
      // diverge by exactly that factor. User/imported/booked rows are written
      // through verbatim and bypass the daily-cap scaler.
      const jsonPrice = extractJsonPerPersonUsd(act, context.travelers || 1);
      const isUserAuthored = jsonPrice ? USER_AUTHORED_BASES.has(jsonPrice.source) : false;

      // For logistics categories (flight/hotel) we never consult cost_reference
      // — those rows are written by separate logistics-sync paths. If the JSON
      // carries a number, store it; otherwise leave as $0 so logistics-sync
      // can fill in later.
      if (PRESERVE_CATEGORY_SET.has(mappedCategory)) {
        // Placeholder departure/return flight stubs ("Departure Flight",
        // "Return Flight") render as Free in the itinerary and have no
        // user/booked basis — they must NOT carry a hard cost in
        // activity_costs, otherwise they leak into buckets.activities (or
        // buckets.flight when day > 0) and Payments shows a phantom $50
        // bookable line item. Mirrors the FE PLACEHOLDER_FLIGHT_TITLE_RE in
        // src/hooks/usePayableItems.ts. The canonical day-0 flight chip
        // remains the only priced flight row. See plan §2.
        const isPlaceholderFlight =
          mappedCategory === 'flight' &&
          /^\s*(departure|return|outbound|inbound)\s+flight\b/i.test(titleStr) &&
          (!jsonPrice || !USER_AUTHORED_BASES.has(jsonPrice.source));
        costRows.push({
          trip_id: tripId,
          activity_id: act.id,
          day_number: day.dayNumber || 1,
          cost_per_person_usd: isPlaceholderFlight ? 0 : Math.min(jsonPrice?.amount ?? 0, 5000),
          num_travelers: context.travelers || 1,
          category: mappedCategory,
          source: isPlaceholderFlight
            ? 'placeholder_departure_flight'
            : (jsonPrice ? jsonPrice.source : 'logistics-placeholder'),
          confidence: isPlaceholderFlight ? 'high' : (jsonPrice ? 'high' : 'low'),
        });
        continue;
      }

      // cost_reference lookup (used as fallback when JSON has no price)
      const subcategory = inferSubcategory(titleLower, mappedCategory);
      let ref: any = null;
      if (subcategory) ref = refMap.get(`${cityKey}|${mappedCategory}|${subcategory}`);
      if (!ref) ref = refMap.get(`${cityKey}|${mappedCategory}|`);
      if (!ref && subcategory) ref = refMap.get(`_fb|${mappedCategory}|${subcategory}`);
      if (!ref) ref = refMap.get(`_fb|${mappedCategory}|`);

      let costPerPerson: number;
      let costRefId: string | null = null;
      let source = 'reference';
      let confidence: string = 'medium';
      let skipCapScaling = false;

      if (jsonPrice && jsonPrice.amount > 0) {
        // AI/repair-emitted price wins. Reference acts as a sanity floor only
        // when the JSON price is implausibly low for the category.
        const refMidForFloor = ref
          ? (() => {
              switch (budgetTier) {
                case 'budget': case 'saver': return Number(ref.cost_low_usd) || 0;
                case 'premium': case 'luxury': return Number(ref.cost_high_usd) || 0;
                default: return Number(ref.cost_mid_usd) || 0;
              }
            })()
          : 0;
        const floor = refMidForFloor > 0 ? refMidForFloor * 0.4 : 0;
        if (!isUserAuthored && floor > 0 && jsonPrice.amount < floor) {
          costPerPerson = refMidForFloor;
          costRefId = ref?.id || null;
          source = 'reference';
          confidence = ref?.confidence || 'medium';
        } else {
          costPerPerson = jsonPrice.amount;
          source = jsonPrice.source; // 'json' | 'user' | 'imported' | 'booked' | 'user_override'
          confidence = isUserAuthored ? 'high' : 'high';
          if (isUserAuthored) skipCapScaling = true;
        }
      } else if (ref) {
        costRefId = ref.id;
        switch (budgetTier) {
          case 'budget': case 'saver': costPerPerson = Number(ref.cost_low_usd); break;
          case 'moderate': case 'comfort': costPerPerson = Number(ref.cost_mid_usd); break;
          case 'premium': case 'luxury': costPerPerson = Number(ref.cost_high_usd); break;
          default: costPerPerson = Number(ref.cost_mid_usd);
        }
        confidence = ref.confidence || 'medium';
      } else {
        const defaults: Record<string, number> = {
          dining: 20, transport: 10, activity: 15, nightlife: 15, shopping: 15,
        };
        costPerPerson = defaults[mappedCategory] || 15;
        source = 'fallback';
        confidence = 'low';
      }

      // Round to nearest $5 (except amounts < $5). Skip rounding for
      // user-authored prices — those are exact and must round-trip.
      if (!isUserAuthored && costPerPerson >= 5) {
        costPerPerson = Math.round(costPerPerson / 5) * 5;
      }

      costRows.push({
        trip_id: tripId,
        activity_id: act.id,
        day_number: day.dayNumber || 1,
        cost_per_person_usd: Math.min(costPerPerson, 2000),
        num_travelers: context.travelers || 1,
        category: mappedCategory,
        source,
        confidence,
        cost_reference_id: costRefId,
        ...(skipCapScaling ? { notes: '[user-authored — cap-exempt]' } : {}),
      });
    }
  }

  // Per-day budget-cap scaling
  const dailyCap = context.actualDailyBudgetPerPerson;
  if (costRows.length > 0 && dailyCap != null && dailyCap > 0) {
    const tolerance = 1.2;
    const dayGroups = new Map<number, typeof costRows>();
    for (const row of costRows) {
      const dayNum = row.day_number as number;
      if (!dayGroups.has(dayNum)) dayGroups.set(dayNum, []);
      dayGroups.get(dayNum)!.push(row);
    }
    for (const [, rows] of dayGroups) {
      const dayTotal = rows.reduce((sum, r) => sum + (r.cost_per_person_usd as number), 0);
      if (dayTotal > dailyCap * tolerance) {
        const scaleFactor = (dailyCap * 1.1) / dayTotal;
        for (const row of rows) {
          // Skip user/imported/booked rows — their price is authoritative and
          // must never be silently scaled down by the budget-cap pass.
          if (USER_AUTHORED_BASES.has(String((row as any).source || ''))) continue;
          const original = row.cost_per_person_usd as number;
          let scaled = original * scaleFactor;
          if (scaled >= 5) scaled = Math.round(scaled / 5) * 5;
          else if (scaled > 0) scaled = Math.max(1, Math.round(scaled));
          (row as any).cost_per_person_usd = scaled;
          (row as any).notes = `[Budget-scaled from $${original.toFixed(0)}]`;
        }
      }
    }

  }

  if (costRows.length === 0) {
    return { inserted: 0, skippedReason: 'no-rows' };
  }

  // delete + insert: this writer owns activity_costs rows for this trip's
  // itinerary days. Day-0 logistics (hotel/flight) rows live in activity_costs
  // too but are written by separate logistics-sync paths; preserve them by
  // restricting the delete to day_number > 0.
  //
  // FROZEN trips switch to INSERT-only: never delete, never update existing
  // snapshot rows — append rows only for activity_ids that have no row yet.
  if (context.insertOnly) {
    const ids = costRows.map((r) => r.activity_id).filter(Boolean) as string[];
    if (ids.length === 0) return { inserted: 0, skippedReason: 'no-rows' };
    const { data: existingRows } = await supabase
      .from('activity_costs')
      .select('activity_id')
      .eq('trip_id', tripId)
      .in('activity_id', ids);
    const existingSet = new Set<string>(
      (existingRows || []).map((r: any) => String(r.activity_id)),
    );
    const toInsert = costRows.filter((r) => !existingSet.has(String(r.activity_id)));
    const skippedExisting = costRows.length - toInsert.length;
    if (toInsert.length === 0) {
      console.log(
        `[writeActivityCostsFromItinerary] [SYNC_FROZEN_INSERT_ONLY] inserted=0 skipped_existing=${skippedExisting} trip=${tripId}`,
      );
      return { inserted: 0, skippedExisting, skippedReason: 'all-existing' };
    }
    const { error: insErr } = await supabase.from('activity_costs').insert(toInsert);
    if (insErr) {
      console.warn('[writeActivityCostsFromItinerary] insert-only error:', insErr.message);
      return { inserted: 0, skippedExisting, skippedReason: `insert-error:${insErr.message}` };
    }
    console.log(
      `[writeActivityCostsFromItinerary] [SYNC_FROZEN_INSERT_ONLY] inserted=${toInsert.length} skipped_existing=${skippedExisting} trip=${tripId}`,
    );
    return { inserted: toInsert.length, skippedExisting };
  }

  await supabase.from('activity_costs').delete().eq('trip_id', tripId).gt('day_number', 0);
  const { error: costErr } = await supabase.from('activity_costs').insert(costRows);
  if (costErr) {
    console.warn('[writeActivityCostsFromItinerary] insert error:', costErr.message);
    return { inserted: 0, skippedReason: `insert-error:${costErr.message}` };
  }
  console.log(`[writeActivityCostsFromItinerary] Wrote ${costRows.length} rows for trip ${tripId}`);
  return { inserted: costRows.length };
}
