import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { dayChronoKey, enforceTimingAndBuffers } from '../timing-cascade.ts';

Deno.test('dayChronoKey: late-AM bookend sorts after late-night nightcap', () => {
  const acts = [
    { startTime: '09:00' },
    { startTime: '23:30' },
    { startTime: '00:55' },
  ];
  const sorted = [...acts].sort((a, b) => dayChronoKey(a.startTime) - dayChronoKey(b.startTime));
  assertEquals(sorted.map((a) => a.startTime), ['09:00', '23:30', '00:55']);
});

Deno.test('dayChronoKey: untimed sorts to the end', () => {
  const acts = [
    { startTime: '' },
    { startTime: '10:00' },
    { startTime: undefined as unknown as string },
  ];
  const sorted = [...acts].sort((a, b) => dayChronoKey(a.startTime) - dayChronoKey(b.startTime));
  assertEquals(sorted[0].startTime, '10:00');
});

Deno.test('enforceTimingAndBuffers: late-nightlife bookend stays at the tail', () => {
  const day = [
    { id: 'a', title: 'Brunch', category: 'dining', startTime: '09:00', endTime: '10:30' },
    { id: 'b', title: 'Wine bar', category: 'dining', startTime: '18:00', endTime: '19:30' },
    { id: 'c', title: 'Nightcap at Quadri', category: 'nightlife', startTime: '23:00', endTime: '23:30' },
    {
      id: 'd',
      title: 'Return to Milan Marriott Hotel',
      category: 'accommodation',
      startTime: '00:55',
      endTime: '01:20',
      source: 'late_nightlife_bookend',
    },
  ];
  const { activities } = enforceTimingAndBuffers(day);
  assertEquals(activities.map((a) => a.id), ['a', 'b', 'c', 'd']);
  assertEquals(activities[3].startTime, '00:55');
  assertEquals(activities[3].endTime, '01:20');
});

Deno.test('enforceTimingAndBuffers: bookend at index 0 with raw 00:55 still moves to tail', () => {
  // Pre-existing bug: legacy save persisted the bookend at the head. The
  // wrap-aware sort must repair the order on the next pass.
  const day = [
    {
      id: 'd',
      title: 'Return to Hotel',
      category: 'accommodation',
      startTime: '00:55',
      endTime: '01:20',
      source: 'late_nightlife_bookend',
    },
    { id: 'a', title: 'Brunch', category: 'dining', startTime: '09:00', endTime: '10:30' },
    { id: 'c', title: 'Nightcap', category: 'nightlife', startTime: '23:00', endTime: '23:30' },
  ];
  const { activities } = enforceTimingAndBuffers(day);
  assert(activities[activities.length - 1].id === 'd');
});
