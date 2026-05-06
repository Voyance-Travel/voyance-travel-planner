import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BudgetCoach, type BudgetSuggestion } from '../BudgetCoach';

// Mock toast — we don't need the real renderer
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock the supabase client used by BudgetCoach so the AI call is deterministic
const invokeMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: any[]) => invokeMock(...args),
    },
  },
}));

const itineraryDays = [
  {
    dayNumber: 1,
    activities: [
      {
        id: 'a1',
        title: 'Dinner at Le Jules Verne',
        category: 'dining',
        cost: { amount: 250, currency: 'USD' },
      },
      {
        id: 'a2',
        title: 'Eiffel Tower Skip-the-Line Tour',
        category: 'activities',
        cost: { amount: 80, currency: 'USD' },
      },
    ],
  },
];

const seededSuggestion: BudgetSuggestion = {
  current_item: 'Dinner at Le Jules Verne',
  current_cost: 25000,
  suggested_swap: 'Dinner at Bistrot Paul Bert',
  suggested_description: 'Classic Paris bistro',
  new_cost: 9000,
  savings: 16000,
  reason: 'A beloved bistro for a fraction of the price',
  day_number: 1,
  activity_id: 'a1',
  swap_type: 'swap',
};

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    data: { suggestions: [seededSuggestion], all_protected: false, deep_cuts_mode: false, coverage_ratio: 1 },
    error: null,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('BudgetCoach Apply button — end-to-end interaction', () => {
  it('renders an Apply button, calls onApplySuggestion exactly once, and removes the row on success', async () => {
    const onApply = vi.fn().mockResolvedValue(true);

    render(
      <BudgetCoach
        tripId="trip-1"
        budgetTargetCents={20000_00} // 20,000 USD
        currentTotalCents={25000_00} // 25,000 USD — over budget
        currency="USD"
        destination="Paris"
        itineraryDays={itineraryDays}
        travelers={1}
        onApplySuggestion={onApply}
      />,
    );

    // Apply button appears once suggestions resolve
    const applyBtn = await screen.findByRole('button', { name: /^Apply$/i });
    expect(applyBtn).toBeInTheDocument();
    // Edge-function call happened exactly once
    expect(invokeMock).toHaveBeenCalledTimes(1);

    fireEvent.click(applyBtn);

    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({
      activity_id: 'a1',
      swap_type: 'swap',
    }));

    // After success the suggestion is pruned from the visible list
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^Apply$/i })).toBeNull();
    });
  });

  it('keeps the suggestion visible when the parent handler returns false', async () => {
    const onApply = vi.fn().mockResolvedValue(false);
    const { toast } = await import('sonner');

    render(
      <BudgetCoach
        tripId="trip-2"
        budgetTargetCents={20000_00}
        currentTotalCents={25000_00}
        currency="USD"
        destination="Paris"
        itineraryDays={itineraryDays}
        travelers={1}
        onApplySuggestion={onApply}
      />,
    );

    const applyBtn = await screen.findByRole('button', { name: /^Apply$/i });
    fireEvent.click(applyBtn);

    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    // Apply button still present — the row was NOT pruned
    expect(screen.getByRole('button', { name: /^Apply$/i })).toBeInTheDocument();
    // Coach surfaces a blocked-swap toast for non-drop suggestions
    expect((toast.error as any)).toHaveBeenCalled();
  });
});
