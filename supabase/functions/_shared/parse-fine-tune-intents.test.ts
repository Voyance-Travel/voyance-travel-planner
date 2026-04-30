import { assertEquals, assert } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { parseFineTuneIntoDailyIntents } from './parse-fine-tune-intents.ts';

Deno.test('parseFineTune: Day N markers', () => {
  const r = parseFineTuneIntoDailyIntents({
    notes: 'Day 1: dinner at JNcQUOI Table\nDay 3: I want spa at 3:30 PM',
    tripStartDate: '2026-04-17',
    totalDays: 10,
  });
  assertEquals(r.perDay.length, 2);
  assertEquals(r.perDay[0].dayNumber, 1);
  assertEquals(r.perDay[0].kind, 'dinner');
  assertEquals(r.perDay[1].dayNumber, 3);
  assertEquals(r.perDay[1].kind, 'spa');
  assertEquals(r.perDay[1].startTime, '15:30');
  assertEquals(r.perDay[1].priority, 'must');
});

Deno.test('parseFineTune: Month + day markers', () => {
  const r = parseFineTuneIntoDailyIntents({
    notes: 'April 19 — go to Belém Tower\nApril 20: dinner at SEEN',
    tripStartDate: '2026-04-17',
    totalDays: 10,
  });
  assertEquals(r.perDay.length, 2);
  assertEquals(r.perDay[0].dayNumber, 3); // April 19 = day 3
  assertEquals(r.perDay[1].dayNumber, 4);
  assertEquals(r.perDay[1].kind, 'dinner');
});

Deno.test('parseFineTune: relative markers and trip-wide notes', () => {
  const r = parseFineTuneIntoDailyIntents({
    notes: 'First night: dinner casual.\nLast night: somewhere fancy.\nWe are vegetarian.',
    tripStartDate: '2026-04-17',
    totalDays: 5,
  });
  assertEquals(r.perDay[0].dayNumber, 1);
  assertEquals(r.perDay[1].dayNumber, 5);
  assert(r.tripWide.length >= 1);
  assert(r.tripWide.join(' ').toLowerCase().includes('vegetarian'));
});

Deno.test('parseFineTune: must vs should priority', () => {
  const r = parseFineTuneIntoDailyIntents({
    notes: 'Day 1: I really need to see the cathedral\nDay 2: maybe a wine bar',
    tripStartDate: '2026-04-17',
    totalDays: 5,
  });
  assertEquals(r.perDay[0].priority, 'must');
  assertEquals(r.perDay[1].priority, 'should');
});

Deno.test('parseFineTune: empty input', () => {
  const r = parseFineTuneIntoDailyIntents({ notes: '', tripStartDate: '2026-04-17', totalDays: 5 });
  assertEquals(r.perDay.length, 0);
  assertEquals(r.tripWide.length, 0);
});

Deno.test('parseFineTune: avoid kind', () => {
  const r = parseFineTuneIntoDailyIntents({
    notes: 'Day 3: avoid seafood at all costs',
    tripStartDate: '2026-04-17',
    totalDays: 5,
  });
  assertEquals(r.perDay[0].kind, 'avoid');
});

Deno.test('parseFineTune: ambiguous DOW (multiple matches) goes to tripWide', () => {
  // Trip is 14 days starting Friday — so 2 Fridays.
  const r = parseFineTuneIntoDailyIntents({
    notes: 'Friday: dinner reservations',
    tripStartDate: '2026-04-17', // Friday
    totalDays: 14,
  });
  // Ambiguous → falls through to tripWide
  assertEquals(r.perDay.length, 0);
  assertEquals(r.tripWide.length, 1);
});

Deno.test('parseFineTune: unique DOW resolves correctly', () => {
  const r = parseFineTuneIntoDailyIntents({
    notes: 'Sunday: spa day',
    tripStartDate: '2026-04-17', // Friday
    totalDays: 5, // Fri Sat Sun Mon Tue → Sunday is day 3
  });
  assertEquals(r.perDay.length, 1);
  assertEquals(r.perDay[0].dayNumber, 3);
});
