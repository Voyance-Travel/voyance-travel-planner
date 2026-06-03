/**
 * Food halls / gourmet markets are eating venues even when the model tags them
 * as an "activity". Confirmed on the Lisbon QA trip: "Social Hour at Time Out
 * Market" at 19:25 (category=activity) was a food hall where the traveler eats
 * dinner, but the meal gate counted it as a missing dinner → false Partial.
 */
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { classifyMealSlot, detectMealSlots } from '../meal-detection.ts';

Deno.test('Time Out Market at dinner time counts as dinner even when tagged activity', () => {
  const card = { title: 'Social Hour at Time Out Market', category: 'activity', startTime: '19:25', endTime: '20:40' };
  assertEquals(classifyMealSlot(card), 'dinner');
});

Deno.test('a food hall at lunchtime counts as lunch', () => {
  const card = { title: 'Lunch grazing at Mercado da Ribeira', category: 'activity', startTime: '13:00' };
  assertEquals(classifyMealSlot(card), 'lunch');
});

Deno.test('generic gourmet food hall (neutral title) credits the slot', () => {
  assertEquals(classifyMealSlot({ title: 'Eataly', category: 'experience', startTime: '12:30' }), 'lunch');
});

Deno.test('a sightseeing market VISIT is NOT a meal', () => {
  assertEquals(classifyMealSlot({ title: 'Visit the Flower Market', category: 'activity', startTime: '13:00' }), null);
  assertEquals(classifyMealSlot({ title: 'Christmas Market stroll', category: 'activity', startTime: '18:30' }), null);
});

Deno.test('day with breakfast + lunch + a Time Out Market dinner has full coverage', () => {
  const acts = [
    { title: 'Breakfast at Heim Café', category: 'dining', startTime: '09:00' },
    { title: 'Lunch at A Cevicheria', category: 'dining', startTime: '13:00' },
    { title: 'Social Hour at Time Out Market', category: 'activity', startTime: '19:25' },
  ];
  assertEquals(detectMealSlots(acts).sort(), ['breakfast', 'dinner', 'lunch']);
});
