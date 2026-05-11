/**
 * M2 — Madrid Day 2 phantom-ref clause-level scrub.
 * See plan: .lovable/plan.md (Description-schedule coherence)
 * Memory:   mem://constraints/itinerary/schedule-coherent-copy
 */
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildDayScheduleSummary,
  scrubPhantomEventRefsFromString,
  scrubPhantomEventRefs,
} from '../prompt-leak-scrub.ts';

const noDinnerSummary = buildDayScheduleSummary([
  { title: 'Breakfast at La Mallorquina', startTime: '09:00', category: 'dining', mealSlot: 'breakfast' },
  { title: 'Prado Museum', startTime: '11:00', category: 'museum' },
  { title: 'Freshen up at Mandarin Oriental Ritz', startTime: '18:30', category: 'logistics' },
]);

const withDinnerSummary = buildDayScheduleSummary([
  { title: 'Prado Museum', startTime: '11:00', category: 'museum' },
  { title: 'Dinner at Coque', startTime: '20:30', category: 'dining', mealSlot: 'dinner' },
]);

Deno.test('M2 reproducer — semicolon clause containing tonight\'s dinner is dropped', () => {
  const input = "Freshen up at Mandarin Oriental Ritz; leave by 20:30 for tonight's Michelin-starred dinner.";
  const out = scrubPhantomEventRefsFromString(input, noDinnerSummary);
  assertEquals(typeof out, 'string');
  assertEquals(/tonight/i.test(out as string), false);
  assertEquals(/freshen up/i.test(out as string), true);
});

Deno.test('em-dash variant — second clause dropped', () => {
  const input = "Take a moment to refresh — then leave by 20:30 for tonight's Michelin dinner";
  const out = scrubPhantomEventRefsFromString(input, noDinnerSummary);
  assertEquals(typeof out, 'string');
  assertEquals(/tonight/i.test(out as string), false);
  assertEquals(/refresh/i.test(out as string), true);
});

Deno.test('single-segment phantom-only field is blanked', () => {
  const input = "Leave by 20:30 for tonight's Michelin-starred dinner";
  const out = scrubPhantomEventRefsFromString(input, noDinnerSummary);
  assertEquals(out, '');
});

Deno.test('rich single sentence with phantom ref is preserved (safety guard)', () => {
  // 6+ substantive words besides the phantom ref → not blanked
  const input = "Spend a relaxing afternoon wandering the leafy Retiro gardens before tonight's Michelin dinner";
  const out = scrubPhantomEventRefsFromString(input, noDinnerSummary);
  // Either preserved (null) or rewritten without phantom; never blanked.
  if (out !== null) assertEquals(out !== '', true);
});

Deno.test('negative — no phantom, returns null (unchanged)', () => {
  const input = "Take a moment to refresh in your suite.";
  const out = scrubPhantomEventRefsFromString(input, noDinnerSummary);
  assertEquals(out, null);
});

Deno.test('negative — phantom resolves OK when dinner is scheduled', () => {
  const input = "Tonight's dinner at Coque awaits.";
  const out = scrubPhantomEventRefsFromString(input, withDinnerSummary);
  assertEquals(out, null);
});

Deno.test('scrubPhantomEventRefs writes empty string + records strip on full-blank', () => {
  const act: any = { description: "Leave by 20:30 for tonight's Michelin dinner" };
  const r = scrubPhantomEventRefs(act, noDinnerSummary);
  assertEquals(r.changed, true);
  assertEquals(act.description, '');
  assertEquals(r.fields.includes('description'), true);
});

Deno.test('scrubPhantomEventRefs partial-clause strip preserves first clause', () => {
  const act: any = {
    description: "Freshen up at Mandarin Oriental Ritz; leave by 20:30 for tonight's Michelin-starred dinner.",
  };
  const r = scrubPhantomEventRefs(act, noDinnerSummary);
  assertEquals(r.changed, true);
  assertEquals(/tonight/i.test(act.description), false);
  assertEquals(/freshen up/i.test(act.description), true);
});

// User-requested explicit Madrid regression: exact failure phrasing from QA.
Deno.test("Madrid QA repro — 'Leave by 20:30 for tonight's Michelin-starred dinner.' (no dinner card) is dropped", () => {
  const input = "Leave by 20:30 for tonight's Michelin-starred dinner.";
  const out = scrubPhantomEventRefsFromString(input, noDinnerSummary);
  assertEquals(out, '');
});

Deno.test("Madrid QA repro — same sentence preserved when dinner IS scheduled", () => {
  const input = "Leave by 20:30 for tonight's Michelin-starred dinner.";
  const out = scrubPhantomEventRefsFromString(input, withDinnerSummary);
  // null = unchanged (no phantom); accept null OR non-empty preserved string
  if (out !== null) assertEquals(out !== '', true);
});
