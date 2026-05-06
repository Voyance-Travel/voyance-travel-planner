import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { enforceTimingAndBuffers, parseTime } from './timing-cascade.ts';

Deno.test('same-start: pushes the next activity past the first', () => {
  const acts = [
    { id: 'a', title: 'A', startTime: '10:00', endTime: '11:00', durationMinutes: 60 },
    { id: 'b', title: 'B', startTime: '10:00', endTime: '11:30', durationMinutes: 90 },
  ];
  const { activities, repairs } = enforceTimingAndBuffers(acts);
  assert(repairs.some(r => r.type === 'same_start_fix'), 'should record a same_start_fix');
  // B should now start no earlier than A.end + 5 = 11:05
  assertEquals(parseTime(activities[1].startTime)! >= 11 * 60 + 5, true);
});

Deno.test('overlap: shifts only the later card forward', () => {
  const acts = [
    { id: 'a', title: 'A', startTime: '10:00', endTime: '11:30', durationMinutes: 90 },
    { id: 'b', title: 'B', startTime: '11:00', endTime: '12:00', durationMinutes: 60 },
  ];
  const { activities, repairs } = enforceTimingAndBuffers(acts);
  assert(repairs.some(r => r.type === 'overlap_fix'));
  // A unchanged
  assertEquals(activities[0].startTime, '10:00');
  assertEquals(activities[0].endTime, '11:30');
  // B now starts at A.end + 5 = 11:35
  assertEquals(activities[1].startTime, '11:35');
});

Deno.test('insufficient buffer: distinct coordinates with no gap get pushed', () => {
  // Vatican (~41.902, 12.453) → Trastevere (~41.890, 12.467) is ~1.7km, ~22min walk.
  const acts = [
    {
      id: 'vatican',
      title: 'Vatican Museums',
      category: 'culture',
      startTime: '10:00',
      endTime: '11:00',
      location: { lat: 41.902, lng: 12.453 },
    },
    {
      id: 'trastevere-lunch',
      title: 'Trastevere Lunch',
      category: 'dining',
      startTime: '11:00',
      endTime: '12:30',
      location: { lat: 41.890, lng: 12.467 },
    },
  ];
  const { activities, repairs } = enforceTimingAndBuffers(acts);
  assert(repairs.some(r => r.type === 'buffer_fix'), 'should add a buffer_fix repair');
  // Lunch must now start at least 15 min after museum ends.
  assert(parseTime(activities[1].startTime)! >= 11 * 60 + 15);
});

Deno.test('locked card cannot be moved', () => {
  const acts = [
    { id: 'a', title: 'A', startTime: '10:00', endTime: '11:30' },
    { id: 'b', title: 'Locked dinner', startTime: '11:00', endTime: '12:30' },
  ];
  const lockedIds = new Set(['b']);
  const { activities } = enforceTimingAndBuffers(acts, { lockedIds });
  // B unchanged because locked
  assertEquals(activities[1].startTime, '11:00');
});

Deno.test('past-midnight cards are dropped', () => {
  const acts = [
    { id: 'a', title: 'A', startTime: '23:00', endTime: '23:50' },
    { id: 'b', title: 'B', startTime: '23:45', endTime: '24:30' },
  ];
  const { activities, droppedIds, repairs } = enforceTimingAndBuffers(acts);
  // B got pushed past 23:30 cutoff and dropped
  assert(droppedIds.includes('b') || activities.length === 1);
  assert(repairs.some(r => r.type === 'dropped_past_midnight'));
});
