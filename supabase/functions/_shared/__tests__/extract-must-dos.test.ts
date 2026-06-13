import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  extractMustDoVenues,
  extractMustDoExperiences,
  __test__,
} from '../extract-must-dos.ts';

const meta = (mustDoActivities: any) => ({ mustDoActivities });

Deno.test('experience phrase: "Watch the sunset…" excluded from venues', () => {
  const m = meta('Watch the sunset from a rooftop overlooking the Bosphorus');
  assertEquals(extractMustDoVenues(m), []);
  assertEquals(extractMustDoExperiences(m), [
    'Watch the sunset from a rooftop overlooking the Bosphorus',
  ]);
});

Deno.test('venue: "Hagia Sophia" classified as venue', () => {
  const m = meta('Hagia Sophia');
  assertEquals(extractMustDoVenues(m), ['Hagia Sophia']);
  assertEquals(extractMustDoExperiences(m), []);
});

Deno.test('mixed: venue + experience separated', () => {
  const m = meta(['Hagia Sophia', 'Watch the sunset over the Bosphorus']);
  assertEquals(extractMustDoVenues(m), ['Hagia Sophia']);
  assertEquals(extractMustDoExperiences(m), [
    'Watch the sunset over the Bosphorus',
  ]);
});

Deno.test('proper noun present: "Trevi Fountain at sunset" stays a venue', () => {
  const m = meta('Trevi Fountain at sunset');
  assertEquals(extractMustDoVenues(m), ['Trevi Fountain at sunset']);
  assertEquals(extractMustDoExperiences(m), []);
});

Deno.test('experience verb wins even with proper noun ("Watch sunset at Trevi")', () => {
  // Verb-first descriptive — gate can't reliably match it, treat as experience.
  const m = meta('Watch sunset at Trevi');
  assertEquals(extractMustDoVenues(m), []);
  assertEquals(extractMustDoExperiences(m), ['Watch sunset at Trevi']);
});

Deno.test('long phrase without proper noun → experience', () => {
  const m = meta('explore the colorful local markets and find hidden cafes');
  assertEquals(extractMustDoVenues(m), []);
  assertEquals(extractMustDoExperiences(m).length, 1);
});

Deno.test('Day-N prefix stripped before classification', () => {
  const m = meta('Day 2: Hagia Sophia');
  assertEquals(extractMustDoVenues(m), ['Hagia Sophia']);
});

Deno.test('isExperiencePhrase unit cases', () => {
  const { isExperiencePhrase } = __test__;
  assertEquals(isExperiencePhrase('Hagia Sophia'), false);
  assertEquals(isExperiencePhrase('Watch the sunset'), true);
  assertEquals(isExperiencePhrase('rooftop bar with view'), true); // no proper noun + experience noun
  assertEquals(isExperiencePhrase('Trevi Fountain'), false);
  assertEquals(isExperiencePhrase('Colosseum'), false);
});

// A major event/occasion is the trip's THEME, not a venue to lock as a literal
// activity card ("plan a day in Atlanta for the World Cup" → World Cup is the
// occasion, the real ask is walking around / seeing sights).
Deno.test('event/occasion → soft experience, not a locked venue', () => {
  const m = meta(['the World Cup', 'walk around the sights', 'World of Coca-Cola']);
  assertEquals(extractMustDoVenues(m), ['World of Coca-Cola']);
  assertEquals(extractMustDoExperiences(m).some((s) => /world cup/i.test(s)), true);
  // a real venue alongside an event keeps its venue identity
  assertEquals(extractMustDoVenues(meta(['Wimbledon', 'Tower of London'])), ['Tower of London']);
  const { isExperiencePhrase } = __test__;
  assertEquals(isExperiencePhrase('Olympics'), true);
  assertEquals(isExperiencePhrase('Oktoberfest'), true);
  assertEquals(isExperiencePhrase('World Cup'), true);
  // "walk around" / "check out the sights" are experiences, not venues
  assertEquals(isExperiencePhrase('walk around the sights'), true);
  assertEquals(isExperiencePhrase('check out the sites'), true);
});
