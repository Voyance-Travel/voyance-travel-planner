/**
 * budgetSwapApply.ts — Pure logic for applying a Budget Coach suggestion
 * to the in-memory `days` state. Lives outside React so it can be tested
 * deterministically and so the inline `onApplyBudgetSwap` handler in
 * EditorialItinerary stays thin.
 *
 * Returns `{ ok, updatedDays, reason? }`. The caller is responsible for:
 *   - calling setDays(updatedDays) on success
 *   - syncBudgetFromDays(updatedDays) to persist activity_costs
 *   - emitting toasts and invalidating react-query caches
 *   - mapping `reason` to user-facing copy
 *
 * Drop path uses resolveDropTarget so a stale `suggestion.day_number`
 * still finds the activity across days.
 */
import { resolveDropTarget } from './budgetDropResolver';
import { enforceMealTimeCoherence } from '@/utils/mealTimeCoherence';

export interface BudgetSwapSuggestion {
  activity_id: string;
  current_item?: string | null;
  current_cost?: number;
  suggested_swap: string;
  suggested_description?: string;
  /** new_cost is in CENTS from the edge function. */
  new_cost: number;
  savings?: number;
  day_number: number;
  swap_type?: 'swap' | 'drop' | 'consolidate';
}

export type ApplyReason = 'not-found' | 'cost-not-lower' | 'title-mismatch';

export interface ApplyResult<TDay> {
  ok: boolean;
  updatedDays: TDay[];
  reason?: ApplyReason;
}

export function applyBudgetSuggestion<
  TActivity extends {
    id: string;
    title?: string | null;
    name?: string | null;
    startTime?: string | null;
    time?: string | null;
    cost?: any;
    [key: string]: any;
  },
  TDay extends { dayNumber: number; activities: TActivity[] } & Record<string, any>,
>(
  days: TDay[],
  suggestion: BudgetSwapSuggestion,
): ApplyResult<TDay> {
  // ─── DROP path ────────────────────────────────────────────
  if (suggestion.swap_type === 'drop') {
    const resolved = resolveDropTarget(days as any, suggestion as any);
    if (resolved.ok === false) {
      return { ok: false, updatedDays: days, reason: resolved.error };
    }
    const { dayIdx } = resolved;
    const targetId = suggestion.activity_id;
    const updated = days.map((day, idx) => {
      if (idx !== dayIdx) return day;
      return { ...day, activities: day.activities.filter((a) => a.id !== targetId) };
    });
    return { ok: true, updatedDays: updated };
  }

  // ─── SWAP path (default) ─────────────────────────────────
  const newCostWhole = Math.round(suggestion.new_cost / 100);
  let applied = false;
  let blockedByCost = false;

  const updated = days.map((day) => {
    if (day.dayNumber !== suggestion.day_number) return day;
    return {
      ...day,
      activities: day.activities.map((act) => {
        if (act.id !== suggestion.activity_id) return act;

        const currentCostWhole =
          typeof act.cost === 'object' && act.cost !== null
            ? Number((act.cost as any).amount ?? 0)
            : Number(act.cost ?? 0);

        // Strict guard: only apply if new cost is strictly lower
        if (currentCostWhole > 0 && newCostWhole >= currentCostWhole) {
          blockedByCost = true;
          return act;
        }

        applied = true;
        const originalBasis =
          typeof act.cost === 'object' && act.cost !== null
            ? (act.cost as any).basis
            : undefined;
        const coherentTitle = enforceMealTimeCoherence(
          suggestion.suggested_swap,
          act.startTime || act.time || '',
        );
        return {
          ...act,
          title: coherentTitle,
          name: coherentTitle,
          description: suggestion.suggested_description || coherentTitle,
          cost:
            typeof act.cost === 'object' && act.cost !== null
              ? { ...(act.cost as any), amount: newCostWhole, basis: originalBasis }
              : newCostWhole,
          location: {
            ...((act as any).location || {}),
            name: coherentTitle,
          },
          // Replacement is a different activity — drop stale booking metadata
          bookingUrl: undefined,
          viatorProductCode: undefined,
          website: undefined,
          externalBookingUrl: undefined,
          vendorPrice: undefined,
          tips: undefined,
          voyanceInsight: undefined,
          isVoyancePick: false,
        } as TActivity;
      }),
    };
  });

  if (applied) return { ok: true, updatedDays: updated };
  if (blockedByCost) return { ok: false, updatedDays: days, reason: 'cost-not-lower' };
  return { ok: false, updatedDays: days, reason: 'not-found' };
}
