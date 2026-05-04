/**
 * Budget realism helper
 *
 * Single source of truth for diagnosing why a trip is over budget and what
 * a realistic budget floor would look like. Used by:
 *   - BudgetTab over-budget banner (diagnostic + one-click fixes)
 *   - BudgetSetupDialog preset realism note
 *   - Hotel selector pre-confirm budget-fit hint (when present)
 *
 * Pure function, no React/UI dependencies.
 */

export type OverageDriver = 'hotel' | 'flight' | 'discretionary';

export type BudgetFitSeverity = 'ok' | 'tight' | 'over' | 'hotel_dominated';

export interface BudgetFitInput {
  /** Cents of hotel cost included in the trip total (only counts if include_hotel is on) */
  hotelCents: number;
  /** Cents of flight cost included in the trip total (only counts if include_flight is on) */
  flightCents: number;
  /** All other planned cents (food + activities + transit + misc) */
  discretionaryCents: number;
  /** Current trip budget in cents */
  budgetCents: number;
  /** Whether hotel is currently included in the budget */
  includeHotel: boolean;
  /** Whether flight is currently included in the budget */
  includeFlight: boolean;
}

export interface BudgetFitAssessment {
  severity: BudgetFitSeverity;
  /** Sum of all included costs (matches snapshot.tripTotalCents semantics) */
  totalCents: number;
  /** Cents over the budget (0 if at/under) */
  overageCents: number;
  /** Percent of budget used (e.g. 192 means 192%) */
  usedPercent: number;
  /** Primary cost drivers, sorted largest first */
  drivers: { kind: OverageDriver; cents: number; pctOfBudget: number }[];
  /** True when a single fixed cost (hotel/flight) exceeds the entire budget */
  hotelExceedsBudget: boolean;
  flightExceedsBudget: boolean;
  /** Recommended budget floor that would clear the overage with a small cushion */
  suggestedBudgetCents: number;
}

const ROUND_TO = 10_000; // round to nearest $100

function roundUpTo(cents: number, step: number): number {
  if (cents <= 0) return 0;
  return Math.ceil(cents / step) * step;
}

export function assessBudgetFit(input: BudgetFitInput): BudgetFitAssessment {
  const hotel = input.includeHotel ? Math.max(0, input.hotelCents) : 0;
  const flight = input.includeFlight ? Math.max(0, input.flightCents) : 0;
  const disc = Math.max(0, input.discretionaryCents);
  const total = hotel + flight + disc;
  const budget = Math.max(0, input.budgetCents);

  const overage = Math.max(0, total - budget);
  const usedPercent = budget > 0 ? (total / budget) * 100 : 0;

  const drivers: BudgetFitAssessment['drivers'] = [
    { kind: 'hotel' as const, cents: hotel },
    { kind: 'flight' as const, cents: flight },
    { kind: 'discretionary' as const, cents: disc },
  ]
    .filter(d => d.cents > 0)
    .map(d => ({
      ...d,
      pctOfBudget: budget > 0 ? Math.round((d.cents / budget) * 100) : 0,
    }))
    .sort((a, b) => b.cents - a.cents);

  const hotelExceedsBudget = budget > 0 && hotel > budget;
  const flightExceedsBudget = budget > 0 && flight > budget;

  // A 10% cushion on top of total — cosmetic only, gives the user breathing room.
  const cushion = Math.round(total * 0.1);
  const suggestedBudgetCents = roundUpTo(total + cushion, ROUND_TO);

  let severity: BudgetFitSeverity = 'ok';
  if (budget > 0) {
    if (hotelExceedsBudget || (hotel > 0 && hotel >= budget * 0.6 && total > budget)) {
      severity = 'hotel_dominated';
    } else if (total > budget) {
      severity = 'over';
    } else if (usedPercent >= 85) {
      severity = 'tight';
    }
  }

  return {
    severity,
    totalCents: total,
    overageCents: overage,
    usedPercent,
    drivers,
    hotelExceedsBudget,
    flightExceedsBudget,
    suggestedBudgetCents,
  };
}

export function formatMultiplier(cents: number, budgetCents: number): string {
  if (budgetCents <= 0) return '—';
  const x = cents / budgetCents;
  if (x >= 10) return `${Math.round(x)}×`;
  return `${x.toFixed(1)}×`;
}
