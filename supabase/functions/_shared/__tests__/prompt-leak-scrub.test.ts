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

Deno.test('strips camelCase "reservationUrgency: ." from description', () => {
  const act: any = { description: 'Wear waterproof footwear. reservationUrgency: .' };
  const r = scrubBodyPromptLeaks(act);
  if (!r.changed) throw new Error('expected change');
  if (/reservationUrgency/i.test(act.description)) throw new Error(`still leaks: ${act.description}`);
});

Deno.test('strips camelCase "reservationUrgency:." (no space) from tips', () => {
  const act: any = { tips: 'Cover shoulders. reservationUrgency:.' };
  const r = scrubBodyPromptLeaks(act);
  if (!r.changed) throw new Error('expected change');
  if (/reservationUrgency/i.test(act.tips)) throw new Error(`still leaks: ${act.tips}`);
});

Deno.test('strips snake_case "booking_window: ." from notes', () => {
  const act: any = { notes: 'Book ahead. booking_window: . Bring sunscreen.' };
  scrubBodyPromptLeaks(act);
  if (/booking_window/i.test(act.notes)) throw new Error(`still leaks: ${act.notes}`);
});

Deno.test('preserves real "Reservation: required for brunch."', () => {
  const original = 'Reservation: required for brunch.';
  const act: any = { description: original };
  const r = scrubBodyPromptLeaks(act);
  if (r.changed) throw new Error('should not have changed');
});

Deno.test('drops camelCase-shaped reservationUrgency JSON value', () => {
  const a: any = { title: 'Dinner', reservationUrgency: 'reservationUrgency: .' };
  scrubTitleLeaks(a);
  if ('reservationUrgency' in a) throw new Error('expected reservationUrgency removed');
});

// ─── Phantom event references (M1) ─────────────────────────────────────────

import {
  buildDayScheduleSummary,
  scrubPhantomEventRefs,
  scrubPhantomEventRefsFromString,
} from '../prompt-leak-scrub.ts';

const dayWithDinner = [
  { title: 'Freshen up at Mandarin Oriental Ritz', startTime: '20:00', category: 'wellness' },
  { title: 'Dinner at DiverXO', startTime: '21:00', category: 'dining', mealSlot: 'dinner' },
];
const dayNoDinner = [
  { title: 'Freshen up at Mandarin Oriental Ritz', startTime: '20:00', category: 'wellness' },
];

Deno.test('phantom-ref: drops "leave by 20:30 for tonight\'s Michelin-starred dinner" when no dinner card', () => {
  const summary = buildDayScheduleSummary(dayNoDinner);
  const act: any = { description: 'Recharge briefly in your suite. Then leave by 20:30 for tonight\'s Michelin-starred dinner.' };
  const r = scrubPhantomEventRefs(act, summary);
  if (!r.changed) throw new Error('expected change');
  if (/dinner/i.test(act.description)) throw new Error('dinner ref should be stripped, got: ' + act.description);
});

Deno.test('phantom-ref: keeps the same sentence when dinner card IS present', () => {
  const summary = buildDayScheduleSummary(dayWithDinner);
  const act: any = { description: 'Recharge briefly in your suite. Then leave by 20:30 for tonight\'s Michelin-starred dinner.' };
  const r = scrubPhantomEventRefs(act, summary);
  if (r.changed) throw new Error('expected no change when dinner exists');
});

Deno.test('phantom-ref: drops "after the Prado tour" when no Prado card', () => {
  const summary = buildDayScheduleSummary([{ title: 'Lunch at Botin', category: 'dining', startTime: '14:00', mealSlot: 'lunch' }]);
  const act: any = { description: 'Walk slowly through the gardens. Linger after the Prado tour for a moment of calm.' };
  const r = scrubPhantomEventRefs(act, summary);
  if (!r.changed) throw new Error('expected change');
  if (/Prado/i.test(act.description)) throw new Error('Prado ref should be stripped');
});

Deno.test('phantom-ref: keeps "after the Prado tour" when Prado is on schedule', () => {
  const summary = buildDayScheduleSummary([
    { title: 'Prado Museum tour', category: 'museum', startTime: '10:00' },
    { title: 'Lunch at Botin', category: 'dining', startTime: '14:00', mealSlot: 'lunch' },
  ]);
  const act: any = { description: 'Walk slowly through the gardens. Linger after the Prado tour for a moment of calm.' };
  const r = scrubPhantomEventRefs(act, summary);
  if (r.changed) throw new Error('expected no change when Prado exists');
});

Deno.test('phantom-ref: never blanks a single-sentence field', () => {
  const summary = buildDayScheduleSummary(dayNoDinner);
  const out = scrubPhantomEventRefsFromString(
    "Leave by 20:30 for tonight's Michelin-starred dinner.",
    summary,
  );
  // Single sentence — must not be stripped to empty
  assertEquals(out, null);
});
