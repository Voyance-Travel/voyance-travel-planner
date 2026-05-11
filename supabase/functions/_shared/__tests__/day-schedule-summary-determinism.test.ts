// M1 round 2 reviewer note:
// `buildDayScheduleSummary` MUST be deterministic across retries with
// identical inputs (modulo input order). The stable sort by (startTime asc,
// id/title asc) plus the `summaryKeywordList` sorted accessor are the
// guarantees the prompt-side schedule injection relies on. Without them,
// jittered ordering between runs would feed the LLM different "ground truth"
// and the SCHEDULE COHERENCE rule would lose force.

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildDayScheduleSummary, summaryKeywordList } from '../prompt-leak-scrub.ts';

const acts = [
  { id: 'b', title: 'Reina Sofía Museum', category: 'museum', startTime: '10:00' },
  { id: 'a', title: 'Misión Café Breakfast', category: 'dining', startTime: '08:30', mealSlot: 'breakfast' },
  { id: 'd', title: 'DiverXO Dinner', category: 'dining', startTime: '20:00', mealSlot: 'dinner' },
  { id: 'c', title: 'Plaza Mayor Stroll', category: 'sightseeing', startTime: '13:00' },
];

Deno.test('buildDayScheduleSummary: keyword list is deterministic across input shuffles', () => {
  const a = summaryKeywordList(buildDayScheduleSummary([...acts]));
  const b = summaryKeywordList(buildDayScheduleSummary([...acts].reverse()));
  const c = summaryKeywordList(buildDayScheduleSummary([acts[2], acts[0], acts[3], acts[1]]));
  assertEquals(a, b);
  assertEquals(b, c);
});

Deno.test('summaryKeywordList: sorted ascending', () => {
  const list = summaryKeywordList(buildDayScheduleSummary(acts));
  const sorted = [...list].sort();
  assertEquals(list, sorted);
});

Deno.test('buildDayScheduleSummary: meal flags stable across input order', () => {
  const s1 = buildDayScheduleSummary([...acts]);
  const s2 = buildDayScheduleSummary([...acts].reverse());
  assertEquals(s1.hasBreakfast, s2.hasBreakfast);
  assertEquals(s1.hasLunch, s2.hasLunch);
  assertEquals(s1.hasDinner, s2.hasDinner);
  assertEquals(s1.hasBrunch, s2.hasBrunch);
  assertEquals(s1.hasNightcap, s2.hasNightcap);
});

Deno.test('summaryKeywordList: ties broken by id when startTime equal', () => {
  const tied = [
    { id: 'z', title: 'Zebra Visit', category: 'zoo', startTime: '12:00' },
    { id: 'a', title: 'Alpaca Visit', category: 'zoo', startTime: '12:00' },
  ];
  const r1 = summaryKeywordList(buildDayScheduleSummary(tied));
  const r2 = summaryKeywordList(buildDayScheduleSummary([tied[1], tied[0]]));
  assertEquals(r1, r2);
});
