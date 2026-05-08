import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  scrubBodyPromptLeaks,
  hasBodyPromptLeak,
} from '../prompt-leak-scrub.ts';

Deno.test('strips orphan "Reservation Urgency: ." with trailing period', () => {
  const act: any = { description: 'Soothing massage. Reservation Urgency: .' };
  const r = scrubBodyPromptLeaks(act);
  assertEquals(r.changed, true);
  assertEquals(act.description, 'Soothing massage.');
});

Deno.test('strips value-bearing "Reservation Urgency: book_soon." segment', () => {
  const act: any = {
    tips: 'Reservation Urgency: book_soon. Spa with hammam available all day.',
  };
  const r = scrubBodyPromptLeaks(act);
  assertEquals(r.changed, true);
  assertEquals(act.tips, 'Spa with hammam available all day.');
});

Deno.test('strips Booking Window / Lead Time siblings', () => {
  const act: any = {
    notes: 'Booking Window: . Lead Time: 2-4 weeks. Bring a swimsuit.',
  };
  scrubBodyPromptLeaks(act);
  assertEquals(act.notes, 'Bring a swimsuit.');
});

Deno.test('preserves real singular "Reservation: required for Sunday brunch."', () => {
  const original = 'Reservation: required for Sunday brunch.';
  const act: any = { description: original };
  const r = scrubBodyPromptLeaks(act);
  assertEquals(r.changed, false);
  assertEquals(act.description, original);
});

Deno.test('preserves real "Note: closed Mondays."', () => {
  const original = 'Closed Mondays. Note: closed Mondays.';
  const act: any = { description: original };
  scrubBodyPromptLeaks(act);
  // Should NOT strip — value is not empty.
  assertEquals(act.description.includes('Note: closed Mondays.'), true);
});

Deno.test('hasBodyPromptLeak detects across fields', () => {
  assertEquals(hasBodyPromptLeak({ tips: 'Reservation Urgency: .' })?.field, 'tips');
  assertEquals(hasBodyPromptLeak({ description: 'All clean here.' }), null);
});

import { scrubTitleLeaks, hasTitleLeak } from '../prompt-leak-scrub.ts';

Deno.test('scrubTitleLeaks strips "Reservation Urgency: ." from title', () => {
  const a: any = { title: 'Spa Day Reservation Urgency: .' };
  const r = scrubTitleLeaks(a);
  if (!r.changed) throw new Error('expected change');
  if (/Reservation\s+Urgency/i.test(a.title)) throw new Error(`title still leaks: ${a.title}`);
});

Deno.test('scrubTitleLeaks drops empty reservationUrgency value', () => {
  const a: any = { title: 'Dinner', reservationUrgency: '.' };
  scrubTitleLeaks(a);
  if ('reservationUrgency' in a) throw new Error('expected reservationUrgency removed');
});

Deno.test('scrubTitleLeaks drops leaked label-shaped reservationUrgency', () => {
  const a: any = { title: 'Dinner', reservationUrgency: 'Reservation Urgency: .' };
  scrubTitleLeaks(a);
  if ('reservationUrgency' in a) throw new Error('expected reservationUrgency removed');
});

Deno.test('hasTitleLeak detects leaks in title and reservationUrgency', () => {
  const t = hasTitleLeak({ title: 'Foo Reservation Urgency: book_soon.' });
  if (!t || t.field !== 'title') throw new Error('expected title leak');
  const ru = hasTitleLeak({ title: 'Dinner', reservationUrgency: '.' });
  if (!ru || ru.field !== 'reservationUrgency') throw new Error('expected ru leak');
});
