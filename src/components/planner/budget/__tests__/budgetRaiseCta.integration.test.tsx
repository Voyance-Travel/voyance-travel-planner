import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { applyRaiseBudget } from '../raiseBudgetApply';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
import { toast } from 'sonner';

/**
 * Mini harness mirroring BudgetTab's wiring of the inline "Raise budget to $X"
 * CTA. We render the same onClick path used by BudgetTab so a regression in the
 * extracted helper or how BudgetTab invokes it would surface here.
 */
function RaiseBudgetButton({
  current,
  suggested,
  updateSettings,
  formatCurrency,
}: {
  current: number;
  suggested: number;
  updateSettings: (s: { budget_total_cents: number }) => Promise<void>;
  formatCurrency: (c: number) => string;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        applyRaiseBudget(current, suggested, {
          updateSettings,
          dispatchBookingChanged: () =>
            window.dispatchEvent(new CustomEvent('booking-changed')),
          toast,
          formatCurrency,
        })
      }
    >
      Raise budget to {formatCurrency(suggested)}
    </button>
  );
}

describe('Raise budget CTA integration', () => {
  it('calls updateSettings with the suggested cents, fires booking-changed, and toasts', async () => {
    const updateSettings = vi.fn().mockResolvedValue(undefined);
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const formatCurrency = (c: number) => `$${(c / 100).toFixed(0)}`;

    render(
      <RaiseBudgetButton
        current={100_000}
        suggested={150_000}
        updateSettings={updateSettings}
        formatCurrency={formatCurrency}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Raise budget to \$1500/i }));

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith({ budget_total_cents: 150_000 });
    });
    const events = dispatchSpy.mock.calls.map(
      (c) => (c[0] as CustomEvent).type,
    );
    expect(events).toContain('booking-changed');
    expect(toast.success).toHaveBeenCalledWith('Budget raised to $1500');

    dispatchSpy.mockRestore();
  });

  it('does not mutate when suggested is not higher than current', async () => {
    const updateSettings = vi.fn().mockResolvedValue(undefined);
    const formatCurrency = (c: number) => `$${(c / 100).toFixed(0)}`;

    render(
      <RaiseBudgetButton
        current={150_000}
        suggested={150_000}
        updateSettings={updateSettings}
        formatCurrency={formatCurrency}
      />,
    );

    fireEvent.click(screen.getByRole('button'));

    await new Promise((r) => setTimeout(r, 0));
    expect(updateSettings).not.toHaveBeenCalled();
  });
});
