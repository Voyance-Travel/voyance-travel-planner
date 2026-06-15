import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { resolveScheduleOverlaps, snapEventCardsToPreferred } from '../schedule-overlap.ts';
const pm = (s: string) => { const m = s.match(/(\d{1,2}):(\d{2})/); return m ? +m[1]*60+ +m[2] : 0; };

Deno.test('snap: a stranded 23:15 watch party is pulled back to its preferred 18:30 slot (live WC bug)', () => {
  const acts = [
    { title: 'Breakfast', category: 'dining', startTime: '08:30', endTime: '09:30' },
    { title: 'FIFA Fan Festival at Centennial Olympic Park', source: 'host-city-event', startTime: '14:40', endTime: '16:40', preferredStart: '15:30', preferredEnd: '17:30' },
    { title: 'Dinner at Busy Bee', category: 'dining', startTime: '20:10', endTime: '21:25' },
    { title: 'Watch the match at Brewhouse Cafe', source: 'host-city-event', startTime: '23:15', endTime: '01:15', preferredStart: '18:30', preferredEnd: '20:30' },
  ];
  const { moved } = snapEventCardsToPreferred(acts);
  assertEquals(moved, 1, 'only the far-drifted watch party moves; the fan fest (1h drift) stays');
  const wp = acts.find((a) => /brewhouse/i.test(a.title))!;
  assertEquals(wp.startTime, '18:30', 'watch party back at its evening slot');
  const ff = acts.find((a) => /fan festival/i.test(a.title))!;
  assertEquals(ff.startTime, '14:40', 'fan fest within drift tolerance — untouched');
});

Deno.test('snap + resolve: no card is left past 21:30 once a freed evening slot exists', () => {
  const acts = [
    { title: 'Lunch', category: 'dining', startTime: '12:30', endTime: '13:30' },
    { title: 'FIFA Fan Festival', source: 'host-city-event', startTime: '15:30', endTime: '17:30', preferredStart: '15:30', preferredEnd: '17:30' },
    { title: 'Watch the match at Brewhouse Cafe', source: 'host-city-event', startTime: '22:40', endTime: '00:40', preferredStart: '18:30', preferredEnd: '20:30' },
  ];
  const snapped = snapEventCardsToPreferred(acts).activities;
  const out = resolveScheduleOverlaps(snapped).activities;
  for (const a of out) assert(pm(a.startTime) <= pm('21:00'), `${a.title} should not start after 21:00, got ${a.startTime}`);
});

Deno.test('snap: leaves a non-event card alone even if far from any preferred', () => {
  const acts = [{ title: 'Late bar', startTime: '23:00', endTime: '00:30', preferredStart: '18:00' }];
  assertEquals(snapEventCardsToPreferred(acts).moved, 0, 'only source=host-city-event cards are snapped');
});

Deno.test('removes a dinner/bar overlap (the real defect)', () => {
  const acts = [
    { title: "Dinner at Paschal's", startTime: '20:20', endTime: '22:20' },
    { title: 'Biltmore Bar', startTime: '21:45', endTime: '23:15' },
  ];
  const { fixed } = resolveScheduleOverlaps(acts);
  assert(fixed >= 1);
  const b = acts.find((a) => /biltmore/i.test(a.title))!;
  assert(pm(b.startTime) >= pm("22:20"), `bar must start at/after dinner ends, got ${b.startTime}`);
});

Deno.test('no overlaps remain across a full day', () => {
  const acts = [
    { title: 'A', startTime: '08:30', endTime: '09:45' },
    { title: 'B', startTime: '16:35', endTime: '18:35' },
    { title: 'C', startTime: '17:55', endTime: '19:55' },
    { title: 'D', startTime: '20:20', endTime: '22:20' },
    { title: 'E', startTime: '21:45', endTime: '23:15' },
  ];
  resolveScheduleOverlaps(acts);
  const blocks = acts.map((a) => [pm(a.startTime), pm(a.endTime)]).sort((x, y) => x[0]-y[0]);
  for (let i=1;i<blocks.length;i++) assert(blocks[i][0] >= blocks[i-1][1], `overlap at ${JSON.stringify(blocks[i])}`);
});

Deno.test('leaves a clean schedule untouched', () => {
  const acts = [{ title: 'A', startTime: '09:00', endTime: '10:00' }, { title: 'B', startTime: '11:00', endTime: '12:00' }];
  assertEquals(resolveScheduleOverlaps(acts).fixed, 0);
});

import { dropOrphanTransit } from '../schedule-overlap.ts';
Deno.test('drops a trailing "Travel to X" with no activity after it', () => {
  const day = [
    { title: 'Lunch', category: 'dining', startTime: '12:00', endTime: '13:00' },
    { title: 'FIFA Fan Festival', category: 'activity', startTime: '14:30', endTime: '16:30' },
    { title: 'Travel to 9 Mile Station at Ponce City Market', category: 'transport', startTime: '19:50', endTime: '20:10' },
  ];
  const r = dropOrphanTransit(day);
  assertEquals(r.dropped, 1);
  assert(!r.activities.some((a) => /travel to/i.test(a.title)));
});
Deno.test('keeps a transit that IS followed by a real activity', () => {
  const day = [
    { title: 'Travel to Museum', category: 'transport', startTime: '10:00', endTime: '10:20' },
    { title: 'Museum visit', category: 'cultural', startTime: '10:30', endTime: '12:00' },
  ];
  assertEquals(dropOrphanTransit(day).dropped, 0);
});
