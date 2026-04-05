/**
 * usePayableItems — Shared hook for computing payable items from itinerary data.
 * 
 * Single source of truth for trip cost totals used by both BudgetTab and PaymentsTab.
 * Replaces the divergent calculation paths that caused budget mismatches.
 */

import { useMemo } from 'react';
import { estimateCostSync, isLikelyFreePublicVenue } from '@/lib/cost-estimation';
import type { TripPayment } from '@/services/tripPaymentsAPI';

export interface PayableItem {
  id: string;
  type: 'flight' | 'hotel' | 'activity';
  name: string;
  amountCents: number;
  dayNumber?: number;
  payment?: TripPayment;
  allPayments: TripPayment[];
  assignedMemberId?: string;
  assignedMemberIds: string[];
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
      cost?: { amount?: number; currency?: string } | number | null;
      estimatedCost?: { amount?: number } | null;
      timeBlockType?: string;
      priceLevel?: number;
      price_level?: number;
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
}

const NON_PAYABLE_KEYWORDS = [
  'free time', 'downtime', 'leisure time', 'at leisure', 'rest', 'sleep',
  'check-in', 'check-out', 'checkin', 'checkout', 'check in', 'check out',
  'arrival at', 'departure from', 'packing',
  'walk to', 'walk through', 'stroll', 'walking', 'evening walk', 'neighborhood walk',
];
const NON_PAYABLE_CATEGORIES = ['downtime', 'free_time', 'walk', 'walking', 'stroll'];

const NEVER_FREE_CATEGORIES = [
  'dining', 'restaurant', 'breakfast', 'brunch', 'lunch', 'dinner', 'cafe', 'coffee',
  'cruise', 'boat', 'tour', 'activity', 'experience', 'spa', 'massage', 'show',
  'performance', 'concert', 'theater', 'theatre', 'nightlife', 'bar', 'club',
  'transfer', 'transport', 'transportation', 'airport', 'taxi', 'uber', 'rideshare'
];
const NEVER_FREE_KEYWORDS = [
  'breakfast', 'brunch', 'lunch', 'dinner', 'cruise', 'tour',
  'restaurant', 'café', 'cafe', 'transfer', 'airport', 'taxi',
  'uber', 'private car', 'shuttle', 'train to', 'bus to'
];

export interface PayableItemsResult {
  items: PayableItem[];
  totalCents: number;
  essentialItems: PayableItem[];
  activityItems: PayableItem[];
}

export function usePayableItems({
  days,
  flightSelection,
  hotelSelection,
  travelers,
  payments,
  budgetTier = 'moderate',
  destination,
  destinationCountry,
  activityCosts,
}: PayableItemsInput): PayableItemsResult {
  const items = useMemo(() => {
    const result: PayableItem[] = [];

    // Flight from selection — compute total from legs, outbound/return, or totalPrice
    const flightTotal = flightSelection?.totalPrice
      || (flightSelection?.legs?.reduce((s, l) => s + (l?.price || 0), 0) || 0)
      || ((flightSelection?.outbound?.price || 0) + (flightSelection?.return?.price || 0));

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
    } else if (activityCosts?.length) {
      // DB fallback: check activity_costs for a flight category row
      const flightRow = activityCosts.find(r => (r.category || '').toLowerCase() === 'flight' && r.day_number === 0);
      if (flightRow && flightRow.cost_per_person_usd > 0) {
        const flightId = 'flight-selection';
        const flightPayments = payments.filter(p => p.item_type === 'flight' && p.item_id === flightId);
        const assignedIds = flightPayments
          .map(p => (p as any)?.assigned_member_id)
          .filter(Boolean) as string[];
        const totalFlightCents = Math.round(flightRow.cost_per_person_usd * (flightRow.num_travelers || 1) * 100);
        result.push({
          id: flightId,
          type: 'flight',
          name: 'Round-trip Flight',
          amountCents: totalFlightCents,
          payment: flightPayments[0],
          allPayments: flightPayments,
          assignedMemberId: assignedIds[0],
          assignedMemberIds: [...new Set(assignedIds)],
        });
      }
    }

    // Hotel from selection
    if (hotelSelection?.totalPrice || hotelSelection?.pricePerNight) {
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
    }

    // Manual entries from payments (flights, hotels, activities)
    const addManualGroups = (itemType: 'flight' | 'hotel' | 'activity') => {
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

    // Activities from itinerary
    days.forEach(day => {
      day.activities.forEach(activity => {
        let cost = (typeof activity.cost === 'number' ? activity.cost : (activity.cost as any)?.amount) || (activity.estimatedCost as any)?.amount || 0;

        const titleLower = (activity.title || '').toLowerCase();
        const catLower = (activity.type || activity.category || '').toLowerCase();

        const isNonPayable = NON_PAYABLE_KEYWORDS.some(kw => titleLower.includes(kw)) ||
          NON_PAYABLE_CATEGORIES.includes(catLower) ||
          activity.timeBlockType === 'downtime';
        if (isNonPayable) return;

        if (cost <= 0) {
          // Check if this is a free public venue BEFORE applying never-free estimation
          const isFreeVenue = isLikelyFreePublicVenue({
            title: activity.title || activity.name,
            category: activity.category || activity.type,
            type: activity.type,
          });
          if (isFreeVenue) return; // Skip — free public venues are not payable

          const shouldNeverBeFree = NEVER_FREE_CATEGORIES.some(nfc => catLower.includes(nfc)) ||
            NEVER_FREE_KEYWORDS.some(kw => titleLower.includes(kw));

          if (shouldNeverBeFree) {
            const priceLevel = (activity as any).priceLevel || (activity as any).price_level;
            const estimated = estimateCostSync({
              category: catLower,
              title: activity.title || '',
              city: destination,
              country: destinationCountry,
              travelers,
              budgetTier: budgetTier as 'budget' | 'moderate' | 'luxury',
              priceLevel: priceLevel ? Number(priceLevel) : undefined,
            });
            cost = estimated.amount;
          }
        }

        if (cost > 0) {
          const compositeId = `${activity.id}_d${day.dayNumber}`;
          const activityPayments = payments.filter(p => p.item_type === 'activity' && p.item_id === compositeId);
          const assignedIds = activityPayments
            .map(p => (p as any)?.assigned_member_id)
            .filter(Boolean) as string[];
          result.push({
            id: compositeId,
            type: 'activity',
            name: activity.title || activity.name || (activity as any).venue || 'Activity',
            amountCents: Math.round(cost * travelers * 100),
            dayNumber: day.dayNumber,
            payment: activityPayments[0],
            allPayments: activityPayments,
            assignedMemberId: assignedIds[0],
            assignedMemberIds: [...new Set(assignedIds)],
          });
        }
      });
    });

    // Manual activities
    addManualGroups('activity');

    // ─── Reconcile with activity_costs DB rows ───
    // Surface categories (dining, transit, etc.) that exist in DB but not in JSON-parsed items
    if (activityCosts?.length) {
      const CATEGORY_LABELS: Record<string, string> = {
        dining: 'Food & Dining',
        food: 'Food & Dining',
        restaurant: 'Food & Dining',
        breakfast: 'Food & Dining',
        lunch: 'Food & Dining',
        dinner: 'Food & Dining',
        cafe: 'Food & Dining',
        transit: 'Local Transit',
        transport: 'Local Transit',
        transportation: 'Local Transit',
        transfer: 'Local Transit',
      };

      // Collect IDs already represented in result
      const coveredActivityIds = new Set(result.map(i => i.id));

      // Group DB costs by display label, skipping logistics (day_number=0) and already-covered items
      const labelTotals = new Map<string, number>();
      for (const row of activityCosts) {
        if (row.day_number === 0) continue; // hotel/flight handled above
        const cat = (row.category || '').toLowerCase();
        const label = CATEGORY_LABELS[cat];
        if (!label) continue; // only add summary items for known gap categories

        // Check if this specific activity_cost row's activity is already in the result
        const compositePatterns = result.some(
          r => r.id.startsWith(row.activity_id) || r.id === row.activity_id
        );
        if (compositePatterns) continue;

        const totalCentsRow = Math.round((row.cost_per_person_usd || 0) * (row.num_travelers || 1) * 100);
        labelTotals.set(label, (labelTotals.get(label) || 0) + totalCentsRow);
      }

      for (const [label, cents] of labelTotals) {
        if (cents <= 0) continue;
        const summaryId = `cat-${label.toLowerCase().replace(/[^a-z]/g, '-')}`;
        if (coveredActivityIds.has(summaryId)) continue;

        const catPayments = payments.filter(p => p.item_id === summaryId);
        const assignedIds = catPayments.map(p => (p as any)?.assigned_member_id).filter(Boolean) as string[];
        result.push({
          id: summaryId,
          type: 'activity',
          name: label,
          amountCents: cents,
          payment: catPayments[0],
          allPayments: catPayments,
          assignedMemberId: assignedIds[0],
          assignedMemberIds: [...new Set(assignedIds)],
        });
      }
    }

    return result;
  }, [flightSelection, hotelSelection, days, payments, travelers, budgetTier, destination, destinationCountry, activityCosts]);

  const totalCents = useMemo(() => items.reduce((sum, i) => sum + i.amountCents, 0), [items]);
  const essentialItems = useMemo(() => items.filter(i => i.type === 'flight' || i.type === 'hotel'), [items]);
  const activityItems = useMemo(() => items.filter(i => i.type === 'activity'), [items]);

  return { items, totalCents, essentialItems, activityItems };
}
