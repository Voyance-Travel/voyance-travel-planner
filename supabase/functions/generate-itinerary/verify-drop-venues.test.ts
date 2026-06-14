import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { shouldDropFromVerdict, isVerifiableVenue, venueNameOf, verifyAndDropVenues } from './verify-drop-venues.ts';

Deno.test('drop matrix: only confident negatives drop; fail-open otherwise', () => {
  assertEquals(shouldDropFromVerdict(null), true);                                   // not-found/geo-reject → drop
  assertEquals(shouldDropFromVerdict({ isValid: false, confidence: 0, errored: true }), false); // couldn't check → KEEP
  assertEquals(shouldDropFromVerdict({ isValid: false, confidence: 0, crossCityHallucination: true } as any), true);
  assertEquals(shouldDropFromVerdict({ isValid: true, confidence: 0.95 }), false);   // confident match → keep
  assertEquals(shouldDropFromVerdict({ isValid: true, confidence: 0.3 }), true);     // low-overlap different venue → drop
  assertEquals(shouldDropFromVerdict({ isValid: false, confidence: 0 }), true);
});

Deno.test('isVerifiableVenue: skips logistics / locked / host-event / generic blocks', () => {
  assert(isVerifiableVenue({ category: 'dining', title: 'Lunch at Foo' }));
  assert(isVerifiableVenue({ category: 'sightseeing', title: 'High Museum of Art' }));
  assertEquals(isVerifiableVenue({ category: 'transport', title: 'Taxi to airport' }), false);
  assertEquals(isVerifiableVenue({ category: 'accommodation', title: 'Check-in' }), false);
  assertEquals(isVerifiableVenue({ category: 'activity', title: 'FIFA Fan Festival', source: 'host-city-event' }), false);
  assertEquals(isVerifiableVenue({ category: 'dining', title: 'Breakfast at your hotel' }), false);
  assertEquals(isVerifiableVenue({ category: 'dining', title: 'Lunch at Foo', locked: true }), false);
});

Deno.test('venueNameOf strips meal/verb prefixes', () => {
  assertEquals(venueNameOf({ title: 'Lunch at Sweet Auburn Curb Market' }), 'Sweet Auburn Curb Market');
  assertEquals(venueNameOf({ title: 'Explore Centennial Olympic Park' }), 'Centennial Olympic Park');
  assertEquals(venueNameOf({ location: { name: 'Paschal’s' }, title: 'Dinner' }), 'Paschal’s');
});

Deno.test('no Google key → keeps everything (fail-open)', async () => {
  const acts = [{ category: 'dining', title: 'Lunch at Fake Place' }];
  const r = await verifyAndDropVenues(acts, { destination: 'Atlanta', supabaseUrl: 'x', supabaseKey: 'y' });
  assertEquals(r.activities.length, 1);
  assertEquals(r.dropped.length, 0);
});

Deno.test('exhausted time budget keeps the remainder (fail-open)', async () => {
  const acts = [{ category: 'dining', title: 'A' }, { category: 'dining', title: 'B' }];
  // nowMs far in the past vs budget 0 → immediately over budget → keep all
  const r = await verifyAndDropVenues(acts, { destination: 'Atlanta', supabaseUrl: 'x', supabaseKey: 'y', googleKey: 'k', timeBudgetMs: 0 });
  assertEquals(r.activities.length, 2);
});
