/**
 * trip-total-days helper — Bangkok-class regression guard.
 *
 * Locks the canonical "how many days is this trip?" answer so a temporary
 * JSON `days` shrink can never silently rewrite trip duration in the
 * header chip, hotel nights label, departure-day classifier, or bookend
 * injector.
 */
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { dateSpanDays, totalDays } from '../trip-total-days.ts';

Deno.test('dateSpanDays: inclusive span Aug 10 → Aug 13 is 4 days', () => {
  assertEquals(dateSpanDays({ start_date: '2025-08-10', end_date: '2025-08-13' }), 4);
});

Deno.test('dateSpanDays: 1-day trip', () => {
  assertEquals(dateSpanDays({ start_date: '2025-08-10', end_date: '2025-08-10' }), 1);
});

Deno.test('dateSpanDays: missing dates → 0', () => {
  assertEquals(dateSpanDays({}), 0);
  assertEquals(dateSpanDays(null), 0);
});

Deno.test('dateSpanDays: inverted dates → 0 (defensive)', () => {
  assertEquals(dateSpanDays({ start_date: '2025-08-13', end_date: '2025-08-10' }), 0);
});

Deno.test('totalDays: date span wins over short json (Bangkok pattern)', () => {
  assertEquals(totalDays({
    trip: { start_date: '2025-08-10', end_date: '2025-08-13' },
    itineraryDaysTableCount: 4,
    generationTotalDays: 4,
    jsonDaysLength: 1,
  }), 4);
});

Deno.test('totalDays: table count wins when dates missing', () => {
  assertEquals(totalDays({ itineraryDaysTableCount: 4, jsonDaysLength: 1 }), 4);
});

Deno.test('totalDays: json length used as last fallback', () => {
  assertEquals(totalDays({ jsonDaysLength: 3 }), 3);
});

Deno.test('totalDays: returns >= 1 even when every source is missing', () => {
  assertEquals(totalDays({}), 1);
});

Deno.test('totalDays: ignores non-finite / negative values', () => {
  assertEquals(totalDays({
    jsonDaysLength: -5,
    itineraryDaysTableCount: NaN as unknown as number,
    generationTotalDays: 4,
  }), 4);
});
