export interface RaiseBudgetDeps {
  updateSettings: (s: { budget_total_cents: number }) => Promise<void>;
  dispatchBookingChanged: () => void;
  toast: { success: (msg: string) => void; error: (msg: string) => void };
  formatCurrency: (cents: number) => string;
}

export type RaiseBudgetReason =
  | 'invalid_suggestion'
  | 'not_higher'
  | 'mutation_failed';

export interface RaiseBudgetResult {
  ok: boolean;
  reason?: RaiseBudgetReason;
  /** Previous budget (cents) before the raise — provided on success so callers can offer Undo. */
  previousBudgetCents?: number;
}

/**
 * Pure handler for the inline "Raise budget to $X" CTA in BudgetTab.
 * Validates the suggested target, persists it via updateSettings, fires the
 * shared `booking-changed` event so summaries/percentages refresh, and
 * surfaces a toast. Extracted from the inline closure so it can be unit
 * tested independently of React.
 */
export async function applyRaiseBudget(
  currentBudgetCents: number,
  suggestedCents: number,
  deps: RaiseBudgetDeps,
): Promise<RaiseBudgetResult> {
  if (!Number.isFinite(suggestedCents) || suggestedCents <= 0) {
    return { ok: false, reason: 'invalid_suggestion' };
  }
  if (suggestedCents <= currentBudgetCents) {
    return { ok: false, reason: 'not_higher' };
  }
  try {
    await deps.updateSettings({ budget_total_cents: suggestedCents });
    deps.dispatchBookingChanged();
    deps.toast.success(`Budget raised to ${deps.formatCurrency(suggestedCents)}`);
    return { ok: true, previousBudgetCents: currentBudgetCents };
  } catch {
    deps.toast.error('Failed to raise budget');
    return { ok: false, reason: 'mutation_failed' };
  }
}
