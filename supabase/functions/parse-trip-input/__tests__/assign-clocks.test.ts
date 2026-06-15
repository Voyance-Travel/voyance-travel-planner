import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { assignClocksToDay } from '../index.ts';

const pm = (s: string) => { const m = String(s).match(/^(\d{2}):(\d{2})$/); return m ? +m[1] * 60 + +m[2] : -1; };

Deno.test('coarse labels become real, strictly-increasing HH:MM clocks', () => {
  const acts = [
    { name: 'Coffee', time: 'Morning' },
    { name: 'Franklin BBQ', time: 'Lunch' },
    { name: 'Barton Springs', time: 'Afternoon' },
    { name: 'The Continental Club', time: 'Evening' },
  ];
  assignClocksToDay(acts);
  for (const a of acts) assertEquals(/^\d{2}:\d{2}$/.test(a.time), true, `${a.name} → clock`);
  const mins = acts.map((a) => pm(a.time));
  for (let i = 1; i < mins.length; i++) assert(mins[i] > mins[i - 1], `increasing at ${i}: ${mins}`);
  assert(pm(acts[0].time) < 12 * 60, 'morning is AM');
  assert(pm(acts[3].time) >= 17 * 60, 'evening is PM');
});

Deno.test('explicit clock times are honored verbatim', () => {
  const acts = [{ name: 'Tour', time: '7:30 PM' }, { name: 'Bar', time: '9pm' }];
  assignClocksToDay(acts);
  assertEquals(acts[0].time, '19:30');
  assertEquals(acts[1].time, '21:00');
});

Deno.test('either/or alternates SHARE one slot — cursor advances once per group', () => {
  // The frontend dedups to the first option; the alternate must not consume a
  // slot or it would push later activities (e.g. the evening show) too late.
  const acts = [
    { name: 'Coffee', time: 'Morning' },
    { name: 'Uchi', time: 'Dinner', isOption: true, optionGroup: 'dinner-d1' },
    { name: 'Loro', time: 'Dinner', isOption: true, optionGroup: 'dinner-d1' },
    { name: 'Live music', time: 'Evening' },
  ];
  assignClocksToDay(acts);
  assertEquals(acts[1].time, acts[2].time, 'both dinner options share the slot');
  // Evening show lands after dinner but not pushed an extra 90m by the alternate.
  assertEquals(pm(acts[3].time), pm(acts[1].time) + 90, 'show is exactly one slot after dinner');
});

Deno.test('idempotent — running twice yields the same clocks (matches the frontend re-resolve)', () => {
  const acts = [{ name: 'A', time: 'Morning' }, { name: 'B', time: 'Lunch' }, { name: 'C', time: 'Dinner' }];
  assignClocksToDay(acts);
  const first = acts.map((a) => a.time);
  assignClocksToDay(acts);
  assertEquals(acts.map((a) => a.time), first);
});
