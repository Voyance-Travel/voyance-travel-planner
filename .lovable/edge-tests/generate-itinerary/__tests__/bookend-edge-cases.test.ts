// Edge-case bookend tests for runStep8 — covers missing/malformed/early end_time.
// See plan in .lovable/plan.md (item Hotel-Return Edge-Case Hardening).
import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { runStep8 } from '../universal-quality-pass.ts';

function mkAct(opts: Partial<any> & { startTime?: string; endTime?: string }): any {
  const out: any = {
    title: opts.title ?? 'Sightseeing',
    category: opts.category ?? 'sightseeing',
    ...opts,
  };
  if (opts.startTime !== undefined) {
    out.start_time = opts.startTime;
    out.startTime = opts.startTime;
  }
  if (opts.endTime !== undefined) {
    out.end_time = opts.endTime;
    out.endTime = opts.endTime;
  }
  return out;
}

const lastTitle = (a: any[]) => String(a[a.length - 1]?.title || '');
const lastCat = (a: any[]) => String(a[a.length - 1]?.category || '');
const lastSource = (a: any[]) => String(a[a.length - 1]?.source || '');

Deno.test('runStep8: last activity has NO end_time → bookend injected (synthesized)', () => {
  const acts = [
    mkAct({ title: 'Museum Visit', startTime: '15:00', category: 'museum', duration: '90 min' }),
    mkAct({ title: 'Aimless Wander', startTime: '17:30', category: 'activity' }), // no endTime
  ];
  runStep8(acts, 0, 'Hotel Cipriani');
  assertEquals(acts.length, 3);
  assertEquals(lastCat(acts), 'accommodation');
  assertEquals(lastTitle(acts).startsWith('Return to'), true);
  assertEquals(lastSource(acts), 'bookend-synthesized');
});

Deno.test('runStep8: last activity end_time malformed → derives from start+duration', () => {
  const acts = [
    mkAct({ title: 'Cooking Class', startTime: '17:00', endTime: 'tba', category: 'activity', duration: '2h30' }),
  ];
  runStep8(acts, 0, 'Hotel Cipriani');
  assertEquals(acts.length, 2);
  assertEquals(lastSource(acts), 'bookend-synthesized');
  // 17:00 + 2h30 = 19:30 → start of bookend
  assertEquals(String(acts[1].start_time), '19:30');
});

Deno.test('runStep8: last activity ends 13:45 (early lunch close) → bookend still injected', () => {
  const acts = [
    mkAct({ title: 'Quick Lunch', startTime: '12:30', endTime: '13:45', category: 'dining' }),
  ];
  runStep8(acts, 0, 'Hotel Cipriani');
  assertEquals(acts.length, 2);
  assertEquals(lastCat(acts), 'accommodation');
  assertEquals(lastSource(acts), 'bookend-synthesized');
  // Early-close clamps to 19:00 floor
  assertEquals(String(acts[1].start_time), '19:00');
});

Deno.test('runStep8: airport transit on departure day → NO bookend (regression guard)', () => {
  const acts = [
    mkAct({ title: 'Brunch', startTime: '10:00', endTime: '11:30', category: 'dining' }),
    mkAct({ title: 'Transfer to Airport', startTime: '13:00', endTime: '14:00', category: 'transport' }),
  ];
  runStep8(acts, 4, 'Hotel Cipriani');
  assertEquals(acts.length, 2);
  assertEquals(lastTitle(acts), 'Transfer to Airport');
});

Deno.test('runStep8: last activity already STAY → NO duplicate bookend (idempotency)', () => {
  const acts = [
    mkAct({ title: 'Dinner', startTime: '19:00', endTime: '21:00', category: 'dining' }),
    mkAct({ title: 'Stay at Hotel Cipriani', startTime: '21:30', endTime: '22:00', category: 'stay' }),
  ];
  runStep8(acts, 0, 'Hotel Cipriani');
  assertEquals(acts.length, 2);
});

Deno.test('runStep8: last activity has neither start nor end → uses day floor 19:00', () => {
  const acts = [
    mkAct({ title: 'Morning Coffee', startTime: '09:00', endTime: '10:00', category: 'dining' }),
    mkAct({ title: 'Free Time', category: 'activity' }), // no times at all
  ];
  runStep8(acts, 0, 'Hotel Cipriani');
  assertEquals(acts.length, 3);
  assertEquals(lastSource(acts), 'bookend-synthesized');
  // Latest known time was 10:00 → +30 = 10:30, clamped up to 19:00 floor
  assertEquals(String(acts[2].start_time), '19:00');
});
