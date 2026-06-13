/**
 * Tests for the grounded vibe-resolver. The model is mocked so we exercise the
 * GROUNDING (the safety layer): parse tolerance, cross-city rejection, filler
 * rejection, dedup, and graceful failure.
 */
import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  parseVibeResponse,
  groundVibeVenues,
  resolveVibeToVenues,
} from '../resolve-vibe-venues.ts';

Deno.test('parseVibeResponse: tolerates code fences + surrounding prose', () => {
  const raw = 'Sure! Here you go:\n```json\n[{"name":"Georgia Aquarium","category":"sightseeing"}]\n```';
  assertEquals(parseVibeResponse(raw), [{ name: 'Georgia Aquarium', neighborhood: undefined, category: 'sightseeing' }]);
});

Deno.test('parseVibeResponse: junk → empty array (no throw)', () => {
  assertEquals(parseVibeResponse('I cannot help with that.'), []);
  assertEquals(parseVibeResponse(''), []);
});

Deno.test('groundVibeVenues: rejects a wrong-city hallucination', () => {
  const venues = [
    { name: 'Georgia Aquarium' },
    { name: 'Liberty Bell, Philadelphia' }, // wrong city for an Atlanta day
  ];
  const out = groundVibeVenues(venues, 'Atlanta, GA');
  assertEquals(out.map((v) => v.name), ['Georgia Aquarium']);
});

Deno.test('groundVibeVenues: rejects generic filler names', () => {
  const venues = [
    { name: 'Ponce City Market' },
    { name: 'downtown activities' },
    { name: 'fun things to do' },
    { name: 'the area' },
  ];
  assertEquals(groundVibeVenues(venues, 'Atlanta').map((v) => v.name), ['Ponce City Market']);
});

Deno.test('groundVibeVenues: dedupes by name', () => {
  const venues = [
    { name: 'World of Coca-Cola' },
    { name: 'world of coca-cola' },
  ];
  assertEquals(groundVibeVenues(venues, 'Atlanta').length, 1);
});

Deno.test('resolveVibeToVenues: end-to-end with a mock model, grounded + capped', async () => {
  const mockModel = (_sys: string, _user: string) => Promise.resolve(
    JSON.stringify([
      { name: 'Centennial Olympic Park', category: 'park' },
      { name: 'World of Coca-Cola', category: 'sightseeing' },
      { name: 'Georgia Aquarium', category: 'sightseeing' },
      { name: 'Eiffel Tower', neighborhood: 'Paris', category: 'landmark' }, // hallucinated wrong city
      { name: 'fun downtown activities' }, // filler
    ]),
  );
  const out = await resolveVibeToVenues({
    destination: 'Atlanta, GA',
    vibe: 'casual walk-around day for the World Cup',
    limit: 3,
    callModel: mockModel,
  });
  assertEquals(out.map((v) => v.name), ['Centennial Olympic Park', 'World of Coca-Cola', 'Georgia Aquarium']);
  assert(out.length <= 3);
});

Deno.test('resolveVibeToVenues: model failure → empty array (safe fallback)', async () => {
  const out = await resolveVibeToVenues({
    destination: 'Atlanta',
    vibe: 'x',
    callModel: () => Promise.reject(new Error('model down')),
  });
  assertEquals(out, []);
});
