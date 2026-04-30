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

// ---------- Regression: chat-trip-planner emits "<Title> Day N <TIME>" format ----------
// Bug: parseMustDoEntry only matched "Day N:" at the START of the string, so every
// chat-extracted anchor like "Dinner Peixola Day 2 7:30 PM" got dayNumber=0 and was
// then silently dropped by applyAnchorsWin's range guard. Result: AI overwrote every
// locked dinner except for one Day-1 collision. These tests pin the fix.

Deno.test('buildUserAnchors handles "Title Day N TIME" mid-string format (chat-trip-planner real output)', () => {
  const anchors = buildUserAnchors({
    source: 'chat',
    mustDoActivities: [
      'Dinner JNcQUOI Table Day 1 7:00 PM',
      'Lunch Belcanto Day 2 1:30 PM',
      'Dinner Peixola Day 2 7:30 PM',
      'Cervejaria Ramiro Day 7 1:00 PM',
    ],
  });
  assertEquals(anchors.length, 4);
  assertEquals(anchors[0].dayNumber, 1);
  assertEquals(anchors[0].startTime, '19:00');
  assert(anchors[0].title.toLowerCase().includes('jncquoi'));
  assertEquals(anchors[1].dayNumber, 2);
  assertEquals(anchors[1].startTime, '13:30');
  assertEquals(anchors[2].dayNumber, 2);
  assertEquals(anchors[2].startTime, '19:30');
  assertEquals(anchors[3].dayNumber, 7);
  assertEquals(anchors[3].startTime, '13:00');
});

Deno.test('buildUserAnchors still supports legacy "Day N: foo" prefix format', () => {
  const anchors = buildUserAnchors({
    source: 'chat',
    mustDoActivities: ['Day 3: 9:00 AM - Forbidden City tour'],
  });
  assertEquals(anchors.length, 1);
  assertEquals(anchors[0].dayNumber, 3);
  assertEquals(anchors[0].startTime, '09:00');
  assert(anchors[0].title.toLowerCase().includes('forbidden city'));
});

Deno.test('buildUserAnchors strips "Day N" token from title text', () => {
  const anchors = buildUserAnchors({
    source: 'chat',
    mustDoActivities: ['Spa Serenity Spa Lisbon Day 2 3:30 PM'],
  });
  assertEquals(anchors.length, 1);
  assertEquals(anchors[0].dayNumber, 2);
  // "Day 2" should not appear inside the title — it's a metadata token, not content
  assert(!/\bDay\s+\d+\b/i.test(anchors[0].title), `title should not contain Day N: ${anchors[0].title}`);
  assert(anchors[0].title.toLowerCase().includes('serenity spa'));
});
