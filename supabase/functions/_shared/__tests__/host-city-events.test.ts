import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { findHostCityEvent, ensureHostCityEventExperience } from '../host-city-events.ts';

const NOTES = 'Walking around, here for the World Cup';

Deno.test('matches Atlanta + in-window + World Cup notes; finds the dated fixture', () => {
  const r = findHostCityEvent('Atlanta, GA', '2026-06-21', NOTES);
  assert(r, 'should match');
  assertEquals(r!.event.id, 'wc2026-atlanta');
  assertEquals(r!.matchOnDate?.fixture, 'Spain vs Saudi Arabia');
});

Deno.test('in-window but NO match on that date → event matches, matchOnDate null', () => {
  const r = findHostCityEvent('Atlanta', '2026-06-20', NOTES);
  assert(r);
  assertEquals(r!.matchOnDate, null);
});

Deno.test('does NOT fire without event mention in notes (generic Atlanta trip)', () => {
  assertEquals(findHostCityEvent('Atlanta, GA', '2026-06-21', 'Walking around, see the sights'), null);
});

Deno.test('does NOT fire out of the event window', () => {
  assertEquals(findHostCityEvent('Atlanta, GA', '2026-09-01', NOTES), null);
});

Deno.test('does NOT fire for a different city', () => {
  assertEquals(findHostCityEvent('Nashville, TN', '2026-06-21', NOTES), null);
});

Deno.test('ensure injects the real fan festival when absent', () => {
  const acts = [{ title: 'Lunch at Municipal Market', category: 'dining' }];
  const r = ensureHostCityEventExperience(acts, { destination: 'Atlanta, GA', dateISO: '2026-06-21', notes: NOTES });
  assert(r.injected);
  const ff = r.activities.find((a) => /fan festival/i.test(a.title));
  assert(ff, 'fan festival injected');
  assertEquals(ff.location, 'Centennial Olympic Park');
  assert(/Spain vs Saudi Arabia/.test(ff.description), 'match-day description names the real fixture');
  assert(!/kickoff \d/.test(ff.description), 'no fabricated kickoff time on a group match');
});

Deno.test('ensure is idempotent — does not double-inject when a fan fest is already present', () => {
  const acts = [{ title: 'FIFA Fan Festival at Centennial Olympic Park', category: 'activity', location: 'Centennial Olympic Park' }];
  const r = ensureHostCityEventExperience(acts, { destination: 'Atlanta', dateISO: '2026-06-21', notes: NOTES });
  assertEquals(r.injected, false);
  assertEquals(r.activities.length, 1);
});

Deno.test('verified semifinal kickoff IS stated', () => {
  const acts: any[] = [];
  const r = ensureHostCityEventExperience(acts, { destination: 'Atlanta', dateISO: '2026-07-15', notes: NOTES });
  assert(r.injected);
  assert(/15:00 ET/.test(r.activities[0].description), 'verified semifinal kickoff is shown');
});
