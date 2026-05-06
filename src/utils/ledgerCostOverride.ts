/**
 * Ledger override map — defense-in-depth so activity cards never display a
 * cost materially lower than what the activity_costs ledger says, when the
 * ledger value comes from a server-side floor (Michelin / ticketed / etc.).
 *
 * This is a process-global map keyed by `${tripId}:${activityId}`. It is
 * populated by useLedgerCostOverrideMap (mounted high in EditorialItinerary)
 * and read by getActivityCostInfo where prop-threading would otherwise be
 * invasive.
 */

import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LedgerOverride {
  perPersonUsd: number;
  source: string;
}

const PROTECTED_FLOOR_SOURCES = new Set([
  'michelin_floor',
  'ticketed_attraction_floor',
  'auto_corrected',
  'reference_fallback',
]);

const overrides = new Map<string, LedgerOverride>();

const key = (tripId: string, activityId: string) => `${tripId}:${activityId}`;

export function getLedgerOverride(tripId: string | undefined, activityId: string | undefined): LedgerOverride | undefined {
  if (!tripId || !activityId) return undefined;
  return overrides.get(key(tripId, activityId));
}

export function useLedgerCostOverrideMap(tripId: string | undefined): void {
  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from('activity_costs')
        .select('activity_id, cost_per_person_usd, source')
        .eq('trip_id', tripId);
      if (cancelled || error || !data) return;
      // Clear any stale entries for this trip first
      for (const k of Array.from(overrides.keys())) {
        if (k.startsWith(`${tripId}:`)) overrides.delete(k);
      }
      for (const row of data as any[]) {
        const src = String(row.source || '');
        if (!PROTECTED_FLOOR_SOURCES.has(src)) continue;
        const perPerson = Number(row.cost_per_person_usd) || 0;
        if (perPerson <= 0) continue;
        if (row.activity_id) {
          overrides.set(key(tripId, String(row.activity_id)), {
            perPersonUsd: perPerson,
            source: src,
          });
        }
      }
    };

    load();
    const handler = () => load();
    window.addEventListener('booking-changed', handler);
    return () => {
      cancelled = true;
      window.removeEventListener('booking-changed', handler);
    };
  }, [tripId]);
}
