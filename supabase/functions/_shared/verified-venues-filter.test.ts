import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { filterVenuesByDestination } from './verified-venues-filter.ts';

// The cross-city filter is intentionally country-scoped: for a "Venice, Italy"
// destination it only flags *other Italian* cities (the real hallucination it
// guards against — a famous venue assigned to the wrong city within the same
// country). Foreign-country venues (Paris/France, San Francisco/US) are out of
// scope and pass through untouched. This test exercises the in-scope behavior:
// multiple Italian cross-city venues are dropped, the Venice one is kept.
Deno.test('filterVenuesByDestination: Venice destination drops other Italian cities', () => {
  const venues = [
    { name: "All'Antico Vinaio", address: 'Via dei Neri, Florence', city: 'Florence' },
    { name: 'Roscioli', address: 'Via dei Giubbonari, Roma', city: 'Rome' },
    { name: 'Trattoria Milanese', address: 'Via Santa Marta, Milano', city: 'Milan' },
    { name: "Osteria alle Testiere", address: 'Calle del Mondo Novo, Venezia', city: 'Venice' },
  ];
  const out = filterVenuesByDestination(venues, 'Venice, Italy');
  assertEquals(out.length, 1);
  assertEquals(out[0].name, 'Osteria alle Testiere');
});

Deno.test('filterVenuesByDestination: Bologna destination drops Rome and Florence', () => {
  const venues = [
    { name: 'Some Roma place', address: 'Via Roma, Rome', city: 'Rome' },
    { name: 'A Florence spot', address: 'Florence', city: 'Florence' },
    { name: 'Trattoria Anna Maria', address: 'Via delle Belle Arti, Bologna', city: 'Bologna' },
  ];
  // Bologna is in italy token list, so cross-city filter is active.
  const out = filterVenuesByDestination(venues, 'Bologna, Italy');
  assertEquals(out.length, 1);
  assertEquals(out[0].name, 'Trattoria Anna Maria');
});

Deno.test('filterVenuesByDestination: same-city rows pass through', () => {
  const venues = [
    { name: 'Caffe', address: 'Paris', city: 'Paris' },
    { name: 'Bistro', address: '10 Rue X, Paris', city: 'Paris' },
  ];
  const out = filterVenuesByDestination(venues, 'Paris, France');
  assertEquals(out.length, 2);
});

Deno.test('filterVenuesByDestination: empty/missing destination is permissive', () => {
  const venues = [{ name: 'X', address: 'somewhere' }];
  assertEquals(filterVenuesByDestination(venues, '').length, 1);
  assertEquals(filterVenuesByDestination(null, 'Venice').length, 0);
});
