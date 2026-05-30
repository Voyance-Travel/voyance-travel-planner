/**
 * Executioner — post-checkin "Return to Hotel" loop drop (Pass 5a-bis).
 *
 * Closes: AI emits "Return to your hotel" mid-afternoon on arrival day
 * after the check-in card. Legit end-of-day hotel-return bookends
 * (source: 'bookend-*' / 'late_nightlife_bookend' / start ≥18:00) are
 * preserved verbatim.
 */
import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { runScheduleExecutioner } from '../schedule-executioner.ts';

function baseCtx(over: Record<string, unknown> = {}) {
  return {
    dayNumber: 1,
    totalDays: 5,
    isFirstDay: true,
    isLastDay: false,
    arrivalTime24: '14:00',
    departureTime24: null,
    dayTitle: 'Arrival in Venice',
    budgetTier: 'luxury',
    geoFlagOnly: true,
    geoDropEnabled: false,
    ...over,
  } as any;
}

Deno.test('HOTEL_RETURN_LOOP — drops mid-day return after checkin, preserves evening bookend', () => {
  const acts = [
    { id: 'a1', title: 'Arrival Flight', startTime: '14:00', endTime: '14:30', anchorSource: 'arrival-flight', category: 'flight' },
    { id: 'a2', title: 'Airport Transfer', startTime: '14:30', endTime: '15:30', anchorSource: 'airport-transfer', category: 'transit' },
    { id: 'a3', title: 'Check-in at Gritti Palace', startTime: '16:00', endTime: '16:30', category: 'accommodation' },
    { id: 'a4', title: 'Return to your hotel', startTime: '17:30', endTime: '17:45', category: 'accommodation' },
    { id: 'a5', title: 'Dinner at Da Ivo', startTime: '19:30', endTime: '21:00', category: 'dining' },
    { id: 'a6', title: 'Return to Gritti Palace', startTime: '22:30', endTime: '23:30', category: 'accommodation', source: 'bookend-readtime' },
  ];
  const res = runScheduleExecutioner(acts, baseCtx());
  const ids = res.activities.map((a: any) => a.id);
  assertEquals(ids.includes('a4'), false, 'mid-day return should be dropped');
  assertEquals(ids.includes('a6'), true, 'end-of-day bookend should be preserved');
  assertEquals(res.counters.hotelReturnLoopsDropped, 1);
});

Deno.test('HOTEL_RETURN_LOOP — branded hotel via hotelName context', () => {
  const acts = [
    { id: 'a1', title: 'Check-in', startTime: '16:30', endTime: '17:00', category: 'accommodation' },
    { id: 'a2', title: 'Head back to Aman Venice', startTime: '17:00', endTime: '17:15', category: 'transit' },
  ];
  const res = runScheduleExecutioner(acts, baseCtx({ hotelName: 'Aman Venice' }));
  assertEquals(res.activities.map((a: any) => a.id).includes('a2'), false);
  assertEquals(res.counters.hotelReturnLoopsDropped, 1);
});

Deno.test('HOTEL_RETURN_LOOP — locked user pin preserved', () => {
  const acts = [
    { id: 'a1', title: 'Check-in', startTime: '16:00', endTime: '16:30', category: 'accommodation' },
    { id: 'a2', title: 'Return to hotel', startTime: '17:00', endTime: '17:30', category: 'accommodation', userAdded: true, isLocked: true },
  ];
  const res = runScheduleExecutioner(acts, baseCtx());
  assert(res.activities.map((a: any) => a.id).includes('a2'), 'user-locked return should be preserved');
  assertEquals(res.counters.hotelReturnLoopsDropped, 0);
});

Deno.test('HOTEL_RETURN_LOOP — middle day with no check-in is no-op', () => {
  const acts = [
    { id: 'a1', title: 'Museum visit', startTime: '10:00', endTime: '12:00', category: 'culture' },
    { id: 'a2', title: 'Return to hotel', startTime: '13:00', endTime: '13:30', category: 'accommodation' },
    { id: 'a3', title: 'Lunch', startTime: '13:45', endTime: '15:00', category: 'dining' },
  ];
  const res = runScheduleExecutioner(acts, baseCtx({ dayNumber: 3, isFirstDay: false, arrivalTime24: null }));
  assertEquals(res.counters.hotelReturnLoopsDropped, 0);
  // a2 still survives the hotel-return rule (out of scope here — covered by other passes if at all)
  assertEquals(res.activities.length, 3);
});

Deno.test('HOTEL_RETURN_LOOP — late-nightlife bookend source-tagged is preserved even pre-18:00', () => {
  // Defensive: a bookend source tag MUST exempt the row regardless of clock.
  const acts = [
    { id: 'a1', title: 'Check-in', startTime: '14:00', endTime: '14:30', category: 'accommodation' },
    { id: 'a2', title: 'Return to hotel', startTime: '17:00', endTime: '17:30', category: 'accommodation', source: 'late_nightlife_bookend' },
  ];
  const res = runScheduleExecutioner(acts, baseCtx());
  assert(res.activities.map((a: any) => a.id).includes('a2'));
  assertEquals(res.counters.hotelReturnLoopsDropped, 0);
});
