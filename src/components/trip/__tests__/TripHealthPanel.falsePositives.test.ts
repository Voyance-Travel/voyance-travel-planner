import { describe, it, expect } from 'vitest';
import { analyzeHealth, classifyMealSlot } from '../TripHealthPanel';

const day = (n: number, activities: any[], extra: any = {}) => ({
  dayNumber: n,
  activities,
  ...extra,
});

describe('classifyMealSlot — visible-time fallback (legacy field names)', () => {
  it('reads `time` when startTime missing', () => {
    expect(
      classifyMealSlot({ category: 'dining', title: 'Bistrot', time: '13:00' })
    ).toBe('lunch');
  });
  it('reads `start_time` when startTime missing', () => {
    expect(
      classifyMealSlot({ category: 'restaurant', title: 'Sushi-ya', start_time: '19:30' })
    ).toBe('dinner');
  });
  it('reads `displayStartTime` (renderer-stamped buffered value)', () => {
    expect(
      classifyMealSlot({ category: 'dining', title: 'Brunch Spot', displayStartTime: '11:00' })
    ).toBe('breakfast');
  });
  it('respects metadata.meal_slot snake_case', () => {
    expect(
      classifyMealSlot({ category: 'experience', title: 'Chef Counter', metadata: { meal_slot: 'dinner' }, time: '19:00' })
    ).toBe('dinner');
  });
  it('respects top-level meal_slot snake_case', () => {
    expect(
      classifyMealSlot({ category: 'dining', title: 'Café', meal_slot: 'breakfast', time: '09:00' })
    ).toBe('breakfast');
  });
});

describe('analyzeHealth — departure day thin-schedule false positive', () => {
  it('does NOT flag thin-day on last day with airport-transfer terminal card', () => {
    const days = [
      day(1, [
        { name: 'A', category: 'sightseeing', startTime: '10:00', endTime: '11:00' },
        { name: 'B', category: 'dining', startTime: '12:30', endTime: '13:30', mealSlot: 'lunch' },
        { name: 'C', category: 'dining', startTime: '19:00', endTime: '20:30', mealSlot: 'dinner' },
      ]),
      day(2, [
        { name: 'X', category: 'sightseeing', startTime: '10:00', endTime: '11:00' },
        { name: 'Y', category: 'dining', startTime: '12:30', endTime: '13:30', mealSlot: 'lunch' },
        { name: 'Z', category: 'dining', startTime: '19:00', endTime: '20:30', mealSlot: 'dinner' },
      ]),
      day(3, [
        { name: 'Breakfast', category: 'dining', startTime: '08:30', endTime: '09:30', mealSlot: 'breakfast' },
        { name: 'Airport Transfer', category: 'transfer', startTime: '13:00', endTime: '13:45' },
      ]),
    ];
    const issues = analyzeHealth(days);
    const thin = issues.find((i) => i.id === 'thin-day-3');
    expect(thin).toBeUndefined();
  });
});

describe('analyzeHealth — meals stored under legacy time field are detected', () => {
  it('day with lunch+dinner using `time` instead of `startTime` is not flagged', () => {
    const days = [
      day(1, [
        { name: 'Walk', category: 'sightseeing', startTime: '10:00', endTime: '11:00' },
        { name: 'Lunch', category: 'dining', time: '13:00', endTime: '14:00' },
        { name: 'Dinner', category: 'restaurant', time: '19:30', endTime: '21:00' },
      ], {
        metadata: { quality: { dayMode: 'morning_arrival', requiredMeals: ['lunch', 'dinner'] } },
      }),
    ];
    const issues = analyzeHealth(days);
    const missing = issues.find((i) => i.id === 'missing-meals-1');
    expect(missing).toBeUndefined();
  });
});
