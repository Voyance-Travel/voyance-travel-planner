import { describe, it, expect, vi } from 'vitest';
import { applyRaiseBudget } from '../raiseBudgetApply';

function makeDeps(overrides: Partial<Parameters<typeof applyRaiseBudget>[2]> = {}) {
  return {
    updateSettings: vi.fn().mockResolvedValue(undefined),
    dispatchBookingChanged: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn() },
    formatCurrency: (c: number) => `$${(c / 100).toFixed(0)}`,
    ...overrides,
  };
}

describe('applyRaiseBudget', () => {
  it('persists, dispatches, and toasts on happy path', async () => {
    const deps = makeDeps();
    const res = await applyRaiseBudget(100_000, 150_000, deps);
    expect(res).toEqual({ ok: true, previousBudgetCents: 100_000 });
    expect(deps.updateSettings).toHaveBeenCalledWith({ budget_total_cents: 150_000 });
    expect(deps.dispatchBookingChanged).toHaveBeenCalledOnce();
    expect(deps.toast.success).toHaveBeenCalledWith('Budget raised to $1500');
    expect(deps.toast.error).not.toHaveBeenCalled();
  });

  it('refuses when suggested is not higher than current', async () => {
    const deps = makeDeps();
    const res = await applyRaiseBudget(150_000, 150_000, deps);
    expect(res).toEqual({ ok: false, reason: 'not_higher' });
    expect(deps.updateSettings).not.toHaveBeenCalled();
    expect(deps.dispatchBookingChanged).not.toHaveBeenCalled();
  });

  it('refuses when suggested is lower than current', async () => {
    const deps = makeDeps();
    const res = await applyRaiseBudget(150_000, 100_000, deps);
    expect(res).toEqual({ ok: false, reason: 'not_higher' });
    expect(deps.updateSettings).not.toHaveBeenCalled();
  });

  it('refuses invalid suggestion (zero)', async () => {
    const deps = makeDeps();
    const res = await applyRaiseBudget(100_000, 0, deps);
    expect(res).toEqual({ ok: false, reason: 'invalid_suggestion' });
    expect(deps.updateSettings).not.toHaveBeenCalled();
  });

  it('refuses invalid suggestion (NaN)', async () => {
    const deps = makeDeps();
    const res = await applyRaiseBudget(100_000, Number.NaN, deps);
    expect(res).toEqual({ ok: false, reason: 'invalid_suggestion' });
  });

  it('toasts an error and reports mutation_failed when persistence rejects', async () => {
    const deps = makeDeps({
      updateSettings: vi.fn().mockRejectedValue(new Error('db down')),
    });
    const res = await applyRaiseBudget(100_000, 150_000, deps);
    expect(res).toEqual({ ok: false, reason: 'mutation_failed' });
    expect(deps.toast.error).toHaveBeenCalledWith('Failed to raise budget');
    expect(deps.dispatchBookingChanged).not.toHaveBeenCalled();
  });
});
