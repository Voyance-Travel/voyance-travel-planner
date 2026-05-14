/**
 * Cross-Day Bleed Guard regression tests.
 *
 * Locks down the Amsterdam Day-1-past-midnight → Day-2 cascade fix.
 * See mem://constraints/itinerary/day1-past-midnight-no-day2-cascade.
 */
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { assertNoCrossDayBleed } from '../cross-day-bleed-guard.ts';

Deno.test('cross-day bleed guard: nightcap with late_nightlife_bookend stays on Day 1', () => {
  const days = [
    {
      dayNumber: 1,
      activities: [
        { id: 'a', title: 'Dinner', startTime: '20:00', endTime: '21:30' },
        { id: 'b', title: 'Nightcap', startTime: '22:00', endTime: '23:30' },
        {
          id: 'c',
          title: 'Return to Hotel',
          startTime: '23:50',
          endTime: '00:25',
          source: 'late_nightlife_bookend',
        },
      ],
    },
    {
      dayNumber: 2,
      activities: [
        { id: 'd', title: 'Coffee', startTime: '09:00', endTime: '10:00' },
      ],
    },
  ];
  const out = assertNoCrossDayBleed(days);
  assertEquals(out.changed, false);
  assertEquals(out.movedCount, 0);
  assertEquals(out.days[1].activities.length, 1);
});

Deno.test('cross-day bleed guard: untagged Moco Museum @ 01:33 moves to Day 1 tail', () => {
  const days = [
    {
      dayNumber: 1,
      activities: [
        { id: 'a', title: 'Dinner', startTime: '20:00', endTime: '21:30' },
        { id: 'b', title: 'Nightcap', startTime: '22:00', endTime: '23:30' },
      ],
    },
    {
      dayNumber: 2,
      activities: [
        // Untagged real LLM-emitted activity — the exact Amsterdam pattern.
        { id: 'museum', title: 'Moco Museum', startTime: '01:33', endTime: '02:30' },
        { id: 'walk', title: 'Walk to canal', startTime: '03:26', endTime: '04:00' },
        { id: 'morning', title: 'Brunch', startTime: '11:00', endTime: '12:30' },
      ],
    },
  ];
  const out = assertNoCrossDayBleed(days);
  assertEquals(out.changed, true);
  assertEquals(out.movedCount, 2);
  assertEquals(out.days[0].activities.length, 4);
  assertEquals(out.days[0].activities[2].id, 'museum');
  assertEquals(out.days[0].activities[2].dayNumber, 1);
  assertEquals(out.days[0].activities[3].id, 'walk');
  assertEquals(out.days[1].activities.length, 1);
  assertEquals(out.days[1].activities[0].id, 'morning');
});

Deno.test('cross-day bleed guard: late_nightlife_bookend at Day 2 head is NOT moved (parser drops it)', () => {
  const days = [
    {
      dayNumber: 1,
      activities: [
        { id: 'a', title: 'Nightcap', startTime: '22:00', endTime: '23:30' },
      ],
    },
    {
      dayNumber: 2,
      activities: [
        {
          id: 'stale-bookend',
          title: 'Return to Hotel',
          startTime: '00:25',
          source: 'late_nightlife_bookend',
        },
        { id: 'morning', title: 'Brunch', startTime: '11:00' },
      ],
    },
  ];
  const out = assertNoCrossDayBleed(days);
  assertEquals(out.changed, false);
  assertEquals(out.days[1].activities.length, 2);
});

Deno.test('cross-day bleed guard: locked manual entry at Day 2 head is exempt', () => {
  const days = [
    {
      dayNumber: 1,
      activities: [{ title: 'Nightcap', startTime: '22:00', endTime: '23:30' }],
    },
    {
      dayNumber: 2,
      activities: [
        { id: 'manual', title: 'After-hours speakeasy', startTime: '02:00', source: 'manual' },
      ],
    },
  ];
  const out = assertNoCrossDayBleed(days);
  assertEquals(out.changed, false);
});

Deno.test('cross-day bleed guard: Day 2 head at 09:00 is no-op', () => {
  const days = [
    {
      dayNumber: 1,
      activities: [{ title: 'Nightcap', startTime: '22:00', endTime: '23:30' }],
    },
    {
      dayNumber: 2,
      activities: [{ title: 'Coffee', startTime: '09:00' }],
    },
  ];
  const out = assertNoCrossDayBleed(days);
  assertEquals(out.changed, false);
});

Deno.test('cross-day bleed guard: Day 1 ends early (≤22:00) → no move even if Day 2 head is pre-dawn', () => {
  const days = [
    {
      dayNumber: 1,
      activities: [{ title: 'Dinner', startTime: '18:00', endTime: '19:30' }],
    },
    {
      dayNumber: 2,
      activities: [{ title: 'Misplaced', startTime: '03:00' }],
    },
  ];
  const out = assertNoCrossDayBleed(days);
  // Tail end < 22:00, so we don't infer a late-nightlife signal — this is a
  // different bug class (not the Day-1-past-midnight pattern). predawn cascade
  // normalizer handles it separately.
  assertEquals(out.changed, false);
});

Deno.test('cross-day bleed guard: airport transfer at Day 2 head is exempt', () => {
  const days = [
    {
      dayNumber: 1,
      activities: [{ title: 'Nightcap', startTime: '22:00', endTime: '23:30' }],
    },
    {
      dayNumber: 2,
      activities: [
        {
          title: 'Airport Transfer',
          category: 'airport-transfer',
          startTime: '04:30',
        },
      ],
    },
  ];
  const out = assertNoCrossDayBleed(days);
  assertEquals(out.changed, false);
});

Deno.test('cross-day bleed guard: idempotent', () => {
  const days = [
    {
      dayNumber: 1,
      activities: [{ title: 'Nightcap', startTime: '22:00', endTime: '23:30' }],
    },
    {
      dayNumber: 2,
      activities: [{ id: 'x', title: 'Late thing', startTime: '01:33' }],
    },
  ];
  const first = assertNoCrossDayBleed(days);
  assertEquals(first.changed, true);
  const second = assertNoCrossDayBleed(first.days);
  assertEquals(second.changed, false);
});
