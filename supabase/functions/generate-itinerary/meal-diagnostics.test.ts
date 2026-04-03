import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { detectMealSlots, enforceRequiredMealsFinalGuard } from "./day-validation.ts";

/**
 * Regression test: meal-guard diagnostics must correctly report
 * beforeGuard vs afterGuard states so logs aren't contradictory.
 */

function makeActivity(title: string, category: string, startTime: string) {
  return { title, category, startTime, endTime: '' };
}

Deno.test('missing lunch: beforeGuard=[breakfast,dinner], afterGuard=[breakfast,lunch,dinner], injected=[lunch]', () => {
  const activities = [
    makeActivity('Breakfast at Café Luna', 'dining', '08:00'),
    makeActivity('Visit Museum', 'activity', '10:00'),
    makeActivity('Walk in Park', 'activity', '14:00'),
    makeActivity('Dinner at Trattoria', 'dining', '19:00'),
  ];

  // Before guard
  const beforeGuard = detectMealSlots(activities);
  assertEquals(beforeGuard, ['breakfast', 'dinner'], 'Before guard should detect only breakfast and dinner');

  // Run guard
  const result = enforceRequiredMealsFinalGuard(
    activities,
    ['breakfast', 'lunch', 'dinner'],
    2,
    'Rome',
    'USD',
    'full',
    [],
  );

  assertEquals(result.alreadyCompliant, false, 'Guard should fire for missing lunch');
  assertEquals(result.injectedMeals, ['lunch'], 'Guard should inject lunch');

  // After guard
  const afterGuard = detectMealSlots(result.activities);
  assertEquals(afterGuard.includes('breakfast'), true, 'After guard should have breakfast');
  assertEquals(afterGuard.includes('lunch'), true, 'After guard should have lunch');
  assertEquals(afterGuard.includes('dinner'), true, 'After guard should have dinner');
});

Deno.test('no raw dining category leaks into meal slots', () => {
  const activities = [
    makeActivity('Breakfast at Hotel', 'dining', '08:00'),
    makeActivity('Local Food Tour', 'dining', '13:00'),
    makeActivity('Dinner at Steakhouse', 'dining', '19:00'),
  ];

  const detected = detectMealSlots(activities);
  // Should only contain canonical meal names, never raw categories like 'dining'
  for (const meal of detected) {
    assertEquals(
      ['breakfast', 'lunch', 'dinner'].includes(meal),
      true,
      `Detected meal "${meal}" should be a canonical slot, not a raw category`,
    );
  }
});
