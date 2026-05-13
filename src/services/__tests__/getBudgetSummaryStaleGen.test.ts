/**
 * Stale-generation gate for `getBudgetSummary.isGenerating`.
 *
 * The Budget tab "Calculating…" pill is driven by this flag. It must clear
 * promptly so users see their real numbers — not a permanent spinner — when:
 *   - the trip is genuinely ready / frozen,
 *   - generation crashed mid-run (stale heartbeat),
 *   - or generation finished but never stamped frozen_at,
 *   - or the ledger already has meaningful rows and no recent heartbeat.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const trip = {
  itinerary_status: 'ready' as string,
  metadata: null as any,
  updated_at: new Date().toISOString(),
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

// Mutable fake ledger row count returned by getBudgetLedger.
let ledgerRowCount = 0;

vi.mock('@/integrations/supabase/client', () => {
  const makeChain = (table: string): any => {
    const settle = async () => {
      if (table === 'trips') return { data: trip, error: null };
      if (table === 'activity_costs') {
        const rows = Array.from({ length: ledgerRowCount }, (_, i) => ({
          id: `r${i}`,
          trip_id: 't',
          category: 'food',
          cost_per_person_usd: 20,
          num_travelers: 1,
          total_cost_usd: 20,
          day_number: 1,
          activity_id: null,
          source: null,
          notes: null,
          is_paid: false,
          paid_amount_usd: null,
          confidence: 'medium',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
        return { data: rows, error: null };
      }
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
  ledgerRowCount = 0;
});

describe('getBudgetSummary stale-generation gate', () => {
  it('isGenerating=true when status=generating with a fresh heartbeat', async () => {
    trip.metadata = { generation_heartbeat: new Date().toISOString() };
    const summary = await getBudgetSummary('trip-1', 5);
    expect(summary?.isGenerating).toBe(true);
  });

  it('isGenerating=false when heartbeat is older than 3 minutes (stalled chain)', async () => {
    trip.metadata = {
      generation_heartbeat: new Date(Date.now() - 4 * 60_000).toISOString(),
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const summary = await getBudgetSummary('trip-2', 5);
    expect(summary?.isGenerating).toBe(false);
    warn.mockRestore();
  });

  it('isGenerating=false when generation_completed_at is set even without frozen_at', async () => {
    trip.metadata = {
      generation_heartbeat: new Date().toISOString(),
      generation_completed_at: new Date().toISOString(),
    };
    const summary = await getBudgetSummary('trip-3', 5);
    expect(summary?.isGenerating).toBe(false);
  });

  it('isGenerating=false when ledger has meaningful rows and no recent heartbeat', async () => {
    ledgerRowCount = 5;
    trip.metadata = {
      generation_heartbeat: new Date(Date.now() - 5 * 60_000).toISOString(),
    };
    const summary = await getBudgetSummary('trip-4', 5);
    expect(summary?.isGenerating).toBe(false);
  });

  it('isGenerating=false (legacy) when no heartbeat ever and updated_at > 10 min', async () => {
    trip.updated_at = new Date(Date.now() - 11 * 60_000).toISOString();
    trip.metadata = {};
    const summary = await getBudgetSummary('trip-5', 5);
    expect(summary?.isGenerating).toBe(false);
  });

  it('isGenerating=false when status=generating + frozen_at set', async () => {
    trip.metadata = { itinerary_frozen_at: new Date().toISOString() };
    const summary = await getBudgetSummary('trip-6', 5);
    expect(summary?.isGenerating).toBe(false);
  });

  it('isGenerating=false when status=ready', async () => {
    trip.itinerary_status = 'ready';
    const summary = await getBudgetSummary('trip-7', 5);
    expect(summary?.isGenerating).toBe(false);
  });

  it('isGenerating=false when status=partial (terminal)', async () => {
    trip.itinerary_status = 'partial';
    const summary = await getBudgetSummary('trip-8', 5);
    expect(summary?.isGenerating).toBe(false);
  });
});
