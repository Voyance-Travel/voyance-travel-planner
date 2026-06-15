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

Deno.test('UPGRADES a bare "Centennial Olympic Park" card to the real Fan Festival (keeps its slot)', () => {
  const acts = [{ title: 'Explore Centennial Olympic Park', category: 'sightseeing', startTime: '14:30', endTime: '16:30', location: 'Centennial Olympic Park' }];
  const r = ensureHostCityEventExperience(acts, { destination: 'Atlanta', dateISO: '2026-06-21', notes: NOTES });
  assert(r.injected);
  assertEquals(r.activities.length, 1, 'upgraded in place, not added');
  assert(/fan festival/i.test(r.activities[0].title), `got "${r.activities[0].title}"`);
  assert(/Centennial Olympic Park/i.test(r.activities[0].location), 'kept the real venue');
  assert(/Spain vs Saudi Arabia|Jumbotron|fan zone/i.test(r.activities[0].description), 'has the real what-is-there description');
  assertEquals(r.activities[0].startTime, '14:30', 'kept the model time slot');
});

Deno.test('UPGRADES a wrong-venue fan fest (GWCC) to the curated Centennial venue', () => {
  const acts = [{ title: 'FIFA Fan Fest at Georgia World Congress Center', category: 'activity', startTime: '15:00', endTime: '17:00', location: 'Georgia World Congress Center' }];
  const r = ensureHostCityEventExperience(acts, { destination: 'Atlanta, GA', dateISO: '2026-06-21', notes: NOTES });
  assert(r.injected);
  assertEquals(r.activities.length, 1);
  assert(/Centennial Olympic Park/i.test(`${r.activities[0].title} ${r.activities[0].location}`), 'moved to the real Fan Fest venue');
  assert(!/Georgia World Congress/i.test(`${r.activities[0].title} ${r.activities[0].location}`), 'hallucinated venue gone');
});

Deno.test('a TRANSIT card through the venue does NOT suppress the injection (Run-2 bug)', () => {
  // "Taxi through Centennial Olympic Park" mentions the venue but is not the
  // event experience — the Fan Festival must still be guaranteed.
  const acts = [{ title: 'Taxi through Centennial Olympic Park', category: 'transport', location: 'Centennial Olympic Park' }];
  const r = ensureHostCityEventExperience(acts, { destination: 'Atlanta, GA', dateISO: '2026-06-21', notes: NOTES });
  assert(r.injected, 'a transit pass-through must not block the deterministic injection');
  assert(r.activities.some((a) => /fan festival/i.test(a.title)), 'fan festival injected');
});

Deno.test('a real "Fan Zone … Centennial Park" card (token-tolerant) IS recognized, no double-inject', () => {
  // "Centennial Park" (missing "Olympic") must still match "Centennial Olympic
  // Park" so we do not inject a near-duplicate (Run-1 issue).
  const acts = [{ title: 'World Cup Fan Zone Walk in Centennial Park', category: 'activity' }];
  const r = ensureHostCityEventExperience(acts, { destination: 'Atlanta', dateISO: '2026-06-21', notes: NOTES });
  assertEquals(r.injected, false, 'an existing fan-zone card at the park suppresses a duplicate injection');
});

Deno.test('injected event card never overlaps an existing activity (timeline integrity)', () => {
  const pm = (s: string) => { const m = s.match(/(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : 0; };
  // A day where the model already scheduled something across the fan-fest's
  // preferred 15:30 slot (the real failure: fan fest overlapped High Museum).
  const acts = [
    { title: 'Breakfast', category: 'dining', startTime: '08:30', endTime: '09:45' },
    { title: 'MLK Park', category: 'cultural', startTime: '10:05', endTime: '12:35' },
    { title: 'Lunch', category: 'dining', startTime: '12:55', endTime: '14:10' },
    { title: 'BeltLine', category: 'activity', startTime: '14:30', endTime: '16:30' },
    { title: 'High Museum of Art', category: 'cultural', startTime: '16:45', endTime: '18:45' },
    { title: 'Dinner at Paschal’s', category: 'dining', startTime: '20:20', endTime: '22:20' },
  ];
  const r = ensureHostCityEventExperience(acts, { destination: 'Atlanta', dateISO: '2026-06-21', notes: NOTES });
  assert(r.injected);
  const blocks = r.activities.map((a: any) => [pm(a.startTime), pm(a.endTime)]).sort((x, y) => x[0] - y[0]);
  for (let i = 1; i < blocks.length; i++) {
    assert(blocks[i][0] >= blocks[i - 1][1], `overlap: block starting ${blocks[i][0]} begins before previous ends ${blocks[i - 1][1]}`);
  }
});

Deno.test('verified semifinal kickoff IS stated', () => {
  const acts: any[] = [];
  const r = ensureHostCityEventExperience(acts, { destination: 'Atlanta', dateISO: '2026-07-15', notes: NOTES });
  assert(r.injected);
  assert(/15:00 ET/.test(r.activities[0].description), 'verified semifinal kickoff is shown');
});

// ── Recurring mega-events ───────────────────────────────────────────────────

Deno.test('Oktoberfest — Munich in-window injects Theresienwiese', () => {
  const r = ensureHostCityEventExperience([], { destination: 'Munich, Germany', dateISO: '2026-09-25', notes: 'here for Oktoberfest' });
  assert(r.injected);
  assertEquals(r.event!.id, 'oktoberfest-munich-2026');
  assertEquals(r.activities[0].location, 'Theresienwiese');
  assertEquals(r.activities[0].startTime, '13:00');
});

Deno.test('Mardi Gras — New Orleans Fat Tuesday injects St. Charles parades', () => {
  const r = ensureHostCityEventExperience([], { destination: 'New Orleans, LA', dateISO: '2027-02-09', notes: 'in town for Mardi Gras' });
  assert(r.injected);
  assertEquals(r.event!.id, 'mardigras-neworleans-2027');
  assert(/St\. Charles/i.test(r.activities[0].title));
});

Deno.test('NYC Marathon — race day injects a First Avenue spectating spot (morning slot)', () => {
  const r = ensureHostCityEventExperience([], { destination: 'New York, NY', dateISO: '2026-11-01', notes: 'watching the marathon' });
  assert(r.injected);
  assertEquals(r.event!.id, 'nyc-marathon-2026');
  assertEquals(r.activities[0].startTime, '10:30');
});

Deno.test('marathon keyword does NOT fire in a non-host city', () => {
  assertEquals(findHostCityEvent('Boston, MA', '2026-11-01', 'running the marathon'), null);
});

Deno.test('Oktoberfest does NOT fire off-window (e.g. a July Munich trip)', () => {
  assertEquals(findHostCityEvent('Munich', '2026-07-10', 'Oktoberfest vibes'), null);
});
