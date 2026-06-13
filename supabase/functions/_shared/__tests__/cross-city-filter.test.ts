/**
 * Regression tests for the cross-city venue filter — specifically the Portugal
 * support + title scanning added to stop a Porto/Gaia venue leaking onto a
 * Lisbon day (a Porto "Wine Cellars of Vila Nova de Gaia" card on Day 1 of a
 * Lisbon trip).
 */
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { isCrossCityAddress, detectCrossCityMention } from '../cross-city-filter.ts';

Deno.test('Portugal: Gaia venue named only in the TITLE is flagged on a Lisbon day', () => {
  // The venue carries its city only in the title (no address) — title scanning
  // must catch it. Porto's token folds in Vila Nova de Gaia.
  assertEquals(
    isCrossCityAddress({ title: 'Wine Cellars of Vila Nova de Gaia', category: 'activity' }, 'Lisbon, Portugal'),
    'Porto',
  );
});

Deno.test('Portugal: the same Gaia venue is ALLOWED on a Porto day (greater-metro)', () => {
  // Gaia is folded into Porto, so on a Porto day it must NOT be flagged.
  assertEquals(
    isCrossCityAddress({ title: 'Wine Cellars of Vila Nova de Gaia', category: 'activity' }, 'Porto, Portugal'),
    null,
  );
});

Deno.test('Portugal: a Port-wine tasting that names Lisbon stays (dest city present)', () => {
  assertEquals(
    isCrossCityAddress({ title: 'Historical Port Wine Session in Lisbon', category: 'activity' }, 'Lisbon, Portugal'),
    null,
  );
});

Deno.test('Portugal: Lisbon day-trip suburbs (Sintra/Cascais/Belém) allowed on a Lisbon day', () => {
  assertEquals(isCrossCityAddress({ title: 'Pena Palace, Sintra', category: 'sightseeing' }, 'Lisbon, Portugal'), null);
  assertEquals(isCrossCityAddress({ title: 'Boca do Inferno, Cascais', category: 'sightseeing' }, 'Lisbon, Portugal'), null);
});

Deno.test('Portugal: a genuine Porto landmark is flagged on a Lisbon day', () => {
  assertEquals(detectCrossCityMention('Livraria Lello, Porto', 'Lisbon, Portugal'), 'Porto');
});

Deno.test('Portugal: a real Lisbon venue stays on a Lisbon day', () => {
  assertEquals(isCrossCityAddress({ title: 'Tram 28 through Alfama', category: 'sightseeing' }, 'Lisbon, Portugal'), null);
});

Deno.test('Portugal: before the fix inferCountry was null → guard a no-op; now it resolves', () => {
  // Sanity: a Porto venue on a Lisbon day must produce a hit (proves Portugal
  // is wired into inferCountry — the original bug was it returning null).
  assertEquals(detectCrossCityMention('Clérigos Tower, Porto', 'Lisbon, Portugal'), 'Porto');
});

// Existing-country sanity — make sure adding Portugal + title scanning didn't
// regress the original address-based behavior for other countries.
Deno.test('Italy: a Rome venue named in the title is flagged on a Venice day', () => {
  assertEquals(
    isCrossCityAddress({ title: 'Dinner near the Pantheon, Rome', category: 'dining' }, 'Venice, Italy'),
    'Rome',
  );
});

Deno.test('Italy: a Venice venue stays on a Venice day', () => {
  assertEquals(isCrossCityAddress({ title: "St Mark's Basilica", category: 'sightseeing' }, 'Venice, Italy'), null);
});

Deno.test('Unknown country: no false positives (filter is a no-op)', () => {
  assertEquals(detectCrossCityMention('Some Venue, Atlantis', 'Atlantis'), null);
});
