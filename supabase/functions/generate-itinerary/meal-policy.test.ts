import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { deriveMealPolicy } from "./meal-policy.ts";
import { detectMealSlots, validateGeneratedDay, deduplicateActivities, enforceRequiredMealsFinalGuard, type StrictDayMinimal, type StrictActivityMinimal } from "./day-validation.ts";

function buildDay(titles: string[], dayNumber: number = 2): StrictDayMinimal {
  return {
    dayNumber,
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

// =============================================================================
// MEAL POLICY TESTS
// =============================================================================

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

Deno.test('meal policy: early departure requires only breakfast', () => {
  const policy = deriveMealPolicy({
    dayNumber: 4,
    totalDays: 4,
    isFirstDay: false,
    isLastDay: true,
    departureTime24: '10:30',
  });

  assertEquals(policy.requiredMeals, ['breakfast']);
});

Deno.test('meal policy: late departure requires all 3 meals', () => {
  const policy = deriveMealPolicy({
    dayNumber: 4,
    totalDays: 4,
    isFirstDay: false,
    isLastDay: true,
    departureTime24: '20:00',
  });

  assertEquals(policy.requiredMeals, ['breakfast', 'lunch', 'dinner']);
});

// =============================================================================
// MEAL DETECTION TESTS
// =============================================================================

Deno.test('meal detector finds explicit breakfast lunch dinner labels', () => {
  const meals = detectMealSlots(buildDay(['Breakfast at Alba', 'Lunch at Mercado', 'Dinner at Noma']).activities);
  assertEquals(meals, ['breakfast', 'lunch', 'dinner']);
});

// =============================================================================
// VALIDATION TESTS
// =============================================================================

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

// =============================================================================
// MEAL-SAFE DEDUPLICATION TESTS
// =============================================================================

Deno.test('deduplicateActivities does NOT remove sole dining provider of required meal', () => {
  // Create a day with a duplicate dining activity (same concept+location)
  const day: StrictDayMinimal = {
    dayNumber: 2,
    date: '2026-06-02',
    title: 'Test',
    activities: [
      {
        id: 'a1', title: 'Breakfast at Café Roma', startTime: '08:00', endTime: '09:00',
        category: 'dining', location: { name: 'Café Roma', address: '123 Main' },
        cost: { amount: 10, currency: 'USD' }, description: '', tags: [],
        bookingRequired: false, transportation: { method: 'walk', duration: '5 min', estimatedCost: { amount: 0, currency: 'USD' }, instructions: '' },
      },
      {
        id: 'a2', title: 'Museum Visit', startTime: '10:00', endTime: '12:00',
        category: 'activity', location: { name: 'Museum', address: '456 Art' },
        cost: { amount: 15, currency: 'USD' }, description: '', tags: [],
        bookingRequired: false, transportation: { method: 'walk', duration: '10 min', estimatedCost: { amount: 0, currency: 'USD' }, instructions: '' },
      },
      // This is a "duplicate" by concept/location but is the sole dinner provider
      {
        id: 'a3', title: 'Dinner at Café Roma', startTime: '19:00', endTime: '20:30',
        category: 'dining', location: { name: 'Café Roma', address: '123 Main' },
        cost: { amount: 30, currency: 'USD' }, description: '', tags: [],
        bookingRequired: false, transportation: { method: 'walk', duration: '5 min', estimatedCost: { amount: 0, currency: 'USD' }, instructions: '' },
      },
    ],
  };

  // Without required meals, dedup would remove Dinner at Café Roma (same location)
  const withoutMealSafety = deduplicateActivities(day, []);
  // With required meals, dedup should keep it
  const withMealSafety = deduplicateActivities(day, ['breakfast', 'lunch', 'dinner']);

  // The dinner should be kept when meal safety is on
  const dinnerKept = withMealSafety.day.activities.some(a => a.title === 'Dinner at Café Roma');
  assertEquals(dinnerKept, true, 'Dinner at Café Roma should be preserved as sole dinner provider');
});

// =============================================================================
// MEAL FINAL GUARD TESTS
// =============================================================================

Deno.test('enforceRequiredMealsFinalGuard injects missing meals', () => {
  const activities = buildDay(['Museum Visit', 'Park Walk', 'Shopping']).activities;
  const result = enforceRequiredMealsFinalGuard(
    activities, ['breakfast', 'lunch', 'dinner'], 2, 'Paris', 'USD', 'full_exploration'
  );

  assertEquals(result.alreadyCompliant, false);
  assertEquals(result.injectedMeals.length, 3);
  assertEquals(result.injectedMeals.includes('breakfast'), true);
  assertEquals(result.injectedMeals.includes('lunch'), true);
  assertEquals(result.injectedMeals.includes('dinner'), true);

  // Verify the injected activities exist and are dining
  const detected = detectMealSlots(result.activities);
  assertEquals(detected.includes('breakfast'), true);
  assertEquals(detected.includes('lunch'), true);
  assertEquals(detected.includes('dinner'), true);
});

Deno.test('enforceRequiredMealsFinalGuard is compliant when meals present', () => {
  const activities = buildDay(['Breakfast at Alba', 'Lunch at Mercado', 'Dinner at Noma']).activities;
  const result = enforceRequiredMealsFinalGuard(
    activities, ['breakfast', 'lunch', 'dinner'], 2, 'Paris', 'USD', 'full_exploration'
  );

  assertEquals(result.alreadyCompliant, true);
  assertEquals(result.injectedMeals.length, 0);
});

Deno.test('enforceRequiredMealsFinalGuard only injects missing meals, not all', () => {
  const activities = buildDay(['Breakfast at Alba', 'Museum Visit', 'Shopping']).activities;
  const result = enforceRequiredMealsFinalGuard(
    activities, ['breakfast', 'lunch', 'dinner'], 2, 'Rome', 'USD', 'full_exploration'
  );

  assertEquals(result.alreadyCompliant, false);
  assertEquals(result.injectedMeals.length, 2);
  assertEquals(result.injectedMeals.includes('lunch'), true);
  assertEquals(result.injectedMeals.includes('dinner'), true);
  assertEquals(result.injectedMeals.includes('breakfast'), false, 'Breakfast already present');
});

Deno.test('enforceRequiredMealsFinalGuard returns sorted activities', () => {
  const activities = buildDay(['Museum Visit', 'Evening Walk']).activities;
  // Set times so they're in afternoon
  activities[0].startTime = '14:00';
  activities[0].endTime = '16:00';
  activities[1].startTime = '17:00';
  activities[1].endTime = '18:00';

  const result = enforceRequiredMealsFinalGuard(
    activities, ['breakfast', 'lunch', 'dinner'], 2, 'Paris', 'USD', 'full_exploration'
  );

  // Verify chronological order
  for (let i = 1; i < result.activities.length; i++) {
    const prevTime = result.activities[i - 1].startTime;
    const currTime = result.activities[i].startTime;
    const prevMins = parseInt(prevTime.split(':')[0]) * 60 + parseInt(prevTime.split(':')[1]);
    const currMins = parseInt(currTime.split(':')[0]) * 60 + parseInt(currTime.split(':')[1]);
    assertEquals(currMins >= prevMins, true, `Activities not sorted: ${prevTime} should come before ${currTime}`);
  }
});

Deno.test('enforceRequiredMealsFinalGuard handles empty required meals', () => {
  const activities = buildDay(['Museum Visit']).activities;
  const result = enforceRequiredMealsFinalGuard(
    activities, [], 1, 'Paris', 'USD', 'late_arrival'
  );

  assertEquals(result.alreadyCompliant, true);
  assertEquals(result.injectedMeals.length, 0);
  assertEquals(result.activities.length, 1);
});

// =============================================================================
// REGRESSION: Duplicate strip then guard restores compliance
// =============================================================================

Deno.test('duplicate strip + meal guard restores meal compliance', () => {
  // Simulate: a day passes validation but dedup removes a dining activity
  const day: StrictDayMinimal = {
    dayNumber: 2,
    date: '2026-06-02',
    title: 'Test',
    activities: [
      {
        id: 'b1', title: 'Breakfast at Hotel Café', startTime: '08:00', endTime: '09:00',
        category: 'dining', location: { name: 'Hotel Café', address: '1 Hotel' },
        cost: { amount: 10, currency: 'USD' }, description: '', tags: [],
        bookingRequired: false, transportation: { method: 'walk', duration: '5 min', estimatedCost: { amount: 0, currency: 'USD' }, instructions: '' },
      },
      {
        id: 'b2', title: 'Lunch at Trattoria', startTime: '12:00', endTime: '13:00',
        category: 'dining', location: { name: 'Trattoria', address: '2 Via' },
        cost: { amount: 20, currency: 'USD' }, description: '', tags: [],
        bookingRequired: false, transportation: { method: 'walk', duration: '10 min', estimatedCost: { amount: 0, currency: 'USD' }, instructions: '' },
      },
      {
        id: 'b3', title: 'Dinner at Ristorante', startTime: '19:00', endTime: '20:30',
        category: 'dining', location: { name: 'Ristorante', address: '3 Piazza' },
        cost: { amount: 35, currency: 'USD' }, description: '', tags: [],
        bookingRequired: false, transportation: { method: 'walk', duration: '5 min', estimatedCost: { amount: 0, currency: 'USD' }, instructions: '' },
      },
    ],
  };

  // Simulate removing dinner (as if trip-wide duplicate strip removed it)
  const afterStrip = day.activities.filter(a => a.id !== 'b3');

  // Run guard
  const result = enforceRequiredMealsFinalGuard(
    afterStrip, ['breakfast', 'lunch', 'dinner'], 2, 'Rome', 'USD', 'full_exploration'
  );

  assertEquals(result.alreadyCompliant, false);
  assertEquals(result.injectedMeals, ['dinner']);
  
  // Verify final output has all 3 meals
  const finalMeals = detectMealSlots(result.activities);
  assertEquals(finalMeals.includes('breakfast'), true);
  assertEquals(finalMeals.includes('lunch'), true);
  assertEquals(finalMeals.includes('dinner'), true);
});

Deno.test('arrival day: guard only requires policy-specified meals', () => {
  const policy = deriveMealPolicy({
    dayNumber: 1, totalDays: 4, isFirstDay: true, isLastDay: false,
    arrivalTime24: '18:00',
  });

  // Late arrival — only dinner required
  assertEquals(policy.requiredMeals, ['dinner']);

  const activities = buildDay(['Hotel Check-in', 'Evening Walk']).activities;
  const result = enforceRequiredMealsFinalGuard(
    activities, policy.requiredMeals, 1, 'Paris', 'USD', policy.dayMode
  );

  assertEquals(result.injectedMeals, ['dinner']);
  // Should NOT inject breakfast or lunch
  assertEquals(result.injectedMeals.includes('breakfast'), false);
  assertEquals(result.injectedMeals.includes('lunch'), false);
});
