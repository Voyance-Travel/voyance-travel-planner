import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { stripVenueMealSuffix, stripMealSuffixesInItinerary } from '../venue-name.ts';

Deno.test('strips trailing (Breakfast)', () => {
  assertEquals(
    stripVenueMealSuffix('Sagra Rooftop Restaurant (Breakfast)'),
    'Sagra Rooftop Restaurant',
  );
});

Deno.test('strips (Lunch)/(Dinner)/(Brunch) case-insensitively', () => {
  assertEquals(stripVenueMealSuffix('Mikla Restaurant (Dinner)'), 'Mikla Restaurant');
  assertEquals(stripVenueMealSuffix('Foo (lunch)'), 'Foo');
  assertEquals(stripVenueMealSuffix('Bar (BRUNCH)'), 'Bar');
});

Deno.test('preserves non-meal parentheticals', () => {
  assertEquals(
    stripVenueMealSuffix('Sagrada Família (Exterior)'),
    'Sagrada Família (Exterior)',
  );
  assertEquals(
    stripVenueMealSuffix('Bar Canete (closed Sundays)'),
    'Bar Canete (closed Sundays)',
  );
});

Deno.test('only strips trailing — not mid-string', () => {
  assertEquals(
    stripVenueMealSuffix("(Lunch) Cafe La Place"),
    '(Lunch) Cafe La Place',
  );
});

Deno.test('walks itinerary tree and strips title/name/location.name', () => {
  const itin = {
    days: [{
      activities: [
        { title: 'Lunch at Sagra Rooftop Restaurant', location: { name: 'Sagra Rooftop Restaurant (Breakfast)' } },
        { name: 'Mikla Restaurant (Dinner)' },
        { title: 'Walk' },
      ],
    }],
  };
  const n = stripMealSuffixesInItinerary(itin);
  assertEquals(n, 2);
  assertEquals(itin.days[0].activities[0].location.name, 'Sagra Rooftop Restaurant');
  assertEquals(itin.days[0].activities[1].name, 'Mikla Restaurant');
});
