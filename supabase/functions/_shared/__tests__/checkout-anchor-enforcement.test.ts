import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { enforceCheckoutAnchor } from '../schedule-executioner.ts';

function newCounters(): any {
  return {
    flightAnchorRepaired: 0, midnightSpilloversAllowed: 0, midnightSpilloversDropped: 0,
    bufferRepairs: 0, overlapRepairs: 0, transitRecomputed: 0,
    geoOutliersFlagged: 0, geoOutliersDropped: 0,
    airportLoopsDropped: 0, hotelReturnLoopsDropped: 0,
    transfersClamped: 0, departureTransfersStripped: 0,
    orphanTransitsDropped: 0, checkoutOverlapsTrimmed: 0,
    droppedActivities: 0, gapsRefilled: 0, issues: [],
  };
}
const ctx = (over: any = {}) => ({
  dayNumber: 4, totalDays: 4, isFirstDay: false, isLastDay: true,
  ...over,
});

Deno.test('clamps end into 15-min buffer', () => {
  const acts = [
    { id: 'church', title: 'Church Visit', startTime: '10:05', endTime: '11:05', category: 'sightseeing' },
    { id: 'co', title: 'Hotel Checkout', startTime: '11:00', endTime: '11:15', category: 'accommodation' },
  ];
  const c = newCounters();
  enforceCheckoutAnchor(acts, ctx(), c);
  assertEquals(acts[0].endTime, '10:45');
  assertEquals(c.checkoutOverlapsTrimmed, 1);
});

Deno.test('preserves post-checkout activity', () => {
  const acts = [
    { id: 'co', title: 'Hotel Checkout', startTime: '11:00', endTime: '11:15', category: 'accommodation' },
    { id: 'lunch', title: 'Farewell Lunch', startTime: '11:30', endTime: '12:30', category: 'dining' },
  ];
  const c = newCounters();
  enforceCheckoutAnchor(acts, ctx(), c);
  assertEquals(acts.length, 2);
  assertEquals(c.checkoutOverlapsTrimmed, 0);
});

Deno.test('drops activity when trim would leave <30min', () => {
  const acts = [
    { id: 'short', title: 'Pastry Stop', startTime: '10:55', endTime: '11:10', category: 'dining' },
    { id: 'co', title: 'Hotel Checkout', startTime: '11:00', endTime: '11:15', category: 'accommodation' },
  ];
  const c = newCounters();
  enforceCheckoutAnchor(acts, ctx(), c);
  assertEquals(acts.length, 1);
  assertEquals(acts[0].id, 'co');
  assertEquals(c.checkoutOverlapsTrimmed, 1);
  assertEquals(c.droppedActivities, 1);
});

Deno.test('drops activity that starts inside buffer window', () => {
  const acts = [
    { id: 'late', title: 'Quick Coffee', startTime: '10:50', endTime: '11:30', category: 'dining' },
    { id: 'co', title: 'Hotel Checkout', startTime: '11:00', endTime: '11:15', category: 'accommodation' },
  ];
  const c = newCounters();
  enforceCheckoutAnchor(acts, ctx(), c);
  assertEquals(acts.length, 1);
  assertEquals(c.droppedActivities, 1);
});

Deno.test('preserves locked activity, flags issue with repaired:false', () => {
  const acts = [
    { id: 'pinned', title: 'Pinned Church', startTime: '10:05', endTime: '11:05', category: 'sightseeing', isLocked: true, source: 'user' },
    { id: 'co', title: 'Hotel Checkout', startTime: '11:00', endTime: '11:15', category: 'accommodation' },
  ];
  const c = newCounters();
  enforceCheckoutAnchor(acts, ctx(), c);
  assertEquals(acts[0].endTime, '11:05');
  assertEquals(c.checkoutOverlapsTrimmed, 0);
  assertEquals(c.issues.length, 1);
  assertEquals(c.issues[0].repaired, false);
});

Deno.test('no-op on non-last day', () => {
  const acts = [
    { id: 'church', title: 'Church', startTime: '10:05', endTime: '11:05', category: 'sightseeing' },
    { id: 'co', title: 'Hotel Checkout', startTime: '11:00', endTime: '11:15', category: 'accommodation' },
  ];
  const c = newCounters();
  enforceCheckoutAnchor(acts, ctx({ isLastDay: false }), c);
  assertEquals(acts[0].endTime, '11:05');
  assertEquals(c.checkoutOverlapsTrimmed, 0);
});

Deno.test('exempts bookend-source rows', () => {
  const acts = [
    { id: 'co', title: 'Hotel Checkout', startTime: '11:00', endTime: '11:15', category: 'accommodation' },
    { id: 'be', title: 'Return to Hotel', startTime: '10:30', endTime: '11:00', category: 'accommodation', source: 'bookend-readtime' },
  ];
  const c = newCounters();
  enforceCheckoutAnchor(acts, ctx(), c);
  assertEquals(acts.length, 2);
  assertEquals(c.checkoutOverlapsTrimmed, 0);
});
