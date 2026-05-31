/**
 * Locks the Dublin/Amsterdam wrong-anchor bug: without destinationIata
 * threaded into autoTagLegs, a 2-leg trip where leg 1 is the destination
 * arrival (e.g. connecting flight reordered or legacy → legs[] re-emission)
 * gets leg 0 wrongly tagged.
 */
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { pickDestinationArrivalLeg, pickDestinationDepartureLeg } from '../flight-leg-pick.ts';

Deno.test('2-leg with destinationIata picks the matching leg, not just leg 0', () => {
  // ATL → JFK (connector arriving at JFK), JFK → DUB (the real destination)
  const flight = {
    legs: [
      { departure: { airport: 'ATL', time: '14:00', date: '2026-06-01' }, arrival: { airport: 'JFK', time: '16:30', date: '2026-06-01' } },
      { departure: { airport: 'JFK', time: '19:00', date: '2026-06-01' }, arrival: { airport: 'DUB', time: '07:00', date: '2026-06-02' } },
    ],
  };
  // Without IATA → naive 2-leg rule taggs leg 0 (BUG — 16:30 JFK).
  const buggy = pickDestinationArrivalLeg(flight);
  assertEquals(buggy.rawArrivalString, '16:30');

  // With IATA → autoTagLegs uses destIata to pick the leg arriving at DUB.
  const fixed = pickDestinationArrivalLeg(flight, { destinationIata: 'DUB' });
  assertEquals(fixed.rawArrivalString, '07:00');
  assertEquals(fixed.leg?.arrivalAirport, 'DUB');
});

Deno.test('Regression: canonical 2-leg round-trip still picks leg 0 with IATA', () => {
  // JFK → AMS, AMS → JFK; destination = AMS, leg 0 is correct.
  const flight = {
    legs: [
      { departure: { airport: 'JFK', time: '14:00', date: '2026-06-01' }, arrival: { airport: 'AMS', time: '22:00', date: '2026-06-01' } },
      { departure: { airport: 'AMS', time: '11:00', date: '2026-06-08' }, arrival: { airport: 'JFK', time: '14:00', date: '2026-06-08' } },
    ],
  };
  const arr = pickDestinationArrivalLeg(flight, { destinationIata: 'AMS' });
  assertEquals(arr.rawArrivalString, '22:00');
  assertEquals(arr.leg?.arrivalAirport, 'AMS');

  const dep = pickDestinationDepartureLeg(flight, { destinationIata: 'AMS' });
  assertEquals(dep.rawDepartureString, '11:00');
  assertEquals(dep.leg?.departureAirport, 'AMS');
});

Deno.test('3-leg ATL → JFK → CDG + CDG → ATL with destinationIata=CDG', () => {
  const flight = {
    legs: [
      { departure: { airport: 'ATL', time: '08:00', date: '2026-06-01' }, arrival: { airport: 'JFK', time: '10:30', date: '2026-06-01' } },
      { departure: { airport: 'JFK', time: '13:00', date: '2026-06-01' }, arrival: { airport: 'CDG', time: '02:00', date: '2026-06-02' } },
      { departure: { airport: 'CDG', time: '11:00', date: '2026-06-08' }, arrival: { airport: 'ATL', time: '15:00', date: '2026-06-08' } },
    ],
  };
  const arr = pickDestinationArrivalLeg(flight, { destinationIata: 'CDG' });
  assertEquals(arr.rawArrivalString, '02:00');
  assertEquals(arr.leg?.arrivalAirport, 'CDG');

  const dep = pickDestinationDepartureLeg(flight, { destinationIata: 'CDG' });
  assertEquals(dep.rawDepartureString, '11:00');
});
