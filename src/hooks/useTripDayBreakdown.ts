/**
 * useTripDayBreakdown
 *
 * Per-day canonical aggregator. Reads from `activity_costs` using the SAME
 * inclusion rule as `useTripFinancialSnapshot`, so the per-day badges and
 * the trip header total can never disagree.
 *
 * Returns, for each day_number present in the table:
 *   - totalCents:    sum of all included rows for the day (group-cost USD cents)
 *   - visibleCents:  subset of totalCents whose activity_id matches the rendered
 *                    list passed in via `visibleActivityIds`
 *   - otherCents:    totalCents − visibleCents (transit micro-legs, fees,
 *                    logistics rows that aren't rendered as activity cards)
 *   - rows:          raw rows for the "Other / fees" expansion
 *
 * Designed to share fetches with the snapshot — both subscribe to the same
 * `booking-changed` event and refetch in lockstep.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { shouldCountRow } from '@/services/tripBudgetService';

export interface DayBreakdownRow {
  id: string;
  activityId: string | null;
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
  const [rows, setRows] = useState<DayBreakdownRow[]>([]);
  const [includeHotel, setIncludeHotel] = useState(true);
  const [includeFlight, setIncludeFlight] = useState(false);
  const [loading, setLoading] = useState(true);

  // Stabilize the set across renders. Callers may pass a fresh array each
  // render — that should not refetch, only re-derive the visible/other split.
  const visibleSet = useMemo(() => {
    if (visibleActivityIds instanceof Set) return visibleActivityIds;
    return new Set(visibleActivityIds);
  }, [Array.isArray(visibleActivityIds)
    ? visibleActivityIds.join('|')
    : Array.from(visibleActivityIds).join('|')]);

  const fetchData = useCallback(async () => {
    if (!tripId) return;

    const [tripRes, costsRes] = await Promise.all([
      supabase
        .from('trips')
        .select('budget_include_hotel, budget_include_flight')
        .eq('id', tripId)
        .single(),
      supabase
        .from('activity_costs')
        .select('id, activity_id, day_number, category, cost_per_person_usd, num_travelers, notes, source, is_paid')
        .eq('trip_id', tripId),
    ]);

    setIncludeHotel(tripRes.data?.budget_include_hotel ?? true);
    setIncludeFlight(tripRes.data?.budget_include_flight ?? false);

    const mapped: DayBreakdownRow[] = (costsRes.data || []).map((r: any) => {
      const perPerson = Number(r.cost_per_person_usd) || 0;
      const trav = Number(r.num_travelers) || 1;
      return {
        id: r.id,
        activityId: r.activity_id || null,
        category: r.category || null,
        costPerPersonUsd: perPerson,
        numTravelers: trav,
        totalUsdCents: Math.round(perPerson * trav * 100),
        notes: r.notes || null,
        source: r.source || null,
        isPaid: r.is_paid === true,
        // day_number stays accessible via the row index below
        // we attach it dynamically since it's not in the typed shape
        ...(r.day_number != null ? { dayNumber: r.day_number } : {}),
      } as DayBreakdownRow & { dayNumber?: number };
    });

    setRows(mapped);
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Stay in sync with snapshot — same event channel.
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener('booking-changed', handler);
    return () => window.removeEventListener('booking-changed', handler);
  }, [fetchData]);

  const byDay = useMemo<Record<number, DayBreakdown>>(() => {
    const acc: Record<number, DayBreakdown> = {};
    for (const row of rows as Array<DayBreakdownRow & { dayNumber?: number }>) {
      if (!shouldCountRow({ category: row.category }, includeHotel, includeFlight)) continue;
      const day = (row as any).dayNumber ?? 0;
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
  }, [rows, includeHotel, includeFlight, visibleSet]);

  return useMemo(() => ({
    byDay,
    loading,
    refetch: fetchData,
  }), [byDay, loading, fetchData]);
}
