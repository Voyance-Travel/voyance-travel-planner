/**
 * Regression: pinned anchors that are vague wishes (no startTime, no venueName)
 * MUST NOT be restored as naked locked cards. They flow through the Day Brief
 * as USER WISHES instead. See mem://constraints/itinerary/soft-vs-hard-user-intent.
 */
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { applyAnchorsWin } from './anchor-guard.ts';

Deno.test('applyAnchorsWin drops pinned vague wish (no time, no venue)', () => {
  const days = [{ dayNumber: 1, activities: [{ title: 'Existing AI thing', startTime: '10:00' }] }];
  const anchors = [{ dayNumber: 1, title: 'sushi lunch' }];
  const { days: out, restored } = applyAnchorsWin(days, anchors);
  assertEquals(restored, 0);
  assertEquals(out[0].activities.length, 1);
});

Deno.test('applyAnchorsWin restores pinned anchor with venueName', () => {
  const days = [{ dayNumber: 1, activities: [] }];
  const anchors = [{ dayNumber: 1, title: 'Lunch at Sukiyabashi Jiro', venueName: 'Sukiyabashi Jiro' }];
  const { restored } = applyAnchorsWin(days, anchors);
  assertEquals(restored, 1);
});

Deno.test('applyAnchorsWin restores pinned anchor with startTime', () => {
  const days = [{ dayNumber: 1, activities: [] }];
  const anchors = [{ dayNumber: 1, title: 'Dinner reservation', startTime: '19:30' }];
  const { restored } = applyAnchorsWin(days, anchors);
  assertEquals(restored, 1);
});
