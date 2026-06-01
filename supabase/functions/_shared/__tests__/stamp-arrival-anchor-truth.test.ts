import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { stampArrivalAnchorTruth } from '../stamp-arrival-anchor-truth.ts';

Deno.test('stampArrivalAnchorTruth: overwrites LLM time on Day 1 arrival card', () => {
  const day = {
    dayNumber: 1,
    activities: [
      {
        id: 'a1',
        title: 'Arrival Flight',
        category: 'flight',
        startTime: '03:05',
        endTime: '05:05',
        location: { name: 'IST', address: '' },
      },
      { id: 'a2', title: 'Lunch', category: 'dining', startTime: '13:00', endTime: '14:00' },
    ],
  };
  const r = stampArrivalAnchorTruth(day, {
    isFirstDay: true,
    arrivalTime24: '15:00',
    arrivalAirport: 'IST',
    airportProcessingMins: 45,
  });
  assertEquals(r.mutated, true);
  assertEquals(r.action, 'overwrote_arrival_anchor');
  assertEquals(day.activities[0].startTime, '15:00');
  assertEquals(day.activities[0].endTime, '15:45');
  assertEquals((day.activities[0] as any).isLocked, true);
  assertEquals((day.activities[0] as any).lockReason, 'flight-truth');
  assertEquals((day.activities[0] as any).anchorSource, 'arrival-flight');
  assertEquals((day.activities[0] as any).source, 'stamp-arrival-truth');
});

Deno.test('stampArrivalAnchorTruth: no-op when not first day', () => {
  const day = { dayNumber: 2, activities: [{ title: 'Arrival Flight', category: 'flight', startTime: '03:05', endTime: '05:05' }] };
  const r = stampArrivalAnchorTruth(day, { isFirstDay: false, arrivalTime24: '15:00' });
  assertEquals(r.mutated, false);
  assertEquals(r.action, 'noop_not_first_day');
  assertEquals(day.activities[0].startTime, '03:05');
});

Deno.test('stampArrivalAnchorTruth: no-op when no arrival card present', () => {
  const day = { dayNumber: 1, activities: [{ title: 'Lunch', category: 'dining', startTime: '13:00', endTime: '14:00' }] };
  const r = stampArrivalAnchorTruth(day, { isFirstDay: true, arrivalTime24: '15:00' });
  assertEquals(r.mutated, false);
  assertEquals(r.action, 'noop_no_arrival_card');
});

Deno.test('stampArrivalAnchorTruth: no-op on hotel-change day', () => {
  const day = { dayNumber: 1, activities: [{ title: 'Arrival Flight', category: 'flight', startTime: '03:00', endTime: '05:00' }] };
  const r = stampArrivalAnchorTruth(day, { isFirstDay: true, arrivalTime24: '15:00', isHotelChange: true });
  assertEquals(r.mutated, false);
  assertEquals(r.action, 'noop_hotel_change');
});

Deno.test('stampArrivalAnchorTruth: idempotent on already-aligned + locked card', () => {
  const day = {
    dayNumber: 1,
    activities: [
      {
        title: 'Arrival Flight',
        category: 'flight',
        startTime: '15:00',
        endTime: '15:45',
        isLocked: true,
        lockReason: 'flight-truth',
        anchorSource: 'arrival-flight',
      },
    ],
  };
  const r = stampArrivalAnchorTruth(day, { isFirstDay: true, arrivalTime24: '15:00' });
  assertEquals(r.mutated, false);
  assertEquals(r.action, 'noop_already_aligned');
});

Deno.test('stampArrivalAnchorTruth: detects card by anchorSource', () => {
  const day = {
    dayNumber: 1,
    activities: [
      { title: 'Land in Istanbul', category: 'transport', anchorSource: 'arrival-flight', startTime: '04:00', endTime: '04:30' },
    ],
  };
  const r = stampArrivalAnchorTruth(day, { isFirstDay: true, arrivalTime24: '22:00' });
  assertEquals(r.mutated, true);
  assertEquals(day.activities[0].startTime, '22:00');
  assertEquals(day.activities[0].endTime, '22:45');
});
