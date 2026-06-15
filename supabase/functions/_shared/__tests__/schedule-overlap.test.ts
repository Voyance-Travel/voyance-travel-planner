import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { resolveScheduleOverlaps } from '../schedule-overlap.ts';
const pm = (s: string) => { const m = s.match(/(\d{1,2}):(\d{2})/); return m ? +m[1]*60+ +m[2] : 0; };

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
