/**
 * Regression: a major event woven into a trip must surface as REAL grounded
 * experiences (fan fest / watch party / real venue), NEVER a vague
 * "{event} vibes" fabricated mood card. scrubEventVibeFiller is the
 * deterministic backstop behind the compile-prompt grounded-event block.
 */
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { scrubEventVibeFiller } from './sanitization.ts';

const titles = (acts: any[]) => acts.map((a) => a.title);

Deno.test('relabels "World Cup Fan Vibes at <Venue>" → the real venue', () => {
  const out = scrubEventVibeFiller([
    { title: 'World Cup Fan Vibes at Centennial Olympic Park', category: 'activity' },
  ]);
  assertEquals(out.length, 1);
  assertEquals(out[0].title, 'Centennial Olympic Park');
  assertEquals(out[0].name, 'Centennial Olympic Park');
});

Deno.test('drops a venue-less vague event-vibe card', () => {
  const out = scrubEventVibeFiller([
    { title: 'World Cup vibes downtown', category: 'activity' },
    { title: 'Olympics spirit and energy', category: 'activity' },
  ]);
  assertEquals(out.length, 0);
});

Deno.test('KEEPS concrete, grounded event experiences', () => {
  const acts = [
    { title: 'FIFA Fan Festival at Centennial Olympic Park', category: 'activity' },
    { title: 'Watch the match at The Garden Sports Bar', category: 'activity' },
    { title: 'World Cup match watch party at Hoppin’ Pub', category: 'activity' },
  ];
  const out = scrubEventVibeFiller(acts);
  assertEquals(out.length, 3, 'real fan-fest / watch-party cards must survive');
  assertEquals(titles(out), titles(acts));
});

Deno.test('leaves ordinary non-event activities untouched', () => {
  const acts = [
    { title: 'Visit the Georgia Aquarium', category: 'sightseeing' },
    { title: 'Lunch at Ponce City Market', category: 'dining' },
  ];
  const out = scrubEventVibeFiller(acts);
  assertEquals(out.length, 2);
  assertEquals(titles(out), titles(acts));
});

Deno.test('does not relabel into the event name itself', () => {
  // "... at the World Cup" has no real venue tail → must DROP, not relabel to
  // "the World Cup".
  const out = scrubEventVibeFiller([
    { title: 'Soak up the vibes at the World Cup', category: 'activity' },
  ]);
  assertEquals(out.length, 0);
});
