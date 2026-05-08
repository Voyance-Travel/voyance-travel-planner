import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { enforcePersistDayContract, PLACEHOLDER_NAME_RE } from './persist-day-contract.ts';

Deno.test('drops ghost 00:15 hotel-return row', () => {
  const acts = [
    { title: 'Return to Your Hotel', startTime: '00:15', category: 'accommodation' },
    { title: 'Doge\'s Palace', startTime: '10:00', category: 'sightseeing' },
  ];
  const { activities, drops } = enforcePersistDayContract(acts);
  assertEquals(activities.length, 1);
  assertEquals(drops[0].reason, 'ghost-row');
});

Deno.test('drops "Spa Time — find a venue"', () => {
  const acts = [{ title: 'Spa Time — find a venue', startTime: '15:00', category: 'wellness' }];
  const { activities, drops } = enforcePersistDayContract(acts);
  assertEquals(activities.length, 0);
  assertEquals(drops[0].reason, 'placeholder-name');
});

Deno.test('drops prompt artifact "(AESTHETIC slot)"', () => {
  const acts = [{ title: 'Dinner (AESTHETIC slot)', startTime: '19:00', category: 'dining' }];
  const { activities, drops } = enforcePersistDayContract(acts);
  assertEquals(activities.length, 0);
  assertEquals(drops[0].reason, 'prompt-artifact');
});

Deno.test('drops bare ALLCAPS-with-underscore token "(FLEX_WINDOW)"', () => {
  const acts = [{ title: 'Open Afternoon - Wander Castello (FLEX_WINDOW)', startTime: '14:00', category: 'activity' }];
  const { activities, drops } = enforcePersistDayContract(acts);
  assertEquals(activities.length, 0);
  assertEquals(drops[0].reason, 'prompt-artifact');
});

Deno.test('does NOT drop legit acronyms in parens like (NYC)', () => {
  const acts = [{ title: 'Visit MoMA (NYC)', startTime: '11:00', category: 'museum' }];
  const { activities } = enforcePersistDayContract(acts);
  assertEquals(activities.length, 1);

Deno.test('drops "find a local spot"', () => {
  const acts = [{ title: 'Lunch — find a local spot', startTime: '12:30', category: 'dining' }];
  const { activities, drops } = enforcePersistDayContract(acts);
  assertEquals(activities.length, 0);
});

Deno.test('NEVER drops locked rows', () => {
  const acts = [
    { title: 'Return to Hotel', startTime: '00:15', category: 'accommodation', locked: true },
    { title: 'find a venue', startTime: '15:00', category: 'wellness', source: 'user' },
  ];
  const { activities, drops } = enforcePersistDayContract(acts);
  assertEquals(activities.length, 2);
  assertEquals(drops.length, 0);
});

Deno.test('passes legitimate 10am sightseeing', () => {
  const acts = [{ title: "Doge's Palace Tour", startTime: '10:00', category: 'sightseeing' }];
  const { activities } = enforcePersistDayContract(acts);
  assertEquals(activities.length, 1);
});

Deno.test('PLACEHOLDER_NAME_RE matches all known leak patterns', () => {
  const cases = [
    'Spa Time — find a venue',
    'Lunch — find a local spot',
    'Lunch — find a local spot in the destination',
    'Dinner — find a local spot in Venice',
    'Pick a local spot for lunch',
    'Dinner (slot)',
    'Activity (AESTHETIC slot)',
    'Restaurant TBD',
    'placeholder',
    'needsVenuePick',
  ];
  for (const c of cases) {
    if (!PLACEHOLDER_NAME_RE.test(c)) throw new Error(`Did not match: ${c}`);
  }
});

Deno.test('drops Day 2 12:15 AM hotel bleed variants', () => {
  const variants = [
    'Return to the hotel',
    'Return to Four Seasons Hotel',
    'Return to your hotel',
    'Back to the hotel',
    'Head back to your hotel',
  ];
  for (const title of variants) {
    const acts = [{ title, startTime: '00:15', category: 'accommodation' }];
    const { activities } = enforcePersistDayContract(acts);
    if (activities.length !== 0) throw new Error(`Did not drop: ${title}`);
  }
});

Deno.test('drops placeholder leaked into venue_name field (not title)', () => {
  const acts = [
    { title: 'Lunch at trattoria', venue_name: 'find a local spot in the destination', startTime: '12:30', category: 'dining' },
  ];
  const { activities, drops } = enforcePersistDayContract(acts);
  assertEquals(activities.length, 0);
  assertEquals(drops[0].reason, 'placeholder-name');
});

Deno.test('drops prompt artifact leaked into description (not title)', () => {
  const acts = [
    { title: 'Dinner at Osteria', description: 'A relaxed evening (AESTHETIC slot) with locals', startTime: '19:30', category: 'dining' },
  ];
  const { activities, drops } = enforcePersistDayContract(acts);
  assertEquals(activities.length, 0);
  assertEquals(drops[0].reason, 'prompt-artifact');
});
