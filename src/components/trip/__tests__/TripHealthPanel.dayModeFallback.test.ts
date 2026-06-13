import { describe, it, expect } from 'vitest';
import { analyzeHealth } from '../TripHealthPanel';

const day = (n: number, activities: any[], extra: any = {}) => ({
  dayNumber: n,
  activities,
  ...extra,
});

describe('analyzeHealth — Day 1 arrival-band fallback (no persisted dayMode)', () => {
  it('arrival 09:50 with no dayMode → does NOT flag missing breakfast', () => {
    const days = [
      day(1, [
        // 11:00 brunch
        { name: 'Schwartz Brunch', category: 'dining', startTime: '11:00', endTime: '12:00', mealSlot: 'brunch' },
        { name: 'Old Port Walk', category: 'sightseeing', startTime: '13:00', endTime: '14:30' },
        { name: 'Plateau Stroll', category: 'sightseeing', startTime: '15:00', endTime: '16:30' },
        { name: 'Joe Beef Dinner', category: 'dining', startTime: '19:00', endTime: '21:00', mealSlot: 'dinner' },
      ]),
      day(2, [
        { name: 'A', category: 'sightseeing', startTime: '10:00', endTime: '11:00' },
        { name: 'B', category: 'dining', startTime: '12:30', endTime: '13:30', mealSlot: 'lunch' },
        { name: 'C', category: 'dining', startTime: '19:00', endTime: '20:30', mealSlot: 'dinner' },
      ]),
    ];
    const issues = analyzeHealth(days, {
      tripFlightSelection: { outbound: { arrival_time: '09:50' } },
    });
    const missing = issues.filter((i) => /missing/.test(i.message));
    expect(missing.find((i) => /Day 1/.test(i.message) && /breakfast/.test(i.message))).toBeUndefined();
  });

  // analyzeHealth deliberately does NOT surface meal-coverage warnings to users
  // (the detector false-fires on departure/arrival edge cases and made good
  // itineraries look broken — see TripHealthPanel `void missingMeals`). Meal
  // coverage is tracked server-side only. The arrival-band requiredMeals logic
  // itself (08:00 → breakfast required) is covered directly in
  // inferDayMode.departureFallback.test.ts.
  it('early arrival 08:00 missing breakfast → still NOT surfaced as a user warning', () => {
    const days = [
      day(1, [
        { name: 'A', category: 'sightseeing', startTime: '11:00', endTime: '12:00' },
        { name: 'B', category: 'dining', startTime: '13:00', endTime: '14:00', mealSlot: 'lunch' },
        { name: 'C', category: 'dining', startTime: '19:00', endTime: '20:30', mealSlot: 'dinner' },
      ]),
      day(2, [
        { name: 'X', category: 'sightseeing', startTime: '10:00', endTime: '11:00' },
        { name: 'Y', category: 'dining', startTime: '12:30', endTime: '13:30', mealSlot: 'lunch' },
        { name: 'Z', category: 'dining', startTime: '19:00', endTime: '20:30', mealSlot: 'dinner' },
      ]),
    ];
    const issues = analyzeHealth(days, {
      tripFlightSelection: { outbound: { arrival_time: '08:00' } },
    });
    const missingBreakfast = issues.find((i) => /Day 1/.test(i.message) && /breakfast/.test(i.message));
    expect(missingBreakfast).toBeUndefined();
  });
});

describe('analyzeHealth — last-day departure-band fallback', () => {
  it('departure 16:00 → does NOT flag missing dinner on last day', () => {
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
        // Only breakfast — afternoon departure
        { name: 'Maison Publique', category: 'dining', startTime: '08:30', endTime: '09:30', mealSlot: 'breakfast' },
        { name: 'Airport Transfer', category: 'transfer', startTime: '13:00', endTime: '13:45' },
      ]),
    ];
    const issues = analyzeHealth(days, {
      tripFlightSelection: { return: { departure_time: '16:00' } },
    });
    const day3Missing = issues.find((i) => /Day 3/.test(i.message) && /dinner/.test(i.message));
    expect(day3Missing).toBeUndefined();
  });
});

describe('analyzeHealth — display-time helper used for overlap', () => {
  it('uses displayStartTime over startTime for overlap conflict messages', () => {
    const days = [day(1, [
      { name: 'Pointe-à-Callière', category: 'culture', startTime: '10:30', endTime: '12:40' },
      // displayStartTime says 12:55 (15-min buffer applied at render).
      // Stale source startTime says 12:30. With displayStartTime preferred,
      // there should be NO overlap warning.
      { name: "Schwartz's", category: 'dining', startTime: '12:30', endTime: '13:30',
        displayStartTime: '12:55', displayEndTime: '13:55', mealSlot: 'lunch' },
      { name: 'Dinner', category: 'dining', startTime: '19:00', endTime: '20:30', mealSlot: 'dinner' },
    ])];
    const issues = analyzeHealth(days).filter(i => i.fixAction === 'fix_timing');
    expect(issues.length).toBe(0);
  });
});
