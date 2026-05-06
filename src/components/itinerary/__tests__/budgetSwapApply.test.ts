import { describe, it, expect } from 'vitest';
import { applyBudgetSuggestion, type BudgetSwapSuggestion } from '../budgetSwapApply';

type Activity = {
  id: string;
  title?: string | null;
  name?: string | null;
  startTime?: string | null;
  cost?: any;
  bookingUrl?: string;
  viatorProductCode?: string;
  isVoyancePick?: boolean;
};
type Day = { dayNumber: number; activities: Activity[] };

const makeDays = (): Day[] => [
  {
    dayNumber: 1,
    activities: [
      {
        id: 'a1',
        title: 'Dinner at Le Jules Verne',
        name: 'Dinner at Le Jules Verne',
        startTime: '19:30',
        cost: { amount: 250, currency: 'USD', basis: 'per_person' },
        bookingUrl: 'https://example.com/booking',
        viatorProductCode: 'V123',
        isVoyancePick: true,
      },
    ],
  },
  {
    dayNumber: 2,
    activities: [
      {
        id: 'a2',
        title: 'Louvre Tour',
        name: 'Louvre Tour',
        startTime: '10:00',
        cost: 80,
      },
    ],
  },
];

const swap = (overrides: Partial<BudgetSwapSuggestion> = {}): BudgetSwapSuggestion => ({
  activity_id: 'a1',
  current_item: 'Dinner at Le Jules Verne',
  current_cost: 25000,
  suggested_swap: 'Dinner at Bistrot Paul Bert',
  suggested_description: 'Classic Parisian bistro with a great wine list',
  new_cost: 9000, // cents
  savings: 16000,
  day_number: 1,
  swap_type: 'swap',
  ...overrides,
});

describe('applyBudgetSuggestion — swap', () => {
  it('replaces title, name, description, lowers cost.amount, preserves basis, clears booking metadata', () => {
    const r = applyBudgetSuggestion(makeDays(), swap());
    expect(r.ok).toBe(true);
    const a = r.updatedDays[0].activities[0];
    expect(a.title).toContain('Bistrot Paul Bert');
    expect(a.name).toBe(a.title);
    expect((a.cost as any).amount).toBe(90);
    expect((a.cost as any).basis).toBe('per_person');
    expect(a.bookingUrl).toBeUndefined();
    expect(a.viatorProductCode).toBeUndefined();
    expect(a.isVoyancePick).toBe(false);
  });

  it('blocks when new cost is not strictly lower', () => {
    const r = applyBudgetSuggestion(makeDays(), swap({ new_cost: 30000 }));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('cost-not-lower');
    expect((r.updatedDays[0].activities[0].cost as any).amount).toBe(250);
  });

  it('returns not-found when activity_id is missing on the matched day', () => {
    const r = applyBudgetSuggestion(makeDays(), swap({ activity_id: 'does-not-exist' }));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not-found');
  });

  it('handles numeric (non-object) cost field', () => {
    const r = applyBudgetSuggestion(makeDays(), swap({
      activity_id: 'a2',
      day_number: 2,
      current_item: 'Louvre Tour',
      suggested_swap: 'Musée d Orsay self-guided',
      new_cost: 2000,
    }));
    expect(r.ok).toBe(true);
    expect(r.updatedDays[1].activities[0].cost).toBe(20);
  });
});

describe('applyBudgetSuggestion — drop', () => {
  it('removes the activity from its day', () => {
    const r = applyBudgetSuggestion(makeDays(), swap({ swap_type: 'drop' }));
    expect(r.ok).toBe(true);
    expect(r.updatedDays[0].activities).toHaveLength(0);
    expect(r.updatedDays[1].activities).toHaveLength(1);
  });

  it('finds the activity even when suggestion.day_number is stale', () => {
    const r = applyBudgetSuggestion(
      makeDays(),
      swap({
        swap_type: 'drop',
        activity_id: 'a2',
        day_number: 99, // stale
        current_item: 'Louvre Tour',
      }),
    );
    expect(r.ok).toBe(true);
    expect(r.updatedDays[1].activities).toHaveLength(0);
  });

  it('returns not-found when the activity is missing', () => {
    const r = applyBudgetSuggestion(
      makeDays(),
      swap({ swap_type: 'drop', activity_id: 'ghost' }),
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not-found');
  });
});
