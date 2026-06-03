import { describe, it, expect } from 'vitest';
import { classifyMealSlot } from '../TripHealthPanel';
import { inferDayModeFallback } from '@/lib/itinerary/inferDayMode';

describe('TripHealthPanel.classifyMealSlot — food halls', () => {
  it('counts a food hall tagged as activity as the meal at its time slot', () => {
    expect(
      classifyMealSlot({ title: 'Social Hour at Time Out Market', category: 'activity', startTime: '19:25' }),
    ).toBe('dinner');
    expect(
      classifyMealSlot({ title: 'Lunch grazing at Mercado da Ribeira', category: 'activity', startTime: '13:00' }),
    ).toBe('lunch');
  });

  it('does NOT count a sightseeing market visit as a meal', () => {
    expect(classifyMealSlot({ title: 'Visit the Flower Market', category: 'activity', startTime: '13:00' })).toBeNull();
    expect(classifyMealSlot({ title: 'Christmas Market stroll', category: 'activity', startTime: '18:30' })).toBeNull();
  });

  it('still rejects a plain museum at lunchtime', () => {
    expect(classifyMealSlot({ title: 'Gulbenkian Museum', category: 'culture', startTime: '13:00' })).toBeNull();
  });
});

describe('inferDayModeFallback — arrival lunch threshold matches backend', () => {
  const base = { day: {}, dayIndex: 0, totalDays: 4 };

  it('a 2 PM arrival does NOT require lunch (dinner only)', () => {
    const out = inferDayModeFallback({ ...base, tripFlightSelection: { outbound: { arrivalTime: '14:00' } } });
    expect(out?.requiredMeals).toEqual(['dinner']);
  });

  it('a 12:30 arrival still requires lunch + dinner', () => {
    const out = inferDayModeFallback({ ...base, tripFlightSelection: { outbound: { arrivalTime: '12:30' } } });
    expect(out?.requiredMeals).toEqual(['lunch', 'dinner']);
  });

  it('a 9 AM arrival requires all three', () => {
    const out = inferDayModeFallback({ ...base, tripFlightSelection: { outbound: { arrivalTime: '09:00' } } });
    expect(out?.requiredMeals).toEqual(['breakfast', 'lunch', 'dinner']);
  });
});
