/**
 * Edge ↔ FE parity for destination-arrival leg picking.
 *
 * Reproduces the Amsterdam bug: 2-leg round-trip stored as legs[] with NO
 * isDestinationArrival flag — the BE picker must auto-tag leg 0 (same as FE
 * autoTagLegs) and return its arrival time, not the return leg's.
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  pickDestinationArrivalLeg,
  pickDestinationDepartureLeg,
} from '../flight-leg-pick.ts';

Deno.test('amsterdam — 2-leg round-trip without isDestinationArrival flag', () => {
  const flight = {
    legs: [
      {
        legOrder: 1,
        departure: { airport: 'JFK', time: '14:00', date: '2026-06-01' },
        arrival: { airport: 'AMS', time: '22:00', date: '2026-06-01' },
      },
      {
        legOrder: 2,
        departure: { airport: 'AMS', time: '11:00', date: '2026-06-08' },
        arrival: { airport: 'JFK', time: '14:00', date: '2026-06-08' },
      },
    ],
  };
  const arr = pickDestinationArrivalLeg(flight);
  assertEquals(arr.rawArrivalString, '22:00');
  assertEquals(arr.leg?.arrivalAirport, 'AMS');
  assertEquals(arr.source, 'autotag_two_leg_outbound');

  const dep = pickDestinationDepartureLeg(flight);
  assertEquals(dep.rawDepartureString, '11:00');
  assertEquals(dep.leg?.departureAirport, 'AMS');
});

Deno.test('user-marked isDestinationArrival wins', () => {
  const flight = {
    legs: [
      { departure: { airport: 'JFK', time: '09:00', date: '2026-06-01' }, arrival: { airport: 'LHR', time: '21:00', date: '2026-06-01' } },
      { isDestinationArrival: true, departure: { airport: 'LHR', time: '22:30', date: '2026-06-01' }, arrival: { airport: 'AMS', time: '00:45', date: '2026-06-02' } },
      { isDestinationDeparture: true, departure: { airport: 'AMS', time: '11:00', date: '2026-06-08' }, arrival: { airport: 'JFK', time: '14:00', date: '2026-06-08' } },
    ],
  };
  const arr = pickDestinationArrivalLeg(flight);
  assertEquals(arr.rawArrivalString, '00:45');
  assertEquals(arr.source, 'isDestinationArrival_flag');
  const dep = pickDestinationDepartureLeg(flight);
  assertEquals(dep.rawDepartureString, '11:00');
  assertEquals(dep.source, 'isDestinationDeparture_flag');
});

Deno.test('legacy { departure, return } shape', () => {
  const flight = {
    departure: {
      departure: { airport: 'JFK', time: '14:00', date: '2026-06-01' },
      arrival: { airport: 'AMS', time: '22:00', date: '2026-06-01' },
    },
    return: {
      departure: { airport: 'AMS', time: '11:00', date: '2026-06-08' },
      arrival: { airport: 'JFK', time: '14:00', date: '2026-06-08' },
    },
  };
  const arr = pickDestinationArrivalLeg(flight);
  assertEquals(arr.rawArrivalString, '22:00');
});

Deno.test('flat shape', () => {
  const flight = {
    departureAirport: 'JFK',
    arrivalAirport: 'AMS',
    arrivalTime: '22:00',
  };
  const arr = pickDestinationArrivalLeg(flight);
  assertEquals(arr.rawArrivalString, '22:00');
  assertEquals(arr.source, 'autotag_single_leg');
});

Deno.test('return-arrival back-fill via estimateReturnArrival', () => {
  // outbound 14:00 → 22:00 (8h), return departs 11:00 → arrival should be
  // back-filled to 19:00 same day.
  const flight = {
    legs: [
      { departure: { airport: 'JFK', time: '14:00', date: '2026-06-01' }, arrival: { airport: 'AMS', time: '22:00', date: '2026-06-01' } },
      { departure: { airport: 'AMS', time: '11:00', date: '2026-06-08' }, arrival: { airport: 'JFK', time: '', date: '' } },
    ],
  };
  const dep = pickDestinationDepartureLeg(flight);
  assertEquals(dep.rawDepartureString, '11:00');
  assertEquals(dep.leg?.arrivalTime, '19:00');
});
