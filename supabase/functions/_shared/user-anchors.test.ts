/**
 * Regression tests for the canonical user-anchors builder.
 * Run with: deno test supabase/functions/_shared/user-anchors.test.ts
 */
import { assertEquals, assert } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { buildUserAnchors, parseDayActivities } from './user-anchors.ts';

Deno.test('parseDayActivities extracts time + title from "7:30 PM - Dinner at TRB Hutong"', () => {
  const out = parseDayActivities(2, '7:30 PM - Dinner at TRB Hutong');
  assertEquals(out.length, 1);
  assertEquals(out[0].dayNumber, 2);
  assertEquals(out[0].startTime, '19:30');
  assert(out[0].title.toLowerCase().includes('trb hutong'));
  assertEquals(out[0].category, 'dining');
  assertEquals(out[0].venueName, 'TRB Hutong');
});

Deno.test('parseDayActivities handles vague periods (Morning - Panda visit)', () => {
  const out = parseDayActivities(1, 'Morning - Panda visit');
  assertEquals(out.length, 1);
  assertEquals(out[0].startTime, '08:00');
  assert(out[0].title.toLowerCase().includes('panda'));
});

Deno.test('buildUserAnchors deduplicates between perDayActivities and mustDoActivities', () => {
  const anchors = buildUserAnchors({
    source: 'chat',
    perDayActivities: [{ dayNumber: 2, activities: '7:30 PM - Dinner at TRB Hutong' }],
    mustDoActivities: 'Day 2: 7:30 PM - Dinner at TRB Hutong',
  });
  assertEquals(anchors.length, 1, 'should dedupe identical day+time+title');
});

Deno.test('buildUserAnchors keeps distinct entries across days', () => {
  const anchors = buildUserAnchors({
    source: 'chat',
    perDayActivities: [
      { dayNumber: 1, activities: 'Morning - Panda visit' },
      { dayNumber: 2, activities: '7:30 PM - Dinner at TRB Hutong' },
    ],
  });
  assertEquals(anchors.length, 2);
  assertEquals(anchors[0].dayNumber, 1);
  assertEquals(anchors[1].dayNumber, 2);
});

Deno.test('buildUserAnchors skips TBD/placeholder entries', () => {
  const anchors = buildUserAnchors({
    source: 'manual_paste',
    perDayActivities: [{ dayNumber: 1, activities: 'TBD - choose a museum' }],
  });
  assertEquals(anchors.length, 0);
});

Deno.test('parseDayActivities preserves lockedSource as raw input for matching', () => {
  const out = parseDayActivities(3, '9:00 AM - Forbidden City tour');
  assertEquals(out[0].lockedSource, '9:00 AM - Forbidden City tour');
});
