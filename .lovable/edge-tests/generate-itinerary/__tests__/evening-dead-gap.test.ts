/**
 * Bug 4 — evening dead-gap reporter tests.
 * Window-parameterized fill-dead-gaps: 18:00–22:00 evening pass.
 */
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  reportRemainingAfternoonDeadGap,
  reportRemainingEveningDeadGap,
} from '../pipeline/fill-dead-gaps.ts';

Deno.test('Bug 4 — 18:42 dinner-end → 22:48 hotel-return reports evening gap ≥180m', () => {
  const acts = [
    { id: 'a', title: 'Dinner', startTime: '17:00', endTime: '18:42' },
    { id: 'b', title: 'Return to Hotel', startTime: '22:48', endTime: '23:30' },
  ];
  const remaining = reportRemainingEveningDeadGap(acts, undefined, 1);
  // Overlap with 18:00–22:00 window: 18:42 → 22:00 = 198m
  assertEquals(remaining >= 180, true, `expected ≥180m, got ${remaining}`);
  assertEquals(remaining, 198);
});

Deno.test('Bug 4 — full evening covered → 0', () => {
  const acts = [
    { id: 'a', title: 'Cocktails', startTime: '18:00', endTime: '19:30' },
    { id: 'b', title: 'Dinner', startTime: '19:30', endTime: '22:00' },
  ];
  assertEquals(reportRemainingEveningDeadGap(acts, undefined, 2), 0);
});

Deno.test('Bug 4 — late-nightlife 21:30–23:30 with prior 19:00 dinner → 0', () => {
  const acts = [
    { id: 'a', title: 'Dinner', startTime: '19:00', endTime: '21:00' },
    { id: 'b', title: 'Speakeasy', startTime: '21:30', endTime: '23:30' },
  ];
  // 21:00 → 21:30 is only 30m overlap with evening — under MIN_USABLE_OVERLAP_MIN.
  assertEquals(reportRemainingEveningDeadGap(acts, undefined, 3), 0);
});

Deno.test('Bug 4 — 17:00 → 22:30 hole reports ≥240m for evening window', () => {
  const acts = [
    { id: 'a', title: 'Late Lunch', startTime: '15:00', endTime: '17:00' },
    { id: 'b', title: 'Hotel Return', startTime: '22:30', endTime: '23:00' },
  ];
  // Overlap clamped to 18:00–22:00 = 240m
  const remaining = reportRemainingEveningDeadGap(acts, undefined, 4);
  assertEquals(remaining, 240);
});

Deno.test('Bug 4 — legacy afternoon reporter signature unchanged', () => {
  const acts = [
    { id: 'a', title: 'Lunch', startTime: '12:00', endTime: '13:00' },
    { id: 'b', title: 'Hotel Return', startTime: '19:30', endTime: '20:00' },
  ];
  // 13:00 → 19:00 overlap = 360m
  const remaining = reportRemainingAfternoonDeadGap(acts);
  assertEquals(remaining, 360);
});
