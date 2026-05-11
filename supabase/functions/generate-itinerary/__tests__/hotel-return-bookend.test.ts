// Hotel-return bookend tests for runStep8.
// See plan in .lovable/plan.md (item #10).
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { runStep8 } from '../universal-quality-pass.ts';

function mkAct(opts: Partial<any> & { startTime: string; endTime: string }): any {
  return {
    title: opts.title ?? 'Sightseeing',
    category: opts.category ?? 'sightseeing',
    ...opts,
    start_time: opts.startTime,
    end_time: opts.endTime,
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

// ── Late-nightlife bookend regressions (Florence/Barcelona) ──

import { stripPreDawnHotelReturns } from '../../_shared/predawn-hotel-strip.ts';

Deno.test('runStep8 + predawn strip: late nightcap ending 00:10 keeps bookend (Florence Day 1)', () => {
  const acts = [
    mkAct({ title: 'The Duomo Complex', startTime: '12:25', endTime: '14:55', category: 'sightseeing' }),
    mkAct({ title: 'Wander the Oltrarno Alleys', startTime: '19:10', endTime: '20:40', category: 'activity' }),
    mkAct({ title: 'Secluded Nightcap at Bulli & Balene', startTime: '23:25', endTime: '00:10', category: 'relaxation' }),
  ];
  runStep8(acts, 0, 'MH Florence Hotel & Spa');
  assertEquals(acts.length, 4);
  const last = acts[acts.length - 1];
  assertEquals(String(last.source), 'late_nightlife_bookend');
  // Predawn strip MUST NOT remove the late-nightlife bookend.
  const removed = stripPreDawnHotelReturns(acts, { dayNumber: 1, label: 'TEST' });
  assertEquals(removed, 0);
  assertEquals(acts.length, 4);
  assertEquals(String(acts[acts.length - 1]?.category), 'accommodation');
});

Deno.test('runStep8: nightcap ending 22:55 gets standard bookend (Florence Day 2)', () => {
  const acts = [
    mkAct({ title: 'Officina Santa Maria Novella Visit', startTime: '13:50', endTime: '15:20', category: 'cultural' }),
    mkAct({ title: 'Birthday Nightcap at Fusion Bar', startTime: '21:55', endTime: '22:55', category: 'activity' }),
  ];
  runStep8(acts, 1, 'MH Florence Hotel & Spa');
  assertEquals(acts.length, 3);
  assertEquals(lastCat(acts), 'accommodation');
  assertEquals(lastTitle(acts).startsWith('Return to'), true);
});

Deno.test('runStep8: speakeasy ending 00:20 keeps bookend after predawn strip (Barcelona Day 2)', () => {
  const acts = [
    mkAct({ title: 'Freshen Up at Condal Mar', startTime: '19:50', endTime: '21:25', category: 'accommodation' }),
    mkAct({ title: 'Nightcap at Paradiso Speakeasy', startTime: '23:10', endTime: '00:20', category: 'activity' }),
  ];
  runStep8(acts, 1, 'Hotel Barcelona Condal Mar');
  assertEquals(acts.length, 3);
  stripPreDawnHotelReturns(acts, { dayNumber: 2, label: 'TEST' });
  // Late-nightlife bookend survives, predawn strip leaves it alone.
  assertEquals(acts.length, 3);
  assertEquals(String(acts[acts.length - 1]?.source), 'late_nightlife_bookend');
});

Deno.test('runStep8: terminal "Freshen up at <hotel>" mid-evening — no duplicate bookend', () => {
  const acts = [
    mkAct({ title: 'Thyssen Museum', startTime: '11:30', endTime: '13:30', category: 'activity' }),
    mkAct({ title: 'Freshen up at Mandarin Oriental Ritz, Madrid', startTime: '20:30', endTime: '21:40', category: 'accommodation' }),
  ];
  const before = acts.length;
  runStep8(acts, 1, 'Mandarin Oriental Ritz, Madrid');
  assertEquals(acts.length, before);
});

Deno.test('predawn strip: untagged accommodation card at 00:30 still removed (regression guard)', () => {
  const acts = [
    mkAct({ title: 'Return to Hotel', startTime: '00:30', endTime: '01:00', category: 'accommodation' }),
  ];
  const removed = stripPreDawnHotelReturns(acts, { dayNumber: 1, label: 'TEST' });
  assertEquals(removed, 1);
  assertEquals(acts.length, 0);
});
