/**
 * Regression: vague chips like "sushi lunch" (no time, no named venue) must
 * become soft `should`/unlocked intents, not hard locks. Hard locks require
 * either an explicit startTime or a proper-noun venue in the title/venueName.
 */
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { intentsFromUserAnchors } from './intent-normalizers.ts';

Deno.test('intentsFromUserAnchors: "sushi lunch" with no time/venue → soft should', () => {
  const [intent] = intentsFromUserAnchors([
    { dayNumber: 2, title: 'sushi lunch' },
  ]);
  assertEquals(intent.priority, 'should');
  assertEquals(intent.locked, false);
  assertEquals(intent.lockedSource ?? null, null);
});

Deno.test('intentsFromUserAnchors: timed "7:30 PM Dinner" → hard must locked', () => {
  const [intent] = intentsFromUserAnchors([
    { dayNumber: 2, title: 'Dinner', startTime: '19:30', lockedSource: 'manual_paste:dinner' },
  ]);
  assertEquals(intent.priority, 'must');
  assertEquals(intent.locked, true);
});

Deno.test('intentsFromUserAnchors: named venue "Sukiyabashi Jiro" without time → hard must locked', () => {
  const [intent] = intentsFromUserAnchors([
    { dayNumber: 3, title: 'Lunch at Sukiyabashi Jiro', lockedSource: 'chat:jiro' },
  ]);
  assertEquals(intent.priority, 'must');
  assertEquals(intent.locked, true);
});

Deno.test('intentsFromUserAnchors: vague "spa" → soft should', () => {
  const [intent] = intentsFromUserAnchors([
    { dayNumber: 1, title: 'spa' },
  ]);
  assertEquals(intent.priority, 'should');
  assertEquals(intent.locked, false);
});
