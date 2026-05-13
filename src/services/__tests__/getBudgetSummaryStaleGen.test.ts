/**
 * Stale-generation gate for `getBudgetSummary.isGenerating`.
 *
 * Trips whose chain orchestrator crashed before stamping
 * `metadata.itinerary_frozen_at` would otherwise leave the Budget tab
 * "Calculating…" pill spinning forever. After 10 minutes of no
 * `trips.updated_at` movement we treat the trip as stalled.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const trip = {
  itinerary_status: 'ready' as string,
  metadata: null as any,
  updated_at: new Date().toISOString(),
  // Settings live on the trips row too — getTripBudgetSettings selects them.
  budget_total_cents: 100_000,
  budget_currency: 'USD',
  budget_input_mode: 'total',
  budget_include_hotel: true,
  budget_include_flight: true,
  budget_warnings_enabled: true,
  budget_warning_threshold: 'yellow',
  budget_allocations: null,
  travelers: 2,
  coach_protected_categories: null,
};

vi.mock('@/integrations/supabase/client', () => {
  const makeChain = (table: string): any => {
    const settle = async () => {
      if (table === 'trips') return { data: trip, error: null };
      if (table === 'trip_budget_settings') return { data: settings, error: null };
      return { data: [], error: null };
    };
    const chain: any = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.order = () => chain;
    chain.in = () => chain;
    chain.gte = () => chain;
    chain.lte = () => chain;
    chain.maybeSingle = settle;
    chain.single = settle;
    chain.then = (resolve: any, reject: any) => settle().then(resolve, reject);
    return chain;
  };
  return { supabase: { from: (table: string) => makeChain(table) } };
});

import { getBudgetSummary } from '../tripBudgetService';

beforeEach(() => {
  trip.itinerary_status = 'generating';
  trip.metadata = null;
  trip.updated_at = new Date().toISOString();
});

describe('getBudgetSummary stale-generation gate', () => {
  it('isGenerating=true when status=generating, no frozen stamp, updated_at recent', async () => {
    trip.updated_at = new Date(Date.now() - 30_000).toISOString();
    const summary = await getBudgetSummary('trip-1', 5);
    expect(summary?.isGenerating).toBe(true);
  });

  it('isGenerating=false when status=generating, no frozen stamp, updated_at > 10 min ago (stale)', async () => {
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
    trip.metadata = { itinerary_frozen_at: new Date().toISOString() };
    const summary = await getBudgetSummary('trip-3', 5);
    expect(summary?.isGenerating).toBe(false);
  });

  it('isGenerating=false when status=ready', async () => {
    trip.itinerary_status = 'ready';
    const summary = await getBudgetSummary('trip-4', 5);
    expect(summary?.isGenerating).toBe(false);
  });
});
