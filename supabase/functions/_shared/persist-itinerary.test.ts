import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { stripPromptArtifactsInTitles, persistTripItinerary } from './persist-itinerary.ts';

Deno.test('stripPromptArtifactsInTitles removes (slot) and (AESTHETIC slot)', () => {
  const days = [
    {
      dayNumber: 1,
      activities: [
        { title: 'Dinner (AESTHETIC slot)' },
        { title: 'Cicchetti tour (slot)' },
        { title: 'Doge\'s Palace' },
      ],
    },
  ];
  const touched = stripPromptArtifactsInTitles(days);
  assertEquals(touched, 2);
  assertEquals(days[0].activities[0].title, 'Dinner');
  assertEquals(days[0].activities[1].title, 'Cicchetti tour');
  assertEquals(days[0].activities[2].title, 'Doge\'s Palace');
});

Deno.test('stripPromptArtifactsInTitles leaves bare "(slot)" alone (contract drops it)', () => {
  const days = [{ dayNumber: 1, activities: [{ title: '(slot)' }] }];
  stripPromptArtifactsInTitles(days);
  // strip leaves it because cleaned is empty -> not assigned
  assertEquals(days[0].activities[0].title, '(slot)');
});

Deno.test('persistTripItinerary calls trips.update with cleaned days', async () => {
  let updated: any = null;
  const fakeSb = {
    from(_t: string) {
      return {
        update(payload: any) {
          updated = payload;
          return { eq: (_c: string, _v: any) => Promise.resolve({ error: null }) };
        },
      };
    },
  };
  const itinerary = {
    days: [
      {
        dayNumber: 1,
        cityName: 'Venice',
        activities: [
          { title: 'Dinner (AESTHETIC slot)', startTime: '19:00', category: 'dining' },
          { title: 'Spa Time — find a venue', startTime: '15:00', category: 'wellness' },
          { title: 'Doge\'s Palace', startTime: '10:00', category: 'sightseeing' },
        ],
      },
    ],
  };
  const { error } = await persistTripItinerary(fakeSb as any, 't1', itinerary, {
    destination: 'Venice',
    label: 'test',
  });
  assertEquals(error, null);
  const days = updated.itinerary_data.days;
  // Dinner kept (artifact stripped), Spa placeholder dropped, Doge kept
  assertEquals(days[0].activities.length, 2);
  assertEquals(days[0].activities[0].title, 'Dinner');
  assertEquals(days[0].activities[1].title, 'Doge\'s Palace');
});
