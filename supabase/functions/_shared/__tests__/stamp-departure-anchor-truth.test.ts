import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  stampDepartureAnchorTruth,
  isDepartureFlightCard,
} from '../stamp-departure-anchor-truth.ts';

Deno.test('stampDepartureAnchorTruth — no-op when not last day', () => {
  const day = { activities: [{ category: 'flight', title: 'Departure Flight', startTime: '01:35', endTime: '02:04' }] };
  const r = stampDepartureAnchorTruth(day, { isLastDay: false, departureTime24: '21:00' });
  assertEquals(r.mutated, false);
  assertEquals(r.action, 'noop_not_last_day');
});

Deno.test('stampDepartureAnchorTruth — no-op when no departure time provided', () => {
  const day = { activities: [{ category: 'flight', title: 'Departure Flight', startTime: '01:35', endTime: '02:04' }] };
  const r = stampDepartureAnchorTruth(day, { isLastDay: true });
  assertEquals(r.mutated, false);
  assertEquals(r.action, 'noop_no_departure_time');
});

Deno.test('stampDepartureAnchorTruth — overwrites hallucinated pre-dawn departure (Dublin trip pattern)', () => {
  const day = {
    activities: [
      { category: 'logistics', title: 'Checkout', startTime: '07:00', endTime: '07:30' },
      {
        category: 'flight',
        title: 'Departure Flight',
        description: 'Board your flight home.',
        startTime: '01:35',
        endTime: '02:04',
      },
    ],
  };
  const r = stampDepartureAnchorTruth(day, {
    isLastDay: true,
    departureTime24: '21:00',
    departureAirport: 'DUB',
    boardingLeadMins: 45,
  });
  assertEquals(r.mutated, true);
  assertEquals(r.action, 'overwrote_departure_anchor');
  assertEquals(r.newStart, '20:15');
  assertEquals(r.newEnd, '21:00');
  const card = day.activities[1] as any;
  assertEquals(card.startTime, '20:15');
  assertEquals(card.endTime, '21:00');
  assertEquals(card.isLocked, true);
  assertEquals(card.lockReason, 'flight-truth');
  assertEquals(card.anchorSource, 'departure-flight');
  assertEquals(card.source, 'stamp-departure-truth');
});

Deno.test('stampDepartureAnchorTruth — idempotent on second call', () => {
  const day = {
    activities: [
      { category: 'flight', title: 'Departure Flight', startTime: '01:35', endTime: '02:04' },
    ],
  };
  const first = stampDepartureAnchorTruth(day, { isLastDay: true, departureTime24: '21:00' });
  assertEquals(first.mutated, true);
  const second = stampDepartureAnchorTruth(day, { isLastDay: true, departureTime24: '21:00' });
  assertEquals(second.mutated, false);
  assertEquals(second.action, 'noop_already_aligned');
});

Deno.test('stampDepartureAnchorTruth — no-op when no departure card present', () => {
  const day = { activities: [{ category: 'dining', title: 'Lunch', startTime: '12:00', endTime: '13:00' }] };
  const r = stampDepartureAnchorTruth(day, { isLastDay: true, departureTime24: '21:00' });
  assertEquals(r.mutated, false);
  assertEquals(r.action, 'noop_no_departure_card');
});

Deno.test('isDepartureFlightCard — detector signals', () => {
  assertEquals(isDepartureFlightCard({ anchorSource: 'departure-flight' }), true);
  assertEquals(isDepartureFlightCard({ tags: ['departure-flight'] }), true);
  assertEquals(isDepartureFlightCard({ category: 'flight', title: 'Departure Flight' }), true);
  assertEquals(isDepartureFlightCard({ category: 'flight', title: 'Return Flight' }), true);
  assertEquals(isDepartureFlightCard({ category: 'flight', title: 'Flight home' }), true);
  assertEquals(isDepartureFlightCard({ category: 'flight', title: 'Flight' }), true);
  assertEquals(isDepartureFlightCard({ category: 'flight', title: 'Arrival Flight' }), false);
  assertEquals(isDepartureFlightCard({ category: 'dining', title: 'Departure Flight' }), false);
});
