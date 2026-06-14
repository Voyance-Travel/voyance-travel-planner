import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { scrubNextDayTipLeak } from './sanitization.ts';

Deno.test('cuts next-day "Wake HH:MM …" scaffolding from a tip', () => {
  const acts = [{ title: 'Biltmore Bar', tip: "Ask about the building's history as a radio center. Wake 08:30. Breakfast at West Egg Café (10 min drive, ~$15)." }];
  const n = scrubNextDayTipLeak(acts);
  assertEquals(n, 1);
  assertEquals(acts[0].tip, "Ask about the building's history as a radio center");
  assert(!/wake|west egg/i.test(acts[0].tip));
});

Deno.test('leaves a clean tip untouched', () => {
  const acts = [{ title: 'X', insiderTip: 'Try the fried chicken; the 1947 recipe is the signature.' }];
  assertEquals(scrubNextDayTipLeak(acts), 0);
});
