import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { deriveMealPolicy } from "./meal-policy.ts";
import { detectMealSlots, validateGeneratedDay, type StrictDayMinimal } from "./day-validation.ts";

function buildDay(titles: string[]): StrictDayMinimal {
  return {
    dayNumber: 2,
    date: "2026-06-02",
    title: "Test Day",
    activities: titles.map((title, index) => ({
      id: `act-${index + 1}`,
      title,
      startTime: `${String(8 + index * 2).padStart(2, '0')}:00`,
      endTime: `${String(9 + index * 2).padStart(2, '0')}:00`,
      category: title.toLowerCase().includes('breakfast') || title.toLowerCase().includes('lunch') || title.toLowerCase().includes('dinner') ? 'dining' : 'activity',
      location: { name: title, address: 'Test Address' },
      cost: { amount: 10, currency: 'USD' },
      description: title,
      tags: [],
      bookingRequired: false,
      transportation: { method: 'walk', duration: '10 min', estimatedCost: { amount: 0, currency: 'USD' }, instructions: '' },
    })),
  };
}

Deno.test('meal policy: full exploration day requires breakfast lunch dinner', () => {
  const policy = deriveMealPolicy({
    dayNumber: 2,
    totalDays: 4,
    isFirstDay: false,
    isLastDay: false,
  });

  assertEquals(policy.dayMode, 'full_exploration');
  assertEquals(policy.requiredMeals, ['breakfast', 'lunch', 'dinner']);
});

Deno.test('meal policy: midday arrival only requires lunch and dinner', () => {
  const policy = deriveMealPolicy({
    dayNumber: 1,
    totalDays: 4,
    isFirstDay: true,
    isLastDay: false,
    arrivalTime24: '12:30',
  });

  assertEquals(policy.requiredMeals, ['lunch', 'dinner']);
});

Deno.test('meal detector finds explicit breakfast lunch dinner labels', () => {
  const meals = detectMealSlots(buildDay(['Breakfast at Alba', 'Lunch at Mercado', 'Dinner at Noma']).activities);
  assertEquals(meals, ['breakfast', 'lunch', 'dinner']);
});

Deno.test('validateGeneratedDay fails when required meal policy is not met', () => {
  const result = validateGeneratedDay(
    buildDay(['Museum Visit', 'Lunch at Mercado', 'Sunset Walk']),
    2,
    false,
    false,
    4,
    [],
    false,
    [],
    ['breakfast', 'lunch', 'dinner']
  );

  assertEquals(result.errors.some(error => error.includes('MISSING MEAL: Day 2 is missing BREAKFAST')), true);
  assertEquals(result.errors.some(error => error.includes('MISSING MEAL: Day 2 is missing DINNER')), true);
});

Deno.test('validateGeneratedDay passes when required meal policy is met', () => {
  const result = validateGeneratedDay(
    buildDay(['Breakfast at Alba', 'Museum Visit', 'Lunch at Mercado', 'Dinner at Noma']),
    2,
    false,
    false,
    4,
    [],
    false,
    [],
    ['breakfast', 'lunch', 'dinner']
  );

  assertEquals(result.errors.filter(error => error.includes('MISSING MEAL')).length, 0);
});
