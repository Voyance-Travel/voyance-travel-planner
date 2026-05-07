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
