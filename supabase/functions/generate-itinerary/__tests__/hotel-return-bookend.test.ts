// Hotel-return bookend tests for runStep8.
// See plan in .lovable/plan.md (item #10).
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { runStep8 } from '../universal-quality-pass.ts';

function mkAct(opts: Partial<any> & { startTime: string; endTime: string }) {
  return {
    title: opts.title ?? 'Sightseeing',
    category: opts.category ?? 'sightseeing',
    startTime: opts.startTime,
    start_time: opts.startTime,
    endTime: opts.endTime,
    end_time: opts.endTime,
    ...opts,
  };
}

const lastTitle = (a: any[]) => String(a[a.length - 1]?.title || '');
const lastCat = (a: any[]) => String(a[a.length - 1]?.category || '');

Deno.test('runStep8 appends hotel-return when last activity ends 16:30 (was below old 17:00 floor)', () => {
  const acts = [mkAct({ title: 'Cultural Anchor', startTime: '14:30', endTime: '16:30' })];
  runStep8(acts, 0, 'Hotel Cipriani');
  assertEquals(acts.length, 2);
  assertEquals(lastTitle(acts).startsWith('Return to'), true);
  assertEquals(lastCat(acts), 'accommodation');
});

Deno.test('runStep8 still skips when last activity ends 13:00 (below 14:00 floor)', () => {
  const acts = [mkAct({ title: 'Quick Lunch', startTime: '12:00', endTime: '13:00' })];
  runStep8(acts, 0, 'Hotel Cipriani');
  assertEquals(acts.length, 1);
});

Deno.test('runStep8 idempotent: no-op when day already ends on STAY/return', () => {
  const acts = [
    mkAct({ title: 'Dinner at Da Ivo', startTime: '19:00', endTime: '21:00', category: 'dining' }),
    mkAct({ title: 'Return to Hotel Cipriani', startTime: '21:00', endTime: '21:30', category: 'accommodation' }),
  ];
  const before = acts.length;
  runStep8(acts, 0, 'Hotel Cipriani');
  assertEquals(acts.length, before);
});

Deno.test('runStep8 appends after late dinner (post-meal-guard retry path)', () => {
  const acts = [
    mkAct({ title: 'Museum', startTime: '14:00', endTime: '16:00', category: 'museum' }),
    mkAct({ title: 'Dinner at Da Ivo', startTime: '19:00', endTime: '21:00', category: 'dining' }),
  ];
  runStep8(acts, 0, 'Hotel Cipriani');
  assertEquals(acts.length, 3);
  assertEquals(lastCat(acts), 'accommodation');
});

Deno.test('runStep8 falls back to "Your Hotel" when hotelName empty', () => {
  const acts = [mkAct({ title: 'Dinner', startTime: '19:00', endTime: '21:00', category: 'dining' })];
  runStep8(acts, 0, undefined);
  assertEquals(lastTitle(acts), 'Return to Your Hotel');
});
