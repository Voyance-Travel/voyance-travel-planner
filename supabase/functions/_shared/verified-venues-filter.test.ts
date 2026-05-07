import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { filterVenuesByDestination } from './verified-venues-filter.ts';

Deno.test('filterVenuesByDestination: Venice destination drops Florence/Paris/SF', () => {
  const venues = [
    { name: "All'Antico Vinaio", address: 'Via dei Neri, Florence', city: 'Florence' },
    { name: 'Le Comptoir du Relais', address: '9 Carrefour de l\'Odéon, Paris', city: 'Paris' },
    { name: 'Tartine Bakery', address: '600 Guerrero St, San Francisco', city: 'San Francisco' },
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
