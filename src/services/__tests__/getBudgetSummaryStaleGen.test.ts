/**
 * Stale-generation gate for `getBudgetSummary.isGenerating`.
 *
 * Trips whose chain orchestrator crashed before stamping
 * `metadata.itinerary_frozen_at` would otherwise leave the Budget tab
 * "Calculating…" pill spinning forever. After 10 minutes of no
 * `trips.updated_at` movement we treat the trip as stalled.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory fixture state driven per-test
const trip = {
  itinerary_status: 'ready' as string,
  metadata: null as any,
  updated_at: new Date().toISOString(),
};
const settings = {
  budget_total_cents: 100_000,
  budget_currency: 'USD',
  travelers: 2,
  budget_include_hotel: true,
  budget_include_flight: true,
};

vi.mock('@/integrations/supabase/client', () => {
  const builder = (table: string) => {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => {
        if (table === 'trips') return { data: trip, error: null };
        if (table === 'trip_budget_settings') return { data: settings, error: null };
        return { data: null, error: null };
      },
      order: () => chain,
      then: undefined,
    };
    // For activity_costs etc., make it resolve to empty arrays.
    chain.select = () => ({
      ...chain,
      eq: () => ({
        ...chain,
        eq: () => Promise.resolve({ data: [], error: null }),
        order: () => Promise.resolve({ data: [], error: null }),
        maybeSingle: chain.maybeSingle,
      }),
      maybeSingle: chain.maybeSingle,
    });
    return chain;
  };
  return { supabase: { from: builder } };
});

// Settings loader uses its own helper; stub it to bypass.
vi.mock('@/services/tripBudgetService', async (orig) => {
  const mod: any = await orig();
  return mod;
});

import { getBudgetSummary } from '../tripBudgetService';

beforeEach(() => {
  trip.itinerary_status = 'generating';
  trip.metadata = null;
  trip.updated_at = new Date().toISOString();
});

describe('getBudgetSummary stale-generation gate', () => {
  it('isGenerating=true when status=generating, no frozen stamp, updated_at recent', async () => {
    trip.itinerary_status = 'generating';
    trip.metadata = null;
    trip.updated_at = new Date(Date.now() - 30_000).toISOString(); // 30s ago
    const summary = await getBudgetSummary('trip-1', 5);
    expect(summary?.isGenerating).toBe(true);
  });

  it('isGenerating=false when status=generating, no frozen stamp, updated_at > 10 min ago (stale)', async () => {
    trip.itinerary_status = 'generating';
    trip.metadata = null;
    trip.updated_at = new Date(Date.now() - 11 * 60_000).toISOString();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const summary = await getBudgetSummary('trip-2', 5);
    expect(summary?.isGenerating).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('[getBudgetSummary] stale generation detected'),
    );
    warn.mockRestore();
  });

  it('isGenerating=false when status=generating + frozen_at set', async () => {
    trip.itinerary_status = 'generating';
    trip.metadata = { itinerary_frozen_at: new Date().toISOString() };
    trip.updated_at = new Date().toISOString();
    const summary = await getBudgetSummary('trip-3', 5);
    expect(summary?.isGenerating).toBe(false);
  });

  it('isGenerating=false when status=ready', async () => {
    trip.itinerary_status = 'ready';
    trip.metadata = null;
    trip.updated_at = new Date().toISOString();
    const summary = await getBudgetSummary('trip-4', 5);
    expect(summary?.isGenerating).toBe(false);
  });
});
