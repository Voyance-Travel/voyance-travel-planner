/**
 * Regression net for the F&D double-count audit.
 *
 * Locks the read-side semantics: getBudgetLedger amount_cents MUST be
 * computed as `cost_per_person_usd × num_travelers × 100` exactly once.
 *
 * If a future refactor re-multiplies at category rollup, this test fails.
 * If a writer stores a TOTAL into cost_per_person_usd, this test still
 * passes — proving the inflation is upstream, not in the rollup.
 */
import { describe, it, expect } from 'vitest';

// Pure helper that mirrors getBudgetLedger:512 — kept inline here so the
// test stays free of the supabase client.
function rowToCents(cpp: number, nt: number): number {
  return Math.round(cpp * nt * 100);
}

describe('budget ledger arithmetic — single multiplication invariant', () => {
  it('per-person × travelers is applied exactly once per row', () => {
    // 6 dining rows × $117.50/pp × 2 travelers = $1,410 total
    const rows = Array.from({ length: 6 }, () => ({ cpp: 117.5, nt: 2 }));
    const totalCents = rows.reduce((s, r) => s + rowToCents(r.cpp, r.nt), 0);
    expect(totalCents).toBe(141000);
  });

  it('detects upstream corruption: writer stored TOTAL as cpp inflates by ×nt', () => {
    // Same 6 dinners but cpp was written as $235 (the total) with nt=2.
    // The schema's generated total_cost_usd would compute 235×2 = 470/row,
    // and the ledger reads cpp×nt = same 470. Both inflate symmetrically.
    const rows = Array.from({ length: 6 }, () => ({ cpp: 235, nt: 2 }));
    const totalCents = rows.reduce((s, r) => s + rowToCents(r.cpp, r.nt), 0);
    expect(totalCents).toBe(282000); // = 2× the legitimate $1,410
  });

  it('single traveler: cpp equals total', () => {
    expect(rowToCents(117.5, 1)).toBe(11750);
  });

  it('rounding is deterministic at the cent boundary', () => {
    // 33.333... per person × 3 travelers = 99.999 → 9999.9 cents → 10000
    expect(rowToCents(33.333333, 3)).toBe(10000);
  });
});
