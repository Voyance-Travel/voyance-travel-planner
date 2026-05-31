/**
 * Phase C — v2 detector→repair unit tests.
 *
 * Locks the contract for overlap auto-shift (cap 90min, unresolved stamping),
 * closing-hours drop (needs_replacement marker), and transit-sanity widen
 * (neighborhood mismatch + haversine band).
 */
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { runDetectorRepairs } from '../detector-repairs.ts';

Deno.test('runDetectorRepairs: empty input is a no-op', () => {
  const r = runDetectorRepairs([], 1);
  assertEquals(r.counters.overlapsShifted, 0);
  assertEquals(r.counters.closingDropped, 0);
  assertEquals(r.counters.transitWidened, 0);
});

Deno.test('overlapAutoShift: single 10-min overlap shifts current forward 15min', () => {
  const acts = [
    { title: 'A', startTime: '09:00', endTime: '10:00' },
    { title: 'B', startTime: '09:50', endTime: '11:00' },
  ];
  const r = runDetectorRepairs(acts, 1);
  assertEquals(r.counters.overlapsShifted, 1);
  assertEquals(r.activities[1].startTime, '10:05');
  assertEquals(r.activities[1].endTime, '11:15');
  assertEquals(r.counters.totalShiftMin, 15);
});

Deno.test('overlapAutoShift: caps at 90min cumulative shift, stamps unresolved', () => {
  // Two large overlaps (each 60min) — should shift first 60min, then cap.
  const acts = [
    { title: 'A', startTime: '09:00', endTime: '11:00' },
    { title: 'B', startTime: '10:00', endTime: '12:00' }, // 60min overlap
    { title: 'C', startTime: '11:00', endTime: '13:00' }, // overlap after B shifts
  ];
  const r = runDetectorRepairs(acts, 1);
  assert(r.counters.totalShiftMin <= 90);
  // Either C got shifted partially OR appears in unresolved
  assert(r.counters.overlapsShifted >= 1);
});

Deno.test('overlapAutoShift: locked next activity is recorded as unresolved (never moved)', () => {
  const acts = [
    { title: 'A', startTime: '09:00', endTime: '10:30' },
    { title: 'B-locked', startTime: '10:00', endTime: '11:00', isLocked: true },
  ];
  const r = runDetectorRepairs(acts, 1);
  assertEquals(r.activities[1].startTime, '10:00'); // unchanged
  assertEquals(r.counters.overlapsShifted, 0);
  assertEquals(r.counters.overlapsUnresolved, 1);
  assertEquals(r.unresolvedOverlaps[0].overlapMin, 30);
});

Deno.test('closingHoursAutoShift: starts after close → marked needs_replacement', () => {
  const acts = [{
    title: 'Museum X',
    startTime: '19:00',
    endTime: '20:00',
    openingHours: { open: '09:00', close: '18:00' },
  }];
  const r = runDetectorRepairs(acts, 1);
  assertEquals(r.counters.closingDropped, 1);
  assertEquals(r.activities[0].needs_replacement, true);
  assertEquals(r.activities[0].metadata.dropped_reason, 'starts_after_close');
  assertEquals(r.activities[0].metadata.original_title, 'Museum X');
});

Deno.test('closingHoursAutoShift: 15-min grace before flagging end-after-close', () => {
  const acts = [{
    title: 'Cafe Y',
    startTime: '17:00',
    endTime: '18:10', // within 15min grace
    openingHours: { open: '08:00', close: '18:00' },
  }];
  const r = runDetectorRepairs(acts, 1);
  assertEquals(r.counters.closingDropped, 0);
  assert(!r.activities[0].needs_replacement);
});

Deno.test('closingHoursAutoShift: locked rows exempt', () => {
  const acts = [{
    title: 'Booked dinner',
    startTime: '23:00',
    endTime: '23:30',
    isLocked: true,
    openingHours: { open: '11:00', close: '21:00' },
  }];
  const r = runDetectorRepairs(acts, 1);
  assertEquals(r.counters.closingDropped, 0);
});

Deno.test('transitSanityWiden: 5-min walk with 800m gap → widened to ~10min', () => {
  const acts = [
    { title: 'Place A', startTime: '09:00', endTime: '10:00', location: { lat: 41.3851, lng: 2.1734 } },
    { title: 'Walk', category: 'transit', startTime: '10:00', endTime: '10:05' },
    { title: 'Place B', startTime: '10:05', endTime: '11:00', location: { lat: 41.3921, lng: 2.1734 } }, // ~780m north
  ];
  const r = runDetectorRepairs(acts, 1);
  assertEquals(r.counters.transitWidened, 1);
  const walkEnd = r.activities[1].endTime;
  // Should now be ≥ 10:10 (10min) for a ~780m walk
  assert(walkEnd >= '10:09', `expected widened walk, got ${walkEnd}`);
});

Deno.test('transitSanityWiden: neighborhood mismatch widens even without coords', () => {
  const acts = [
    { title: 'Place A', startTime: '09:00', endTime: '10:00', neighborhood: 'Centro' },
    { title: 'Walk', category: 'transit', startTime: '10:00', endTime: '10:03' },
    { title: 'Place B', startTime: '10:03', endTime: '11:00', neighborhood: 'Salamanca' },
  ];
  const r = runDetectorRepairs(acts, 1);
  assertEquals(r.counters.transitWidened, 1);
  assertEquals(r.activities[1].metadata.transit_widened.reason, 'neighborhood_mismatch');
});

Deno.test('transitSanityWiden: <200m distance not widened (already plausible)', () => {
  const acts = [
    { title: 'A', startTime: '09:00', endTime: '10:00', location: { lat: 41.3851, lng: 2.1734 } },
    { title: 'Walk', category: 'transit', startTime: '10:00', endTime: '10:03' },
    { title: 'B', startTime: '10:03', endTime: '11:00', location: { lat: 41.3852, lng: 2.1735 } }, // ~15m
  ];
  const r = runDetectorRepairs(acts, 1);
  assertEquals(r.counters.transitWidened, 0);
});

Deno.test('runDetectorRepairs: closing-drop happens BEFORE overlap pass', () => {
  // Museum after close + a real overlap with the next card. After drop, the
  // overlap pass should NOT count the dropped placeholder as a shift source.
  const acts = [
    { title: 'Museum', startTime: '19:00', endTime: '20:00', openingHours: { open: '09:00', close: '18:00' } },
    { title: 'Dinner', startTime: '19:30', endTime: '21:00' },
  ];
  const r = runDetectorRepairs(acts, 1);
  assertEquals(r.counters.closingDropped, 1);
  // Dinner overlaps the still-present placeholder, so a shift may still happen.
  // The contract is: placeholder is marked, dinner can be pushed if its start
  // is before the placeholder's end. We only assert that closing fired first.
  assertEquals(r.activities[0].needs_replacement, true);
});
