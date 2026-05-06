/**
 * Regression tests for the hotel manual-override guard inside
 * `syncHotelToLedger`. The guard is what prevents the historical
 * "Hotel Accommodation $2,850" auto-row from appearing on top of a
 * user-entered "Four Seasons $2,400" manual hotel payment.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── In-memory state we drive the mocked supabase client with ──
const state = {
  manualHotelRows: [] as Array<{ id: string }>,
  existingActivityCostRow: null as null | { id: string },
  inserts: [] as any[],
  updates: [] as Array<{ patch: any; id: string }>,
  deletes: [] as Array<{ table: string; filters: Record<string, any> }>,
};

function chainFor(table: string) {
  // Generic builder: every filter method returns the same chain.
  // Terminal methods consult `state` based on what was queried.
  const filters: Record<string, any> = {};
  const op: { kind: 'select' | 'delete' | 'insert' | 'update' | null; values?: any; updateId?: string } = { kind: null };

  const chain: any = {
    select: (..._args: any[]) => { op.kind = 'select'; return chain; },
    insert: (values: any) => {
      op.kind = 'insert';
      state.inserts.push({ table, values });
      return Promise.resolve({ error: null });
    },
    update: (values: any) => {
      op.kind = 'update';
      op.values = values;
      return chain;
    },
    delete: () => { op.kind = 'delete'; return chain; },
    eq: (col: string, val: any) => {
      filters[col] = val;
      if (op.kind === 'update') {
        if (col === 'id') {
          state.updates.push({ patch: op.values, id: val });
          return Promise.resolve({ error: null });
        }
      }
      return chain;
    },
    like: (col: string, val: any) => { filters[col] = val; return chain; },
    ilike: (col: string, val: any) => { filters[col] = val; return chain; },
    limit: (_n: number) => {
      // Terminal for the manual-hotel probe
      if (table === 'trip_payments') {
        return Promise.resolve({ data: state.manualHotelRows, error: null });
      }
      return Promise.resolve({ data: [], error: null });
    },
    maybeSingle: () => {
      if (table === 'activity_costs') {
        return Promise.resolve({ data: state.existingActivityCostRow, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    single: () => Promise.resolve({ data: null, error: null }),
    then: undefined as any,
  };

  // Make delete chains awaitable: after all .eq calls the caller awaits the chain.
  // We attach `.then` lazily so awaiting the chain resolves with success.
  Object.defineProperty(chain, 'then', {
    get() {
      if (op.kind === 'delete') {
        state.deletes.push({ table, filters: { ...filters } });
        const p = Promise.resolve({ error: null });
        return p.then.bind(p);
      }
      return undefined;
    },
  });

  return chain;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => chainFor(table)),
  },
}));

// Import after mock so the module under test picks up the mock.
import { syncHotelToLedger } from '@/services/budgetLedgerSync';

beforeEach(() => {
  state.manualHotelRows = [];
  state.existingActivityCostRow = null;
  state.inserts = [];
  state.updates = [];
  state.deletes = [];
});

describe('syncHotelToLedger — manual override guard', () => {
  it('does NOT upsert a canonical hotel row when a manual hotel payment exists', async () => {
    state.manualHotelRows = [{ id: 'pay-1' }];

    await syncHotelToLedger('trip-abc', {
      name: 'Four Seasons George V',
      totalPrice: 2850, // Would have been the phantom auto-bill
    } as any);

    expect(state.inserts).toHaveLength(0);
    expect(state.updates).toHaveLength(0);
    // Should remove any existing canonical hotel row instead.
    expect(state.deletes.some(d => d.table === 'activity_costs')).toBe(true);
  });

  it('writes the canonical row when no manual override and totalPrice is provided', async () => {
    state.manualHotelRows = [];

    await syncHotelToLedger('trip-abc', {
      name: 'Four Seasons George V',
      totalPrice: 2400,
    } as any);

    expect(state.inserts).toHaveLength(1);
    expect(state.inserts[0].values).toMatchObject({
      trip_id: 'trip-abc',
      category: 'hotel',
      day_number: 0,
      cost_per_person_usd: 2400,
    });
  });

  it('falls back to pricePerNight × nights when only checkIn/checkOut provided', async () => {
    state.manualHotelRows = [];

    await syncHotelToLedger('trip-abc', {
      name: 'Four Seasons George V',
      pricePerNight: 600,
      checkInDate: '2026-05-10',
      checkOutDate: '2026-05-14',
    } as any);

    expect(state.inserts).toHaveLength(1);
    expect(state.inserts[0].values.cost_per_person_usd).toBe(2400);
  });

  it('removes the canonical row instead of estimating when no price exists', async () => {
    state.manualHotelRows = [];

    await syncHotelToLedger('trip-abc', {
      name: 'Four Seasons George V',
      // no price information at all
    } as any);

    expect(state.inserts).toHaveLength(0);
    expect(state.deletes.some(d => d.table === 'activity_costs')).toBe(true);
  });

  it('removes the canonical row when hotel selection is null', async () => {
    await syncHotelToLedger('trip-abc', null);
    expect(state.inserts).toHaveLength(0);
    expect(state.deletes.some(d => d.table === 'activity_costs')).toBe(true);
  });
});
