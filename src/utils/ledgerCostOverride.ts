/**
 * Ledger override map — defense-in-depth so activity cards never display a
 * cost materially lower than what the activity_costs ledger says, when the
 * ledger value comes from a server-side floor (Michelin / ticketed / etc.).
 *
 * Keyed by activity_id (uuids are globally unique). Populated by
 * useLedgerCostOverrideMap (mounted in EditorialItinerary) and consulted by
 * getActivityCostInfo so prop-threading the ledger map down the render tree
 * isn't required.
 */

import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LedgerOverride {
  perPersonUsd: number;
  source: string;
  tripId: string;
}

const PROTECTED_FLOOR_SOURCES = new Set([
  'michelin_floor',
  'ticketed_attraction_floor',
  'auto_corrected',
  'reference_fallback',
]);

const overrides = new Map<string, LedgerOverride>();
const warnedFor = new Set<string>();

export function getLedgerOverride(activityId: string | undefined): LedgerOverride | undefined {
  if (!activityId) return undefined;
  return overrides.get(String(activityId));
}

export function warnOnceLedgerOverride(activityId: string, ctx: { jsonbAmount: number; ledgerAmount: number; source: string; title?: string }) {
  if (warnedFor.has(activityId)) return;
  warnedFor.add(activityId);
  console.warn(
    `[LedgerOverride] Activity "${ctx.title || activityId}" JSONB cost $${ctx.jsonbAmount} ` +
    `is materially below ledger floor $${ctx.ledgerAmount} (${ctx.source}). ` +
    `Card will display ledger value to match Budget/Payments.`
  );
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
      // Clear stale entries for this trip first
      for (const [k, v] of Array.from(overrides.entries())) {
        if (v.tripId === tripId) overrides.delete(k);
      }
      for (const row of data as any[]) {
        const src = String(row.source || '');
        if (!PROTECTED_FLOOR_SOURCES.has(src)) continue;
        const perPerson = Number(row.cost_per_person_usd) || 0;
        if (perPerson <= 0 || !row.activity_id) continue;
        overrides.set(String(row.activity_id), {
          perPersonUsd: perPerson,
          source: src,
          tripId,
        });
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
