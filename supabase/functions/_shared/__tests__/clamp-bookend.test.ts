import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { clampBookendEndTime, clampAllBookends, isBookendCard } from '../clamp-bookend.ts';

Deno.test('clamps "Return to Hotel" 23:45 + 59min to end 23:59', () => {
  const card = {
    title: 'Return to JW Marriott Venice Resort & Spa',
    category: 'accommodation',
    startTime: '23:45',
    endTime: '00:44',
    durationMinutes: 59,
  };
  const res = clampBookendEndTime(card);
  assert(res.changed);
  assertEquals(card.endTime, '23:59');
  assertEquals(card.startTime, '23:45');
  assertEquals(card.durationMinutes, 14);
});

Deno.test('pulls start back when shrunk window is < 5 min', () => {
  const card = {
    title: 'Return to Hotel',
    category: 'accommodation',
    startTime: '23:57',
    endTime: '00:30',
    durationMinutes: 33,
  };
  const res = clampBookendEndTime(card);
  assert(res.changed);
  assertEquals(card.endTime, '23:59');
  assertEquals(card.startTime, '23:44'); // pulled back to preserve 15 min
  assertEquals(card.durationMinutes, 15);
});

Deno.test('no-op for in-bounds card', () => {
  const card = {
    title: 'Return to Hotel',
    category: 'accommodation',
    startTime: '22:30',
    endTime: '23:00',
    durationMinutes: 30,
  };
  const res = clampBookendEndTime(card);
  assert(!res.changed);
  assertEquals(card.endTime, '23:00');
});

Deno.test('no-op for non-bookend card even if it crosses midnight', () => {
  const card = {
    title: 'Late Cocktails at Bar Longhi',
    category: 'dining',
    startTime: '23:00',
    endTime: '01:00',
  };
  const res = clampBookendEndTime(card);
  assert(!res.changed);
});

Deno.test('isBookendCard recognises hotel transport bookends', () => {
  assert(isBookendCard({ title: 'Shuttle to JW Marriott', category: 'transport' }));
  assert(isBookendCard({ title: 'Return to Your Hotel', category: 'accommodation' }));
  assert(isBookendCard({ title: 'Freshen Up at Hotel', category: 'accommodation' }));
  assert(!isBookendCard({ title: 'Dinner at Quadri', category: 'dining' }));
});

Deno.test('clampAllBookends counts changes correctly', () => {
  const acts = [
    { title: 'Dinner', category: 'dining', startTime: '20:00', endTime: '22:00' },
    { title: 'Return to Hotel', category: 'accommodation', startTime: '23:45', endTime: '00:30' },
    { title: 'Return to Hotel', category: 'accommodation', startTime: '22:00', endTime: '22:20' },
  ];
  const n = clampAllBookends(acts);
  assertEquals(n, 1);
  assertEquals(acts[1].endTime, '23:59');
});
