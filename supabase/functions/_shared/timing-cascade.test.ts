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

Deno.test('past-cutoff cards are clamped back, never dropped', () => {
  // Content-preservation: cards pushed past the 23:30 cutoff are clamped back
  // to 23:29 rather than deleted (users paid for these activities). droppedIds
  // is always empty now; the card stays visible with an overbooked warning.
  const acts = [
    { id: 'a', title: 'A', startTime: '23:00', endTime: '23:50' },
    { id: 'b', title: 'B', startTime: '23:45', endTime: '24:30' },
  ];
  const { activities, droppedIds } = enforceTimingAndBuffers(acts);
  // Nothing is dropped — both cards survive.
  assertEquals(droppedIds.length, 0);
  assertEquals(activities.length, 2);
  // B was pushed past the 23:30 cutoff, so it is clamped back to ≤ 23:29.
  const b = activities.find(x => x.id === 'b')!;
  assert(parseTime(b.startTime)! <= 23 * 60 + 29, `expected B clamped to ≤23:29, got ${b.startTime}`);
});

Deno.test('transit overlap: pulls "Transfer to Marriott" past Breakfast', () => {
  const acts = [
    { id: 'b', title: 'Breakfast', category: 'dining', startTime: '08:30', endTime: '09:15' },
    { id: 't', title: 'Transfer to Marriott', category: 'transport', startTime: '09:00', endTime: '09:45' },
  ];
  const { activities, repairs } = enforceTimingAndBuffers(acts);
  assert(repairs.length > 0, 'should record a repair');
  assert(parseTime(activities[1].startTime)! >= 9 * 60 + 15, 'transit must start at/after prev end');
});

Deno.test('transit overlap: pulls "Walk to Lunch 12:20" past Vatican ending 12:30', () => {
  const acts = [
    { id: 'v', title: 'Vatican Museums', category: 'culture', startTime: '09:30', endTime: '12:30' },
    { id: 'w', title: 'Walk to Lunch', category: 'transit', startTime: '12:20', endTime: '12:40' },
  ];
  const { activities, repairs } = enforceTimingAndBuffers(acts);
  assert(repairs.length > 0);
  assert(parseTime(activities[1].startTime)! >= 12 * 60 + 30);
});

