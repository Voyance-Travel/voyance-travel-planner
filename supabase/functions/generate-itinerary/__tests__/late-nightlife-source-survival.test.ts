// Reviewer note (Hotel-return bookend round 2):
// Assert that `source: 'late_nightlife_bookend'` survives a full pipeline pass
// — runStep8 → predawn-strip → clampAllBookends → save-itinerary normalizeDays.
// If any downstream pass strips/rewrites the source field on accommodation
// cards, the 5-site predawn-strip skip becomes a no-op (silent regression).

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { runStep8 } from '../universal-quality-pass.ts';
import { stripPreDawnHotelReturns } from '../../_shared/predawn-hotel-strip.ts';
import { clampAllBookends } from '../../_shared/clamp-bookend.ts';
import { normalizeDays } from '../action-save-itinerary.ts';

function mkAct(opts: any): any {
  return {
    title: opts.title ?? 'Sightseeing',
    category: opts.category ?? 'sightseeing',
    ...opts,
    start_time: opts.startTime,
    end_time: opts.endTime,
  };
}

Deno.test('late_nightlife_bookend source tag survives full pipeline (Florence Day 1)', () => {
  const acts = [
    mkAct({ title: 'The Duomo Complex', startTime: '12:25', endTime: '14:55', category: 'sightseeing' }),
    mkAct({ title: 'Wander the Oltrarno Alleys', startTime: '19:10', endTime: '20:40', category: 'activity' }),
    mkAct({ title: 'Secluded Nightcap at Bulli & Balene', startTime: '23:25', endTime: '00:10', category: 'relaxation' }),
  ];

  // Step 1 — runStep8 emits late-nightlife bookend with source tag.
  runStep8(acts, 0, 'MH Florence Hotel & Spa');
  assertEquals(acts.length, 4);
  assertEquals(String(acts[3].source), 'late_nightlife_bookend');

  // Step 2 — predawn strip MUST preserve the bookend.
  stripPreDawnHotelReturns(acts, { dayNumber: 1, label: 'TEST' });
  assertEquals(acts.length, 4, 'predawn strip dropped the bookend');
  assertEquals(String(acts[3].source), 'late_nightlife_bookend', 'predawn strip stripped source field');

  // Step 3 — clamp-bookend (end-of-day clamp) must not rewrite source.
  clampAllBookends(acts, { dayNumber: 1, label: 'TEST' });
  assertEquals(String(acts[3].source), 'late_nightlife_bookend', 'clampAllBookends stripped source field');

  // Step 4 — full save-itinerary normalizeDays (sort + predawn + clamp +
  //          scrubActivity + post-checkout + post-transfer prune).
  const normalized = normalizeDays([{ activities: acts }], '2026-05-01', 'Florence');
  const out = normalized[0].activities;
  assertEquals(out.length, 4, 'normalizeDays dropped the bookend');
  // After sort, the late bookend may be at the end OR earlier (00:10 endTime
  // means startTime around 00:10). The card itself must still carry the tag.
  const tagged = out.find((a: any) => String(a.source) === 'late_nightlife_bookend');
  assertEquals(typeof tagged, 'object');
  assertEquals(String(tagged?.source), 'late_nightlife_bookend');
  assertEquals(String(tagged?.category), 'accommodation');
});

Deno.test('late_nightlife_bookend source tag survives full pipeline (Barcelona Day 2)', () => {
  const acts = [
    mkAct({ title: 'Freshen Up at Condal Mar', startTime: '19:50', endTime: '21:25', category: 'accommodation' }),
    mkAct({ title: 'Nightcap at Paradiso Speakeasy', startTime: '23:10', endTime: '00:20', category: 'activity' }),
  ];

  runStep8(acts, 1, 'Hotel Barcelona Condal Mar');
  const beforeNormalize = acts.length;
  assertEquals(beforeNormalize, 3);
  assertEquals(String(acts[2].source), 'late_nightlife_bookend');

  const normalized = normalizeDays([{ activities: acts }], '2026-05-01', 'Barcelona');
  const out = normalized[0].activities;
  const tagged = out.find((a: any) => String(a.source) === 'late_nightlife_bookend');
  assertEquals(typeof tagged, 'object', 'tag lost across normalizeDays');
  assertEquals(String(tagged?.category), 'accommodation');
});
