import { describe, it, expect } from 'vitest';
import { inferDayModeFallback } from '../inferDayMode';

describe('inferDayModeFallback — departure last-resort', () => {
  it('returns afternoon_departure when flight clock missing AND last activity ends 16:00', () => {
    const day = {
      activities: [
        { category: 'dining', title: 'Breakfast', startTime: '08:00', endTime: '09:00' },
        { category: 'cultural', title: 'Kinkaku-ji', startTime: '14:00', endTime: '16:00' },
        { category: 'transit', title: 'Travel to Airport', startTime: '17:00', endTime: '17:45' },
      ],
    };
    const r = inferDayModeFallback({ day, dayIndex: 2, totalDays: 3, tripFlightSelection: {} });
    expect(r?.dayMode).toBe('afternoon_departure');
    expect(r?.requiredMeals).toEqual(['breakfast']);
  });

  it('returns early_departure when flight clock missing AND last non-bookend ends 11:30', () => {
    const day = {
      activities: [
        { category: 'dining', title: 'Breakfast', startTime: '08:00', endTime: '09:00' },
        { category: 'sightseeing', title: 'Quick stroll', startTime: '10:00', endTime: '11:30' },
        { category: 'transfer', title: 'Travel to Airport', startTime: '12:00', endTime: '12:45' },
      ],
    };
    const r = inferDayModeFallback({ day, dayIndex: 2, totalDays: 3, tripFlightSelection: {} });
    expect(r?.dayMode).toBe('early_departure');
    expect(r?.requiredMeals).toEqual(['breakfast']);
  });

  it('returns null when last day has only bookend/transit cards (cannot infer)', () => {
    const day = {
      activities: [
        { category: 'transit', title: 'Travel to Airport', startTime: '12:00', endTime: '12:45' },
      ],
    };
    const r = inferDayModeFallback({ day, dayIndex: 2, totalDays: 3, tripFlightSelection: {} });
    expect(r).toBeNull();
  });

  it('still uses flight clock when present (regression guard)', () => {
    const r = inferDayModeFallback({
      day: { activities: [] },
      dayIndex: 2,
      totalDays: 3,
      tripFlightSelection: { return: { departure_time: '20:30' } },
    });
    expect(r?.dayMode).toBe('evening_departure');
    expect(r?.requiredMeals).toEqual(['breakfast', 'lunch', 'dinner']);
  });
});

describe('inferDayModeFallback — arrival band', () => {
  const arrivalDay = {
    activities: [
      { category: 'sightseeing', title: 'A', startTime: '11:00', endTime: '12:00' },
      { category: 'dining', title: 'Lunch', startTime: '13:00', endTime: '14:00' },
      { category: 'dining', title: 'Dinner', startTime: '19:00', endTime: '20:30' },
    ],
  };

  it('arrival before 09:30 → breakfast required (full day)', () => {
    const r = inferDayModeFallback({
      day: arrivalDay, dayIndex: 0, totalDays: 2,
      tripFlightSelection: { outbound: { arrival_time: '08:00' } },
    });
    expect(r?.requiredMeals).toEqual(['breakfast', 'lunch', 'dinner']);
  });

  it('arrival 09:30–11:59 → brunch band, NO breakfast required', () => {
    const r = inferDayModeFallback({
      day: arrivalDay, dayIndex: 0, totalDays: 2,
      tripFlightSelection: { outbound: { arrival_time: '09:50' } },
    });
    expect(r?.requiredMeals).toEqual(['lunch', 'dinner']);
    expect(r?.requiredMeals).not.toContain('breakfast');
  });

  it('arrival at or after 13:00 → dinner only', () => {
    const r = inferDayModeFallback({
      day: arrivalDay, dayIndex: 0, totalDays: 2,
      tripFlightSelection: { outbound: { arrival_time: '15:30' } },
    });
    expect(r?.requiredMeals).toEqual(['dinner']);
  });
});
