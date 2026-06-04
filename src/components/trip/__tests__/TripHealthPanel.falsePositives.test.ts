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

describe('analyzeHealth — bookend day requiredMeals from coarse dayMode (Lisbon regression)', () => {
  // Live repro: a trip where the backend persisted ONLY `metadata.quality.dayMode`
  // (the real `requiredMeals` array never reached the served day payload) and
  // `flight_selection` was null. The panel must derive bookend-day meal
  // requirements from the schedule clock, not the ambiguous coarse dayMode map —
  // otherwise a 2pm arrival false-flags "missing lunch" and a 7am-checkout /
  // 11am-flight departure false-flags "missing breakfast", flipping a complete
  // trip to "Partial".
  const mk = (n: number, dayMode: string, activities: any[]) =>
    day(n, activities, { metadata: { quality: { dayMode } } });

  const days = [
    // Day 1 — arrival flight lands ~14:45; first real activity 16:15 ⇒ dinner-only.
    mk(1, 'midday_arrival', [
      { name: 'Arrival Flight', category: 'flight', startTime: '14:45', endTime: '15:30' },
      { name: 'Transfer to Your Hotel', category: 'transport', startTime: '14:45', endTime: '15:10' },
      { name: 'Check-in at Your Hotel', category: 'accommodation', startTime: '15:25', endTime: '15:55' },
      { name: 'Evening Fado', category: 'cultural', startTime: '16:15', endTime: '18:30' },
      { name: 'Dinner at Sacramento', category: 'dining', startTime: '20:40', endTime: '22:25' },
    ]),
    // Day 2 — genuine full day WITH all three meals (control: must not false-flag).
    mk(2, 'full_exploration', [
      { name: 'Breakfast', category: 'dining', startTime: '08:30', endTime: '09:30' },
      { name: 'Museum', category: 'sightseeing', startTime: '10:00', endTime: '12:00' },
      { name: 'Lunch', category: 'dining', startTime: '13:00', endTime: '14:00' },
      { name: 'Dinner', category: 'dining', startTime: '19:30', endTime: '21:00' },
    ]),
    // Day 3 — full day, all meals.
    mk(3, 'full_exploration', [
      { name: 'Breakfast', category: 'dining', startTime: '09:00', endTime: '10:00' },
      { name: 'Walk', category: 'sightseeing', startTime: '11:00', endTime: '12:30' },
      { name: 'Lunch', category: 'dining', startTime: '13:00', endTime: '14:00' },
      { name: 'Dinner', category: 'dining', startTime: '20:00', endTime: '21:30' },
    ]),
    // Day 4 — checkout 07:00, flight DEPARTS 11:00 (lands home 13:00). Too tight
    // for breakfast ⇒ no meal required. The flight card's endTime (13:00) must
    // NOT be mistaken for the departure clock (that would wrongly demand lunch).
    mk(4, 'early_departure', [
      { name: 'Checkout from Your Hotel', category: 'accommodation', startTime: '07:00', endTime: '07:30' },
      { name: 'Taxi to Airport', category: 'transport', startTime: '07:35', endTime: '08:00' },
      { name: 'Departure', category: 'transport', startTime: '08:00', endTime: '08:25' },
      { name: 'Departure Flight', category: 'flight', startTime: '11:00', endTime: '13:00' },
    ]),
  ];

  it('does NOT flag "missing lunch" on a mid-afternoon arrival (Day 1)', () => {
    const issues = analyzeHealth(days);
    const missing = issues.find((i) => i.id === 'missing-meals-1');
    expect(missing).toBeUndefined();
  });

  it('does NOT flag "missing breakfast" on a too-tight morning departure (Day 4)', () => {
    const issues = analyzeHealth(days);
    const missing = issues.find((i) => i.id === 'missing-meals-4');
    expect(missing).toBeUndefined();
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
