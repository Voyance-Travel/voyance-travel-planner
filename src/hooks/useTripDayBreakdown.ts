/**
 * useTripDayBreakdown
 *
 * Per-day canonical aggregator. Reads from `activity_costs` AND routes the
 * rows through the SAME `resolveCanonicalCostRows` resolver that
 * `useTripFinancialSnapshot` uses. This guarantees that the per-day badges,
 * the day subtotal, and the trip header total are computed from an
 * identical set of resolved rows — including orphan rescue, $0 JSON
 * rescue, and the toggle filter.
 *
 * Without this parity, raw activity_costs rows whose `activity_id` no
 * longer exists in itinerary_data leak into the day subtotal but are
 * dropped from `useTripFinancialSnapshot.tripTotalCents`, producing the
 * persistent "Reconciling…" badge and the load-time "−$X just now" indicator
 * (Bali / Barcelona / Monaco pattern).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { resolveCanonicalCostRows, type CanonicalLiveActivity } from '@/services/canonicalCostRows';
import { TRIP_PERSISTED_EVENT } from '@/lib/itinerary/resyncItineraryFromDb';

export interface DayBreakdownRow {
  id: string;
  activityId: string | null;
  dayNumber: number;
  category: string | null;
  costPerPersonUsd: number;
  numTravelers: number;
  totalUsdCents: number;
  notes: string | null;
  source: string | null;
  isPaid: boolean;
}

export interface DayBreakdown {
  totalCents: number;
  visibleCents: number;
  otherCents: number;
  rows: DayBreakdownRow[];
  otherRows: DayBreakdownRow[];
}

export interface TripDayBreakdown {
  byDay: Record<number, DayBreakdown>;
  loading: boolean;
  refetch: () => void;
}

export function useTripDayBreakdown(
  tripId: string,
  visibleActivityIds: Set<string> | string[] = new Set(),
): TripDayBreakdown {
  const [resolvedRows, setResolvedRows] = useState<DayBreakdownRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Stabilize the set across renders.
  const visibleSet = useMemo(() => {
    if (visibleActivityIds instanceof Set) return visibleActivityIds;
    return new Set(visibleActivityIds);
  }, [Array.isArray(visibleActivityIds)
    ? visibleActivityIds.join('|')
    : Array.from(visibleActivityIds).join('|')]);

  const fetchData = useCallback(async () => {
    if (!tripId) {
      setLoading(false);
      return;
    }

    const [tripRes, costsRes, paymentsRes] = await Promise.all([
      supabase
        .from('trips')
        .select('budget_include_hotel, budget_include_flight, itinerary_data, travelers')
        .eq('id', tripId)
        .single(),
      supabase
        .from('activity_costs')
        .select('id, activity_id, day_number, category, cost_per_person_usd, num_travelers, notes, source, is_paid, paid_amount_usd')
        .eq('trip_id', tripId),
      supabase
        .from('trip_payments')
        .select('item_type, item_id, amount_cents, quantity, status')
        .eq('trip_id', tripId)
        .is('archived_at', null),
    ]);

    const includeHotel = tripRes.data?.budget_include_hotel ?? true;
    const includeFlight = tripRes.data?.budget_include_flight ?? false;
    const tripTravelers = Number((tripRes.data as any)?.travelers) || 1;

    // Build live-activity index from itinerary_data.days, identical to the
    // snapshot's projection so the resolver produces the same outcome.
    const liveActivities: CanonicalLiveActivity[] = [];
    const days = ((tripRes.data as any)?.itinerary_data?.days) || [];
    for (const day of days) {
      const dayNum = Number(day?.dayNumber) || 0;
      for (const a of (day?.activities || [])) {
        if (!a?.id) continue;
        const explicit = typeof a.cost === 'number' ? a.cost
          : (a.cost && typeof a.cost === 'object' && typeof a.cost.amount === 'number') ? a.cost.amount
          : (typeof a.explicitCost === 'number' ? a.explicitCost : 0);
        liveActivities.push({
          id: String(a.id),
          dayNumber: dayNum,
          name: String(a.title || a.name || ''),
          category: String(a.category || a.type || '').toLowerCase(),
          jsonCost: Number(explicit) || 0,
        });
      }
    }

    const canonical = resolveCanonicalCostRows({
      costs: (costsRes.data || []) as any,
      liveActivities,
      includeHotel,
      includeFlight,
      manualPayments: (paymentsRes.data || []) as any,
      travelers: tripTravelers,
    });

    // Index source rows by id to recover notes / paid mirror metadata.
    const sourceById = new Map<string, any>();
    for (const r of (costsRes.data || []) as any[]) {
      if (r?.id) sourceById.set(String(r.id), r);
    }

    const mapped: DayBreakdownRow[] = canonical.rows.map((r) => {
      const src = sourceById.get(r.rowKey);
      return {
        id: r.rowKey,
        activityId: r.effectiveActivityId,
        dayNumber: r.dayNumber,
        category: r.category || null,
        costPerPersonUsd: r.numTravelers > 0 ? (r.cents / 100) / r.numTravelers : (r.cents / 100),
        numTravelers: r.numTravelers,
        totalUsdCents: r.cents,
        notes: src?.notes || null,
        source: r.source,
        isPaid: r.isPaid,
      };
    });

    setResolvedRows(mapped);
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Stay in sync with snapshot — same event channels.
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener('booking-changed', handler);
    window.addEventListener(TRIP_PERSISTED_EVENT, handler);
    return () => {
      window.removeEventListener('booking-changed', handler);
      window.removeEventListener(TRIP_PERSISTED_EVENT, handler);
    };
  }, [fetchData]);

  const byDay = useMemo<Record<number, DayBreakdown>>(() => {
    const acc: Record<number, DayBreakdown> = {};
    for (const row of resolvedRows) {
      const day = row.dayNumber ?? 0;
      if (!acc[day]) acc[day] = { totalCents: 0, visibleCents: 0, otherCents: 0, rows: [], otherRows: [] };
      const bucket = acc[day];
      bucket.totalCents += row.totalUsdCents;
      bucket.rows.push(row);
      const isVisible = !!row.activityId && visibleSet.has(row.activityId);
      if (isVisible) {
        bucket.visibleCents += row.totalUsdCents;
      } else {
        bucket.otherCents += row.totalUsdCents;
        bucket.otherRows.push(row);
      }
    }
    return acc;
  }, [resolvedRows, visibleSet]);

  return useMemo(() => ({
    byDay,
    loading,
    refetch: fetchData,
  }), [byDay, loading, fetchData]);
}
