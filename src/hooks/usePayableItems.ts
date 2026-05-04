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
  /** Kept in signature for back-compat; no longer used. */
  budgetTier?: string;
  destination?: string;
  destinationCountry?: string;
  activityCosts?: ActivityCostRow[] | null;
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
  activityCosts,
}: PayableItemsInput): PayableItemsResult {
  // Build a lookup: activity_id -> display name from JSON itinerary
  const activityNameById = useMemo(() => {
    const map = new Map<string, { name: string; dayNumber: number }>();
    days.forEach(day => {
      day.activities.forEach(a => {
        if (!a?.id) return;
        const name = a.title || a.name || 'Activity';
        map.set(a.id, { name, dayNumber: day.dayNumber });
      });
    });
    return map;
  }, [days]);

  const hasManualHotel = useMemo(
    () => payments.some(p => p.item_type === 'hotel' && typeof p.item_id === 'string' && p.item_id.startsWith('manual-')),
    [payments]
  );
  const hasManualFlight = useMemo(
    () => payments.some(p => p.item_type === 'flight' && typeof p.item_id === 'string' && p.item_id.startsWith('manual-')),
    [payments]
  );

  const items = useMemo(() => {
    const result: PayableItem[] = [];

    // ─── Flight from selection (UI source) ───
    // Skip canonical flight if user has a manual flight override (avoids double-count).
    const flightTotal = hasManualFlight ? 0 : (
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
    } else if (activityCosts?.length && !hasManualFlight) {
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
    if (!hasManualHotel && (hotelSelection?.totalPrice || hotelSelection?.pricePerNight)) {
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
    } else if (activityCosts?.length) {
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
        p.item_type === itemType && p.item_id.startsWith('manual-')
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
        const cat = (row.category || '').toLowerCase();
        const cents = rowTotalCents(row);
        if (cents <= 0) continue; // free venues: don't surface

        // Group transit rows
        if (TRANSIT_CATEGORIES.has(cat)) {
          const bucket = transitByDay.get(row.day_number) || { totalCents: 0, subItems: [] };
          const lookup = activityNameById.get(row.activity_id);
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

        // If we don't have a JSON name, fall back to a category-derived label.
        // This avoids leaking an opaque UUID into the UI.
        const fallbackLabel =
          cat === 'dining' ? 'Meal' :
          cat === 'activity' ? 'Activity' :
          cat.charAt(0).toUpperCase() + cat.slice(1);

        result.push({
          id: compositeId,
          type: 'activity',
          name: lookup?.name || fallbackLabel,
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

    return result;
    // travelers retained in deps for callers; not used directly because num_travelers is on the row
  }, [flightSelection, hotelSelection, days, payments, travelers, activityCosts, activityNameById]);

  const totalCents = useMemo(() => items.reduce((sum, i) => sum + i.amountCents, 0), [items]);
  const essentialItems = useMemo(() => items.filter(i => i.type === 'flight' || i.type === 'hotel'), [items]);
  const activityItems = useMemo(() => items.filter(i => i.type === 'activity'), [items]);

  return { items, totalCents, essentialItems, activityItems };
}
