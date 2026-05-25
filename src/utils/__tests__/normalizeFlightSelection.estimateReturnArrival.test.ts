import { describe, it, expect } from 'vitest';
import { estimateReturnArrival, normalizeFlightSelection, type FlightLeg } from '@/utils/normalizeFlightSelection';

function mkLegs(): FlightLeg[] {
  return [
    {
      legOrder: 1,
      airline: 'DL',
      flightNumber: 'DL123',
      departure: { airport: 'ATL', time: '07:00', date: '2026-11-06' },
      arrival: { airport: 'MEX', time: '09:30', date: '2026-11-06' },
      price: 0,
      cabin: 'economy',
    },
    {
      legOrder: 2,
      airline: 'DL',
      flightNumber: 'DL456',
      departure: { airport: 'MEX', time: '13:00', date: '2026-11-09' },
      arrival: { airport: 'ATL', time: '', date: undefined },
      price: 0,
      cabin: 'economy',
    },
  ];
}

describe('estimateReturnArrival', () => {
  it('fills return arrival from outbound duration (ATL→MEX 2h30m → MEX→ATL 13:00 ⇒ 15:30 same day)', () => {
    const legs = mkLegs();
    estimateReturnArrival(legs);
    expect(legs[1].arrival.time).toBe('15:30');
    expect(legs[1].arrival.date).toBe('2026-11-09');
    expect(legs[1].arrival.estimated).toBe(true);
  });

  it('rolls the arrival date when departure + duration crosses midnight UTC', () => {
    const legs = mkLegs();
    legs[0].departure = { airport: 'ATL', time: '22:00', date: '2026-11-06' };
    legs[0].arrival = { airport: 'MEX', time: '03:00', date: '2026-11-07' }; // 5h flight
    legs[1].departure = { airport: 'MEX', time: '22:00', date: '2026-11-09' };
    estimateReturnArrival(legs);
    expect(legs[1].arrival.time).toBe('03:00');
    expect(legs[1].arrival.date).toBe('2026-11-10');
    expect(legs[1].arrival.estimated).toBe(true);
  });

  it('no-ops when outbound arrival time is missing', () => {
    const legs = mkLegs();
    legs[0].arrival.time = '';
    estimateReturnArrival(legs);
    expect(legs[1].arrival.time).toBe('');
    expect(legs[1].arrival.estimated).toBeUndefined();
  });

  it('no-ops on negative/insane outbound duration', () => {
    const legs = mkLegs();
    legs[0].arrival.time = '06:00'; // earlier than 07:00 dep ⇒ negative
    estimateReturnArrival(legs);
    expect(legs[1].arrival.time).toBe('');
    legs[0].arrival.time = '09:30';
    legs[0].arrival.date = '2026-11-10'; // 4 days later ⇒ >20h
    estimateReturnArrival(legs);
    expect(legs[1].arrival.time).toBe('');
  });

  it('skips when leg count is not exactly two', () => {
    const legs = mkLegs();
    legs.push({ ...legs[1], legOrder: 3 });
    estimateReturnArrival(legs);
    expect(legs[1].arrival.time).toBe('');
    expect(legs[2].arrival.time).toBe('');
  });

  it('is idempotent and does not overwrite a pre-existing arrival time', () => {
    const legs = mkLegs();
    legs[1].arrival.time = '16:45';
    legs[1].arrival.date = '2026-11-09';
    estimateReturnArrival(legs);
    expect(legs[1].arrival.time).toBe('16:45');
    expect(legs[1].arrival.estimated).toBeUndefined();
    // Re-running on estimated leg is still safe (already populated)
    const legs2 = mkLegs();
    estimateReturnArrival(legs2);
    const firstTime = legs2[1].arrival.time;
    estimateReturnArrival(legs2);
    expect(legs2[1].arrival.time).toBe(firstTime);
  });

  it('runs end-to-end via normalizeFlightSelection legacy {departure,return} input', () => {
    const result = normalizeFlightSelection({
      departure: {
        airline: 'DL',
        flightNumber: 'DL123',
        departure: { airport: 'ATL', time: '07:00', date: '2026-11-06' },
        arrival: { airport: 'MEX', time: '09:30', date: '2026-11-06' },
        price: 400,
        cabin: 'economy',
      },
      return: {
        airline: 'DL',
        flightNumber: 'DL456',
        departure: { airport: 'MEX', time: '13:00', date: '2026-11-09' },
        arrival: { airport: 'ATL', time: '' },
        price: 400,
        cabin: 'economy',
      },
    });
    expect(result).not.toBeNull();
    expect(result!.legs[1].arrival.time).toBe('15:30');
    expect(result!.legs[1].arrival.estimated).toBe(true);
  });
});
