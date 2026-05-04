/**
 * usePayableItems — Single source of truth for Payments tab line items.
 *
 * After the reconciliation pass (May 2026): activity costs come ONLY from the
 * `activity_costs` DB table, never from a JSON-walk + estimateCostSync fallback.
 * This guarantees Payments grand total === Budget header total === per-day badges.
 *
 * Transport rows (`category in (transport, transit, transfer, taxi)`) are grouped
 * into a single collapsible "Local transit — Day N" row so users don't see a
 * parade of $50 micro-leg taxis that never appeared as costed cards in the itinerary.
 */

import { useMemo } from 'react';
import type { TripPayment } from '@/services/tripPaymentsAPI';
import { estimateCostSync, isLikelyFreePublicVenue, isPlaceholderDepartureTransfer, isPlaceholderDepartureTransferTitle, isUnconfirmedIntraCityTaxi } from '@/lib/cost-estimation';

export interface PayableSubItem {
  id: string;
  name: string;
  amountCents: number;
}

export type PayableItemType = 'flight' | 'hotel' | 'activity' | 'dining' | 'transport' | 'shopping' | 'other';

export interface PayableItem {
  id: string;
  type: PayableItemType;
  name: string;
  amountCents: number;
  dayNumber?: number;
  payment?: TripPayment;
  allPayments: TripPayment[];
  assignedMemberId?: string;
  assignedMemberIds: string[];
  /** When set, this item represents a grouped row (e.g. local transit per day). */
  subItems?: PayableSubItem[];
  /** Visual hint for grouped rows. */
  groupKind?: 'transit';
}

interface ActivityCostRow {
  cost_per_person_usd: number;
  num_travelers: number;
  category: string;
  day_number: number;
  activity_id: string;
}

interface PayableItemsInput {
  days: Array<{
    dayNumber: number;
    activities: Array<{
      id: string;
      title?: string;
      name?: string;
      type?: string;
      category?: string;
      priceLevel?: number;
      price_level?: number;
      cost?: any;
      explicitCost?: number;
    }>;
  }>;
  flightSelection?: {
    outbound?: { price?: number; airline?: string };
    return?: { price?: number; airline?: string };
    legs?: { price?: number; airline?: string }[];
    totalPrice?: number;
  } | null;
  hotelSelection?: {
    name?: string;
    totalPrice?: number;
    pricePerNight?: number;
  } | null;
  travelers: number;
  payments: TripPayment[];
  budgetTier?: string;
  destination?: string;
  destinationCountry?: string;
  activityCosts?: ActivityCostRow[] | null;
  /** When false, suppress canonical hotel/flight rows to avoid flashing duplicates before payments load. */
  paymentsLoaded?: boolean;
  /** Trip-level inclusion toggles. Must mirror useTripFinancialSnapshot so the
   *  Payments list and the Trip Total agree on which logistics rows count. */
  includeHotel?: boolean;
  includeFlight?: boolean;
  /**
   * When true (legacy), missing itinerary activities are surfaced with a
   * client-side estimate that gets added to the grand total. This causes
   * persistent drift from the canonical activity_costs ledger and was the
   * root cause of the sticky "Reconciling…" badge.
   *
   * When false (default for Payments tab), missing items are still surfaced
   * for transparency but priced at $0 so the Payments total matches the
   * canonical ledger total exactly.
   */
  estimateMissingCosts?: boolean;
}

const TRANSIT_CATEGORIES = new Set([
  'transport', 'transportation', 'transit', 'transfer', 'taxi', 'rideshare',
]);

export interface PayableItemsResult {
  items: PayableItem[];
  totalCents: number;
  essentialItems: PayableItem[];
  activityItems: PayableItem[];
}

function rowTotalCents(row: ActivityCostRow): number {
  return Math.round((row.cost_per_person_usd || 0) * (row.num_travelers || 1) * 100);
}

export function usePayableItems({
  days,
  flightSelection,
  hotelSelection,
  travelers,
  payments,
  activityCosts: activityCostsRaw,
  budgetTier,
  destination,
  destinationCountry,
  paymentsLoaded = true,
  includeHotel = true,
  includeFlight = false,
  estimateMissingCosts = false,
}: PayableItemsInput): PayableItemsResult {
  // Apply trip-level inclusion toggles so the visible Payments total matches
  // the Trip Total computed by useTripFinancialSnapshot (shouldCountRow).
  const activityCosts = useMemo(() => {
    if (!activityCostsRaw) return activityCostsRaw;
    return activityCostsRaw.filter((row) => {
      const cat = (row.category || '').toLowerCase();
      if (cat === 'hotel' && !includeHotel) return false;
      if ((cat === 'flight' || cat === 'flights') && !includeFlight) return false;
      return true;
    });
  }, [activityCostsRaw, includeHotel, includeFlight]);
  // Build a lookup: activity_id -> display name + cost from JSON itinerary.
  // The cost is used as a rescue fallback when the activity_costs DB row is
  // bogusly $0 (e.g. a restaurant misclassified as a "Free venue - Tier 1").
  const activityNameById = useMemo(() => {
    const map = new Map<string, { name: string; dayNumber: number; jsonCost: number; category: string }>();
    days.forEach(day => {
      day.activities.forEach(a => {
        if (!a?.id) return;
        const name = a.title || a.name || 'Activity';
        const explicit = typeof a.cost === 'number' ? a.cost
          : (a.cost && typeof a.cost === 'object' && typeof (a.cost as any).amount === 'number') ? (a.cost as any).amount
          : (typeof a.explicitCost === 'number' ? a.explicitCost : 0);
        const category = (a.category || a.type || '').toLowerCase();
        map.set(a.id, { name, dayNumber: day.dayNumber, jsonCost: Number(explicit) || 0, category });
      });
    });
    return map;
  }, [days]);

  // Secondary index used to rescue orphaned activity_costs rows whose
  // activity_id no longer exists in itinerary_data (a late quality pass
  // swapped the activity and minted a new uuid). We pop a name from the
  // matching (day, category) queue so the All Costs / Split Bill view
  // shows the real venue rather than "Meal".
  const orphanRescueByDayCat = useMemo(() => {
    const DINING_RE = /\b(breakfast|brunch|lunch|dinner|supper|cafe|café|coffee|bakery|tapas|cocktails?|nightcap|aperitif|drinks?)\b/i;
    const map = new Map<string, string[]>();
    days.forEach(day => {
      day.activities.forEach(a => {
        const name = (a?.title || a?.name || '').toString().trim();
        if (!name) return;
        const rawCat = (a?.category || a?.type || '').toString().toLowerCase();
        let mapped = '';
        if (rawCat === 'dining' || rawCat === 'food' || rawCat === 'restaurant' || DINING_RE.test(name)) mapped = 'dining';
        else if (['transport', 'transportation', 'taxi', 'metro', 'transit', 'transfer'].includes(rawCat)) mapped = 'transport';
        else if (rawCat === 'nightlife') mapped = 'nightlife';
        else if (rawCat === 'shopping') mapped = 'shopping';
        else if (rawCat) mapped = 'activity';
        if (!mapped) return;
        const k = `${day.dayNumber}|${mapped}`;
        const arr = map.get(k) || [];
        arr.push(name);
        map.set(k, arr);
      });
    });
    return map;
  }, [days]);


  const isManualId = (id: unknown): id is string =>
    typeof id === 'string' && /^manual[-_]/i.test(id.trim());

  const hasManualHotel = useMemo(
    () => payments.some(p => p.item_type === 'hotel' && isManualId(p.item_id)),
    [payments]
  );
  const hasManualFlight = useMemo(
    () => payments.some(p => p.item_type === 'flight' && isManualId(p.item_id)),
    [payments]
  );

  const items = useMemo(() => {
    const result: PayableItem[] = [];

    // ─── Flight from selection (UI source) ───
    // Skip canonical flight if user has a manual flight override (avoids double-count).
    // Also suppress until payments load to prevent a brief duplicate flash.
    const flightTotal = (hasManualFlight || !paymentsLoaded) ? 0 : (
      flightSelection?.totalPrice
      || (flightSelection?.legs?.reduce((s, l) => s + (l?.price || 0), 0) || 0)
      || ((flightSelection?.outbound?.price || 0) + (flightSelection?.return?.price || 0))
    );

    if (flightTotal > 0) {
      const flightId = 'flight-selection';
      const flightPayments = payments.filter(p => p.item_type === 'flight' && p.item_id === flightId);
      const assignedIds = flightPayments
        .map(p => (p as any)?.assigned_member_id)
        .filter(Boolean) as string[];
      const flightAirline = flightSelection?.outbound?.airline
        || flightSelection?.legs?.[0]?.airline;
      result.push({
        id: flightId,
        type: 'flight',
        name: `Round-trip Flight${flightAirline ? ` (${flightAirline})` : ''}`,
        amountCents: Math.round(flightTotal * 100),
        payment: flightPayments[0],
        allPayments: flightPayments,
        assignedMemberId: assignedIds[0],
        assignedMemberIds: [...new Set(assignedIds)],
      });
    } else if (activityCosts?.length && !hasManualFlight && paymentsLoaded) {
      const flightRow = activityCosts.find(r => (r.category || '').toLowerCase() === 'flight' && r.day_number === 0);
      if (flightRow && flightRow.cost_per_person_usd > 0) {
        const flightId = 'flight-selection';
        const flightPayments = payments.filter(p => p.item_type === 'flight' && p.item_id === flightId);
        const assignedIds = flightPayments
          .map(p => (p as any)?.assigned_member_id)
          .filter(Boolean) as string[];
        result.push({
          id: flightId,
          type: 'flight',
          name: 'Round-trip Flight',
          amountCents: rowTotalCents(flightRow),
          payment: flightPayments[0],
          allPayments: flightPayments,
          assignedMemberId: assignedIds[0],
          assignedMemberIds: [...new Set(assignedIds)],
        });
      }
    }

    // ─── Hotel from selection ───
    if (paymentsLoaded && !hasManualHotel && (hotelSelection?.totalPrice || hotelSelection?.pricePerNight)) {
      const hotelId = 'hotel-selection';
      const hotelPayments = payments.filter(p => p.item_type === 'hotel' && p.item_id === hotelId);
      const nights = Math.max(1, days.length - 1);
      const hotelPrice = hotelSelection.totalPrice || (hotelSelection.pricePerNight || 0) * nights;
      const assignedIds = hotelPayments
        .map(p => (p as any)?.assigned_member_id)
        .filter(Boolean) as string[];
      result.push({
        id: hotelId,
        type: 'hotel',
        name: hotelSelection.name || 'Hotel Accommodation',
        amountCents: Math.round(hotelPrice * 100),
        payment: hotelPayments[0],
        allPayments: hotelPayments,
        assignedMemberId: assignedIds[0],
        assignedMemberIds: [...new Set(assignedIds)],
      });
    } else if (paymentsLoaded && activityCosts?.length && !hasManualHotel) {
      // Fallback: hotel cost stored as day_number=0 row
      const hotelRow = activityCosts.find(r => (r.category || '').toLowerCase() === 'hotel' && r.day_number === 0);
      if (hotelRow && hotelRow.cost_per_person_usd > 0) {
        const hotelId = 'hotel-selection';
        const hotelPayments = payments.filter(p => p.item_type === 'hotel' && p.item_id === hotelId);
        const assignedIds = hotelPayments
          .map(p => (p as any)?.assigned_member_id)
          .filter(Boolean) as string[];
        result.push({
          id: hotelId,
          type: 'hotel',
          name: 'Hotel Accommodation',
          amountCents: rowTotalCents(hotelRow),
          payment: hotelPayments[0],
          allPayments: hotelPayments,
          assignedMemberId: assignedIds[0],
          assignedMemberIds: [...new Set(assignedIds)],
        });
      }
    }

    // ─── Manual entries from payments (flight/hotel + new categories) ───
    const addManualGroups = (itemType: PayableItemType) => {
      const manualPayments = payments.filter(p =>
        p.item_type === itemType && isManualId(p.item_id)
      );
      const groups = new Map<string, TripPayment[]>();
      manualPayments.forEach(p => {
        const group = groups.get(p.item_id) || [];
        group.push(p);
        groups.set(p.item_id, group);
      });
      groups.forEach((group, itemId) => {
        const primary = group[0];
        const assignedIds = group.map(p => (p as any)?.assigned_member_id).filter(Boolean) as string[];
        result.push({
          id: itemId,
          type: itemType,
          name: primary.item_name,
          amountCents: primary.amount_cents,
          payment: primary,
          allPayments: group,
          assignedMemberId: assignedIds[0],
          assignedMemberIds: [...new Set(assignedIds)],
        });
      });
    };
    addManualGroups('flight');
    addManualGroups('hotel');
    addManualGroups('dining');
    addManualGroups('transport');
    addManualGroups('shopping');
    addManualGroups('other');

    // ─── DB-driven activity rows: ONE per non-transit row, grouped per day for transit ───
    if (activityCosts?.length) {
      const transitByDay = new Map<number, { totalCents: number; subItems: PayableSubItem[] }>();

      for (const row of activityCosts) {
        if (row.day_number === 0) continue; // hotel/flight handled above
        // Orphan guard: any row whose activity_id no longer exists in the
        // itinerary JSON is leftover from a prior swap. Surfacing it would
        // produce duplicate-looking line items (same venue, two prices)
        // because the orphan-rescue logic below assigns the live activity's
        // name. Drop it. Logistics rows (day_number=0) handled above.
        if (row.activity_id && !activityNameById.has(row.activity_id)) continue;
        const cat = (row.category || '').toLowerCase();
        let cents = rowTotalCents(row);

        // Rescue: if the DB row is $0 but the itinerary JSON has an explicit
        // positive cost, trust the JSON. This catches restaurants that the
        // cost-repair pipeline misclassified as "Free venue - Tier 1".
        if (cents <= 0) {
          const lookup = activityNameById.get(row.activity_id);
          const PAID_CATS = new Set(['dining', 'restaurant', 'breakfast', 'brunch', 'lunch', 'dinner', 'cafe', 'bar', 'nightlife', 'spa', 'wellness']);
          const isPaidCat = PAID_CATS.has(cat) || (lookup && PAID_CATS.has(lookup.category));
          if (isPaidCat && lookup && lookup.jsonCost > 0) {
            cents = Math.round(lookup.jsonCost * (row.num_travelers || 1) * 100);
          }
        }
        if (cents <= 0) continue; // genuinely free venues: don't surface

        // Group transit rows
        if (TRANSIT_CATEGORIES.has(cat)) {
          const lookup = activityNameById.get(row.activity_id);
          // Skip placeholder departure transfers — no mode chosen, no committed price.
          if (lookup && isPlaceholderDepartureTransferTitle(lookup.name)) {
            continue;
          }
          // Skip unconfirmed intra-city taxi/rideshare legs (auto-titled "Taxi to X").
          if (lookup && isUnconfirmedIntraCityTaxi({ title: lookup.name, category: cat })) {
            continue;
          }
          const bucket = transitByDay.get(row.day_number) || { totalCents: 0, subItems: [] };
          const subName = lookup?.name || 'Local transit';
          bucket.subItems.push({
            id: row.activity_id,
            name: subName,
            amountCents: cents,
          });
          bucket.totalCents += cents;
          transitByDay.set(row.day_number, bucket);
          continue;
        }

        // Non-transit: one payable item per row, name from JSON itinerary
        const lookup = activityNameById.get(row.activity_id);
        const compositeId = `${row.activity_id}_d${row.day_number}`;
        const activityPayments = payments.filter(p => p.item_type === 'activity' && p.item_id === compositeId);
        const assignedIds = activityPayments
          .map(p => (p as any)?.assigned_member_id)
          .filter(Boolean) as string[];

        // Orphan-rescue name reassignment removed. The orphan guard above
        // already skips any row whose activity_id is not in the live
        // itinerary, so by this point we either have a real lookup or this
        // is a row legitimately missing JSON metadata. Re-using a live
        // activity's name for an unrelated row was the root cause of the
        // duplicate "Lunch at Le Comptoir du Relais" symptom.
        const rescuedName = '';

        // If we don't have a JSON name, fall back to a category-derived label.
        // This avoids leaking an opaque UUID into the UI.
        const fallbackLabel =
          cat === 'dining' ? 'Meal' :
          cat === 'activity' ? 'Activity' :
          cat.charAt(0).toUpperCase() + cat.slice(1);

        result.push({
          id: compositeId,
          type: 'activity',
          name: lookup?.name || rescuedName || fallbackLabel,
          amountCents: cents,
          dayNumber: row.day_number,
          payment: activityPayments[0],
          allPayments: activityPayments,
          assignedMemberId: assignedIds[0],
          assignedMemberIds: [...new Set(assignedIds)],
        });
      }

      // Emit one grouped transit row per day
      const sortedTransitDays = Array.from(transitByDay.entries()).sort((a, b) => a[0] - b[0]);
      for (const [dayNumber, { totalCents, subItems }] of sortedTransitDays) {
        const groupId = `transit-d${dayNumber}`;
        const groupPayments = payments.filter(p => p.item_type === 'activity' && p.item_id === groupId);
        const assignedIds = groupPayments
          .map(p => (p as any)?.assigned_member_id)
          .filter(Boolean) as string[];
        result.push({
          id: groupId,
          type: 'activity',
          name: `Local transit — Day ${dayNumber}`,
          amountCents: totalCents,
          dayNumber,
          payment: groupPayments[0],
          allPayments: groupPayments,
          assignedMemberId: assignedIds[0],
          assignedMemberIds: [...new Set(assignedIds)],
          subItems,
          groupKind: 'transit',
        });
      }
    }

    // Manual activity expenses
    addManualGroups('activity');

    // ─── JSON-walk fallback: surface every itinerary activity not already in result ───
    // The activity_costs DB table only holds rows that the cost pipeline has processed.
    // Without this fallback, anything not yet costed (or stored as $0) silently disappears
    // from the Payments tab, even though users see the activity on its day card.
    //
    // IMPORTANT: This block is gated by `estimateMissingCosts` because client-side
    // estimates here drift from the canonical activity_costs ledger and were the
    // root cause of the persistent "Reconciling…" badge on Payments. The Payments
    // tab passes false (default) so its grand total matches the ledger exactly.
    const FREE_CATEGORIES = new Set([
      'accommodation', 'hotel', 'stay', 'check-in', 'checkout', 'check-out',
      'flight', 'departure', 'arrival',
    ]);
    const seenActivityIds = new Set(
      result
        .filter(r => r.type === 'activity' && !r.groupKind)
        .map(r => r.id.replace(/_d\d+$/, ''))
    );
    const walkTransitByDay = new Map<number, { totalCents: number; subItems: PayableSubItem[] }>();

    if (estimateMissingCosts) {

    for (const day of days) {
      for (const a of day.activities) {
        if (!a?.id || seenActivityIds.has(a.id)) continue;
        const cat = (a.category || a.type || 'activity').toLowerCase();
        if (FREE_CATEGORIES.has(cat)) continue;

        // Free-public-venue heuristic: skip silently
        const looksFree = isLikelyFreePublicVenue({
          title: a.title || a.name,
          category: cat,
        });
        if (looksFree) continue;

        // Skip placeholder departure transfers (no mode chosen): never auto-price.
        if (isPlaceholderDepartureTransfer({
          title: a.title || a.name,
          category: cat,
          description: (a as any).description,
          bookingRequired: (a as any).bookingRequired,
          cost: a.cost,
        })) continue;

        // Skip unconfirmed intra-city taxi/rideshare legs: AI named them
        // "Taxi to X" but user never confirmed mode. Stays $0 until user picks.
        if (isUnconfirmedIntraCityTaxi({
          title: a.title || a.name,
          category: cat,
          bookingRequired: (a as any).bookingRequired,
          cost: a.cost,
        })) continue;

        const explicitRaw = typeof a.cost === 'number' ? a.cost
          : (a.cost && typeof a.cost === 'object' && typeof a.cost.amount === 'number') ? a.cost.amount
          : (typeof a.explicitCost === 'number' ? a.explicitCost : undefined);
        // Treat explicit 0 as "no cost recorded — please estimate". A value of
        // exactly $0 on a paid category (shopping/dining/activity) is almost
        // always a missing-data placeholder, not a confirmed free experience.
        const explicit = (typeof explicitRaw === 'number' && explicitRaw > 0) ? explicitRaw : undefined;

        const est = estimateCostSync({
          category: cat,
          title: a.title || a.name,
          city: destination,
          country: destinationCountry,
          travelers,
          budgetTier: (budgetTier as any) || 'moderate',
          priceLevel: a.priceLevel ?? a.price_level,
          explicitCost: explicit,
        });
        const cents = Math.round((est?.amount || 0) * 100);
        if (cents <= 0) continue;

        if (TRANSIT_CATEGORIES.has(cat)) {
          const bucket = walkTransitByDay.get(day.dayNumber) || { totalCents: 0, subItems: [] };
          bucket.subItems.push({
            id: a.id,
            name: a.title || a.name || 'Local transit',
            amountCents: cents,
          });
          bucket.totalCents += cents;
          walkTransitByDay.set(day.dayNumber, bucket);
          continue;
        }

        const compositeId = `${a.id}_d${day.dayNumber}`;
        const activityPayments = payments.filter(p => p.item_type === 'activity' && p.item_id === compositeId);
        const assignedIds = activityPayments
          .map(p => (p as any)?.assigned_member_id)
          .filter(Boolean) as string[];
        result.push({
          id: compositeId,
          type: 'activity',
          name: a.title || a.name || 'Activity',
          amountCents: cents,
          dayNumber: day.dayNumber,
          payment: activityPayments[0],
          allPayments: activityPayments,
          assignedMemberId: assignedIds[0],
          assignedMemberIds: [...new Set(assignedIds)],
        });
      }
    }
    } // end estimateMissingCosts

    // Merge walk-derived transit into existing per-day rows (or emit new ones)
    for (const [dayNumber, { totalCents, subItems }] of walkTransitByDay) {
      const groupId = `transit-d${dayNumber}`;
      const existing = result.find(r => r.id === groupId);
      if (existing) {
        existing.amountCents += totalCents;
        existing.subItems = [...(existing.subItems || []), ...subItems];
      } else {
        const groupPayments = payments.filter(p => p.item_type === 'activity' && p.item_id === groupId);
        const assignedIds = groupPayments.map(p => (p as any)?.assigned_member_id).filter(Boolean) as string[];
        result.push({
          id: groupId,
          type: 'activity',
          name: `Local transit — Day ${dayNumber}`,
          amountCents: totalCents,
          dayNumber,
          payment: groupPayments[0],
          allPayments: groupPayments,
          assignedMemberId: assignedIds[0],
          assignedMemberIds: [...new Set(assignedIds)],
          subItems,
          groupKind: 'transit',
        });
      }
    }

    // (manual activity expenses already added above; do not call addManualGroups('activity') a second time)

    // ─── Orphan payment recovery (live activities only) ───
    // Surface non-manual activity payments whose item_id is missing from the
    // current items list — but ONLY when the underlying activity still
    // exists in the itinerary. Payments for activities that have since been
    // removed are intentionally hidden from the live Activities list to
    // avoid duplicate-looking rows (e.g. the old paid "Lunch at L'Arpège"
    // appearing alongside the live lunch on Day 1). They remain in the
    // payments table and continue to count toward "Paid so far" via totals
    // computed by getTripPayments — they just don't render as a live row.
    const presentItemIds = new Set(result.map(r => r.id));
    const orphanGroups = new Map<string, TripPayment[]>();
    for (const p of payments) {
      if (p.item_type !== 'activity') continue;
      if (!p.item_id || isManualId(p.item_id)) continue;
      if (presentItemIds.has(p.item_id)) continue;
      // Strip optional composite suffix (_dN) to get the raw activity id.
      const rawActivityId = p.item_id.replace(/_d\d+$/, '');
      // Only recover if the activity still exists in the live itinerary.
      if (!activityNameById.has(rawActivityId)) continue;
      const group = orphanGroups.get(p.item_id) || [];
      group.push(p);
      orphanGroups.set(p.item_id, group);
    }
    orphanGroups.forEach((group, itemId) => {
      const primary = group[0];
      const assignedIds = group.map(pp => (pp as any)?.assigned_member_id).filter(Boolean) as string[];
      const dayMatch = itemId.match(/_d(\d+)$/);
      const dayNumber = dayMatch ? Number(dayMatch[1]) : undefined;
      result.push({
        id: itemId,
        type: 'activity',
        name: primary.item_name || 'Activity',
        amountCents: primary.amount_cents * (primary.quantity || 1),
        dayNumber,
        payment: primary,
        allPayments: group,
        assignedMemberId: assignedIds[0],
        assignedMemberIds: [...new Set(assignedIds)],
      });
    });

    // ─── Final dedupe: ensure manual hotel/flight overrides win over canonical rows ───
    const hasManualHotelItem = result.some(r => r.type === 'hotel' && isManualId(r.id));
    const hasManualFlightItem = result.some(r => r.type === 'flight' && isManualId(r.id));
    const deduped = result.filter(r => {
      // Suppress ANY non-manual hotel row when a manual hotel exists, regardless of id.
      if (r.type === 'hotel' && !isManualId(r.id) && hasManualHotelItem) return false;
      if (r.type === 'flight' && !isManualId(r.id) && hasManualFlightItem) return false;
      return true;
    });

    return deduped;
  }, [flightSelection, hotelSelection, days, payments, travelers, activityCosts, activityNameById, orphanRescueByDayCat, hasManualHotel, hasManualFlight, paymentsLoaded, budgetTier, destination, destinationCountry, estimateMissingCosts]);

  const totalCents = useMemo(() => items.reduce((sum, i) => sum + i.amountCents, 0), [items]);
  const essentialItems = useMemo(() => items.filter(i => i.type === 'flight' || i.type === 'hotel'), [items]);
  const activityItems = useMemo(() => items.filter(i => i.type === 'activity'), [items]);

  return { items, totalCents, essentialItems, activityItems };
}
