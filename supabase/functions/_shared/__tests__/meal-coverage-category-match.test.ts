/**
 * Issue #4/#3 — "Partial badge + Some meals couldn't be scheduled" on trips
 * that actually have every meal.
 *
 * Root cause: the integrity GATE used EXACT category matching
 * (`['dining',...].includes(cat)`) while the meal GUARD used SUBSTRING matching
 * (`cat.includes('dining')`). A real restaurant tagged `fine_dining` /
 * `casual_dining` / `street_food` with a neutral title satisfied the guard (so
 * no meal was injected) but failed the gate → false MEAL_COVERAGE_MISSING.
 *
 * Both now share `_shared/meal-detection.ts`. These tests lock the invariant:
 * the gate recognizes exactly what the guard injects against.
 */
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { checkItineraryIntegrity } from '../itinerary-integrity-contract.ts';
import { detectMealSlots } from '../meal-detection.ts';

const allMealsReqd = { requiredMealsByDay: { 1: ['breakfast', 'lunch', 'dinner'] as const } };

Deno.test('real venues tagged fine_dining/casual_dining (neutral titles) satisfy meal coverage', () => {
  const days = [
    {
      dayNumber: 1,
      activities: [
        { id: 'b', title: 'Maison Pic', category: 'fine_dining', startTime: '08:30', endTime: '09:30' },
        { id: 'l', title: 'Roscioli', category: 'casual_dining', startTime: '13:00', endTime: '14:30' },
        { id: 'd', title: 'Den', category: 'seafood_restaurant', startTime: '19:30', endTime: '21:00' },
      ],
    },
  ];

  // Detector sees all three meals despite rich category tags + neutral titles.
  assertEquals(detectMealSlots(days[0].activities).sort(), ['breakfast', 'dinner', 'lunch']);

  const verdict = checkItineraryIntegrity(days, allMealsReqd as any);
  assertEquals(
    verdict.codes.includes('MEAL_COVERAGE_MISSING'),
    false,
    'must NOT flag missing meals when all three are present as richly-tagged venues',
  );
});

Deno.test('a genuinely missing lunch still flags MEAL_COVERAGE_MISSING', () => {
  const days = [
    {
      dayNumber: 1,
      activities: [
        { id: 'b', title: 'Breakfast at hotel', category: 'dining', startTime: '08:30', endTime: '09:30' },
        // no lunch
        { id: 'd', title: 'Dinner', category: 'dining', startTime: '19:30', endTime: '21:00' },
      ],
    },
  ];

  assertEquals(detectMealSlots(days[0].activities).sort(), ['breakfast', 'dinner']);

  const verdict = checkItineraryIntegrity(days, allMealsReqd as any);
  assert(
    verdict.codes.includes('MEAL_COVERAGE_MISSING'),
    'must flag when lunch is genuinely absent',
  );
  const cov = verdict.mealCoverage.find((c) => c.dayNumber === 1);
  assertEquals(cov?.missing, ['lunch']);
});

Deno.test('drinks-only venue at dinner time does NOT satisfy dinner (gate + guard agree)', () => {
  const days = [
    {
      dayNumber: 1,
      activities: [
        { id: 'b', title: 'Brunch spot', category: 'cafe', startTime: '09:00', endTime: '10:00' },
        { id: 'l', title: 'Trattoria', category: 'restaurant', startTime: '12:30', endTime: '13:30' },
        { id: 'd', title: 'Rooftop cocktail bar', category: 'bar', startTime: '20:00', endTime: '22:00' },
      ],
    },
  ];

  // Guard's detector rejects the cocktail bar as dinner...
  assertEquals(detectMealSlots(days[0].activities).includes('dinner'), false);
  // ...and so does the gate (they share the detector).
  const verdict = checkItineraryIntegrity(days, allMealsReqd as any);
  const cov = verdict.mealCoverage.find((c) => c.dayNumber === 1);
  assertEquals(cov?.missing, ['dinner']);
});
