/**
 * Regression: chat-planner perDayActivities/mustDoActivities entries without
 * a time AND without a named venue must come out as soft `should`/unlocked.
 *
 * See mem://constraints/itinerary/soft-vs-hard-user-intent.
 */
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { intentsFromChatPlannerExtraction } from './intent-normalizers.ts';

Deno.test('chat-planner perDayActivities: "Sushi Lunch" → should, unlocked', () => {
  const [intent] = intentsFromChatPlannerExtraction({
    perDayActivities: [{ dayNumber: 2, activities: 'Sushi Lunch' }],
  });
  assertEquals(intent.priority, 'should');
  assertEquals(intent.locked, false);
});

Deno.test('chat-planner perDayActivities: "7:30 PM Dinner at Roscioli" → must, locked', () => {
  const [intent] = intentsFromChatPlannerExtraction({
    perDayActivities: [{ dayNumber: 2, activities: '7:30 PM Dinner at Roscioli' }],
  });
  assertEquals(intent.priority, 'must');
  assertEquals(intent.locked, true);
});

Deno.test('chat-planner mustDoActivities fallback: "spa" → should, unlocked', () => {
  const [intent] = intentsFromChatPlannerExtraction({
    mustDoActivities: 'spa',
  });
  assertEquals(intent.priority, 'should');
  assertEquals(intent.locked, false);
});

Deno.test('chat-planner mustDoActivities fallback: "Sukiyabashi Jiro" → must (named venue)', () => {
  const [intent] = intentsFromChatPlannerExtraction({
    mustDoActivities: 'Sukiyabashi Jiro',
  });
  assertEquals(intent.priority, 'must');
});
