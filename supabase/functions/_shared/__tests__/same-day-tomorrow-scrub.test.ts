/**
 * Same-day "tomorrow" copy scrub.
 *
 * COPY ERROR 4A: departure-day checkout/airport-prep cards read
 * "prepare for the 08:00 flight tomorrow" when the flight is the SAME day.
 *
 * See mem://constraints/itinerary/same-day-tomorrow-scrub
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  scrubSameDayTomorrow,
  scrubSameDayTomorrowOnAct,
  isDepartureLogisticsCard,
} from '../prompt-leak-scrub.ts';

Deno.test('scrubSameDayTomorrow rewrites "the 08:00 flight tomorrow" → "later today"', () => {
  const out = scrubSameDayTomorrow(
    'After checkout, prepare for the 08:00 flight tomorrow.',
  );
  assertEquals(out, 'After checkout, prepare for the 08:00 flight later today.');
});

Deno.test('scrubSameDayTomorrow rewrites "flight tomorrow morning" → "this morning"', () => {
  const out = scrubSameDayTomorrow('Leave by 06:00 for the flight tomorrow morning.');
  assertEquals(out, 'Leave by 06:00 for the flight this morning.');
});

Deno.test("scrubSameDayTomorrow rewrites possessive \"tomorrow morning's flight\"", () => {
  const out = scrubSameDayTomorrow("Pack tonight for tomorrow morning's 08:00 flight.");
  assertEquals(out, "Pack tonight for this morning's 08:00 flight.");
});

Deno.test("scrubSameDayTomorrow rewrites bare \"tomorrow's flight\" → \"today's flight\"", () => {
  const out = scrubSameDayTomorrow("Confirm tomorrow's flight on the airline app.");
  assertEquals(out, "Confirm today's flight on the airline app.");
});

Deno.test('scrubSameDayTomorrow rewrites trailing "… tomorrow." → "… later today."', () => {
  const out = scrubSameDayTomorrow('Settle the bill tomorrow.');
  assertEquals(out, 'Settle the bill later today.');
});

Deno.test('scrubSameDayTomorrowOnAct mutates description in place', () => {
  const act = {
    title: 'Checkout & airport transfer',
    description: 'Allow 90 minutes for the 08:00 flight tomorrow.',
    tips: "Don't forget tomorrow morning's bag drop.",
  };
  const res = scrubSameDayTomorrowOnAct(act);
  assertEquals(res.changed, true);
  assertEquals(res.fields.sort(), ['description', 'tips']);
  assertEquals(act.description, 'Allow 90 minutes for the 08:00 flight later today.');
  assertEquals(act.tips, "Don't forget this morning's bag drop.");
});

Deno.test('scrubSameDayTomorrowOnAct no-op when "tomorrow" absent', () => {
  const act = { title: 'Checkout', description: 'Drop bags at the desk.' };
  const res = scrubSameDayTomorrowOnAct(act);
  assertEquals(res.changed, false);
  assertEquals(act.description, 'Drop bags at the desk.');
});

Deno.test('isDepartureLogisticsCard recognises checkout / transfer / flight titles', () => {
  assertEquals(isDepartureLogisticsCard({ title: 'Hotel Checkout' }), true);
  assertEquals(isDepartureLogisticsCard({ title: 'Airport Transfer to KIX' }), true);
  assertEquals(isDepartureLogisticsCard({ title: 'Flight to LHR' }), true);
  assertEquals(isDepartureLogisticsCard({ title: 'Lunch at Sukiyabashi Jiro' }), false);
  assertEquals(isDepartureLogisticsCard({ title: 'Return to Park Hyatt' }), false);
});
