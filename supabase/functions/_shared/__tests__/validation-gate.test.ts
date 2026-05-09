// Tests for the Semantic Validation Gate.
// Covers the 4 new semantic checks + cross-day checkout/hotel leak,
// and the gate's in-place downgrade behavior.

import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { validateDay } from '../../generate-itinerary/pipeline/validate-day.ts';
import { applyValidationGate } from '../../generate-itinerary/pipeline/validation-gate.ts';
import { FAILURE_CODES } from '../../generate-itinerary/pipeline/types.ts';

function makeDay(activities: any[]): any {
  return { dayNumber: 2, date: '2026-05-12', title: 'Test', activities };
}

function baseInput(activities: any[], previousDays: any[] = []): any {
  return {
    day: makeDay(activities),
    dayNumber: 2,
    isFirstDay: false,
    isLastDay: false,
    totalDays: 4,
    hasHotel: true,
    hotelName: 'Hotel Cipriani',
    requiredMeals: [],
    previousDays,
    destination: 'Venice, Italy',
  };
}

Deno.test('PUNCTUATION_ONLY_FIELD: dot-only reservationUrgency → critical', () => {
  const acts = [{
    id: 'a1', title: 'Dinner at Da Ivo', startTime: '20:00', endTime: '22:00',
    category: 'dining', location: { name: 'Da Ivo' }, reservationUrgency: '.',
  }];
  const results = validateDay(baseInput(acts));
  const hit = results.find(r => r.code === FAILURE_CODES.PUNCTUATION_ONLY_FIELD);
  assert(hit, 'expected PUNCTUATION_ONLY_FIELD');
  assertEquals(hit!.severity, 'critical');
});

Deno.test('Gate: blanks punctuation-only field on persist_forced', () => {
  const acts = [{
    id: 'a1', title: 'Dinner at Da Ivo', startTime: '20:00', endTime: '22:00',
    category: 'dining', location: { name: 'Da Ivo' }, reservationUrgency: '.',
  }];
  const results = validateDay(baseInput(acts));
  const day = makeDay(acts);
  const gate = applyValidationGate(day, results, { dayNumber: 2, destination: 'Venice' });
  assertEquals(gate.verdict, 'persist_forced');
  assertEquals((day.activities[0] as any).reservationUrgency, '');
  assertEquals(gate.counters.blankedFields, 1);
});

Deno.test('TRUNCATED_SENTENCE: mid-sentence cutoff in description → error', () => {
  const acts = [{
    id: 'a1', title: 'Wine tasting', startTime: '15:00', endTime: '17:00',
    category: 'activity', location: { name: 'Cantina' },
    description: 'A relaxed tasting in a quiet cellar near the canal — ideal with for both',
  }];
  const results = validateDay(baseInput(acts));
  const hit = results.find(r => r.code === FAILURE_CODES.TRUNCATED_SENTENCE);
  assert(hit, 'expected TRUNCATED_SENTENCE');
  assertEquals(hit!.severity, 'error');
});

Deno.test('TRUNCATED_SENTENCE: complete sentence does NOT flag', () => {
  const acts = [{
    id: 'a1', title: 'Wine tasting', startTime: '15:00', endTime: '17:00',
    category: 'activity', location: { name: 'Cantina' },
    description: 'A relaxed tasting in a quiet cellar near the canal, ideal for couples.',
  }];
  const results = validateDay(baseInput(acts));
  assertEquals(results.find(r => r.code === FAILURE_CODES.TRUNCATED_SENTENCE), undefined);
});

Deno.test('SUSPICIOUS_DUPLICATE_PRICE: identical adjacent dining costs → warning', () => {
  const acts = [
    { id: 'a1', title: 'Lunch', startTime: '13:00', endTime: '14:30',
      category: 'dining', location: { name: 'Trattoria' },
      cost: { amount: 58, currency: 'EUR' } },
    { id: 'a2', title: 'Dinner', startTime: '20:00', endTime: '22:00',
      category: 'dining', location: { name: 'Osteria' },
      cost: { amount: 58, currency: 'EUR' } },
  ];
  const results = validateDay(baseInput(acts));
  const hit = results.find(r => r.code === FAILURE_CODES.SUSPICIOUS_DUPLICATE_PRICE);
  assert(hit, 'expected SUSPICIOUS_DUPLICATE_PRICE');
  assertEquals(hit!.severity, 'warning');
});

Deno.test('SUSPICIOUS_DUPLICATE_PRICE: bar_cap_repair source is exempt', () => {
  const acts = [
    { id: 'a1', title: 'Drinks', startTime: '18:00', endTime: '19:00',
      category: 'dining', location: { name: 'Bar A' },
      cost: { amount: 25, currency: 'EUR', source: 'bar_cap_repair' } },
    { id: 'a2', title: 'Nightcap', startTime: '22:00', endTime: '23:00',
      category: 'dining', location: { name: 'Bar B' },
      cost: { amount: 25, currency: 'EUR', source: 'bar_cap_repair' } },
  ];
  const results = validateDay(baseInput(acts));
  assertEquals(results.find(r => r.code === FAILURE_CODES.SUSPICIOUS_DUPLICATE_PRICE), undefined);
});

Deno.test('CHECKOUT_HOTEL_LEAK: previous-day checkout + current-day hotel spa → critical', () => {
  const prevDay = {
    dayNumber: 1, date: '2026-05-11', title: 'Day 1',
    activities: [
      { id: 'p1', title: 'Hotel Checkout', startTime: '17:50', endTime: '18:00', category: 'accommodation', location: { name: 'Hotel Cipriani' } },
    ],
  };
  const acts = [
    { id: 'a1', title: 'Hotel Spa session', startTime: '19:30', endTime: '21:00',
      category: 'wellness', location: { name: 'Hotel Cipriani Spa' } },
  ];
  const results = validateDay(baseInput(acts, [prevDay]));
  const hit = results.find(r => r.code === FAILURE_CODES.CHECKOUT_HOTEL_LEAK);
  assert(hit, 'expected CHECKOUT_HOTEL_LEAK');
  assertEquals(hit!.severity, 'critical');
});

Deno.test('Gate: drops CHECKOUT_HOTEL_LEAK activities in place', () => {
  const prevDay = {
    dayNumber: 1, date: '2026-05-11', title: 'Day 1',
    activities: [
      { id: 'p1', title: 'Hotel Checkout', startTime: '17:50', endTime: '18:00', category: 'accommodation', location: { name: 'Hotel Cipriani' } },
    ],
  };
  const acts = [
    { id: 'a1', title: 'Morning walk', startTime: '09:00', endTime: '10:00', category: 'activity', location: { name: 'Piazza San Marco' } },
    { id: 'a2', title: 'Hotel Spa session', startTime: '19:30', endTime: '21:00', category: 'wellness', location: { name: 'Hotel Cipriani Spa' } },
  ];
  const results = validateDay(baseInput(acts, [prevDay]));
  const day = makeDay(acts);
  const gate = applyValidationGate(day, results, { dayNumber: 2, destination: 'Venice' });
  assertEquals(gate.verdict, 'persist_forced');
  assertEquals(day.activities.length, 1);
  assertEquals((day.activities[0] as any).id, 'a1');
  assertEquals(gate.counters.droppedActivities, 1);
});

Deno.test('Gate: no critical → persist verdict, no mutation', () => {
  const acts = [{
    id: 'a1', title: 'Lunch at Antiche Carampane', startTime: '13:00', endTime: '14:30',
    category: 'dining', location: { name: 'Antiche Carampane' },
    description: 'Classic Venetian seafood near the Rialto.',
  }];
  const results = validateDay(baseInput(acts));
  const day = makeDay(acts);
  const before = JSON.stringify(day.activities);
  const gate = applyValidationGate(day, results, { dayNumber: 2, destination: 'Venice' });
  assertEquals(gate.verdict, 'persist');
  assertEquals(JSON.stringify(day.activities), before);
});
