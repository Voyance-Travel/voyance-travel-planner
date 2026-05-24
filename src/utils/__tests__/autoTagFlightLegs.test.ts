import { describe, it, expect } from 'vitest';
import { autoTagLegs, legButtonVisibility } from '../autoTagFlightLegs';

describe('autoTagLegs', () => {
  it('marks the single leg as destination arrival (one-way)', () => {
    const out = autoTagLegs([
      { arrival: { airport: 'CDG' }, departure: { airport: 'ATL' } },
    ]);
    expect(out[0].isDestinationArrival).toBe(true);
    expect(out[0].isDestinationDeparture).toBeUndefined();
  });

  it('round-trip (2 legs): leg 0 arrival, leg 1 departure', () => {
    const out = autoTagLegs([
      { arrival: { airport: 'CDG' }, departure: { airport: 'ATL' } },
      { arrival: { airport: 'ATL' }, departure: { airport: 'CDG' } },
    ]);
    expect(out[0].isDestinationArrival).toBe(true);
    expect(out[0].isDestinationDeparture).toBeUndefined();
    expect(out[1].isDestinationDeparture).toBe(true);
    expect(out[1].isDestinationArrival).toBeUndefined();
  });

  it('preserves user-set flag — does not relocate', () => {
    const out = autoTagLegs([
      { arrival: { airport: 'CDG' }, departure: { airport: 'ATL' } },
      { arrival: { airport: 'FCO' }, departure: { airport: 'CDG' }, isDestinationArrival: true },
      { arrival: { airport: 'ATL' }, departure: { airport: 'FCO' } },
    ]);
    expect(out[0].isDestinationArrival).toBeFalsy();
    expect(out[1].isDestinationArrival).toBe(true);
    expect(out[2].isDestinationDeparture).toBe(true);
  });

  it('3 legs with destination IATA hint picks the matching arrival', () => {
    // ATL → JFK (layover) → CDG, then CDG → ATL return
    const out = autoTagLegs(
      [
        { arrival: { airport: 'JFK' }, departure: { airport: 'ATL' } },
        { arrival: { airport: 'CDG' }, departure: { airport: 'JFK' } },
        { arrival: { airport: 'ATL' }, departure: { airport: 'CDG' } },
      ],
      { destinationIata: 'CDG' },
    );
    expect(out[1].isDestinationArrival).toBe(true);
    expect(out[2].isDestinationDeparture).toBe(true);
    expect(out[0].isDestinationArrival).toBeFalsy();
  });

  it('works on flat (ManualFlightEntry) shape', () => {
    const out = autoTagLegs([
      { arrivalAirport: 'CDG', departureAirport: 'ATL' },
      { arrivalAirport: 'ATL', departureAirport: 'CDG' },
    ]);
    expect(out[0].isDestinationArrival).toBe(true);
    expect(out[1].isDestinationDeparture).toBe(true);
  });

  it('enforces mutual exclusivity if input has duplicates', () => {
    const out = autoTagLegs([
      { arrival: { airport: 'CDG' }, isDestinationArrival: true },
      { arrival: { airport: 'CDG' }, isDestinationArrival: true },
    ]);
    expect(out[0].isDestinationArrival).toBe(true);
    expect(out[1].isDestinationArrival).toBe(false);
  });

  it('empty input returns empty', () => {
    expect(autoTagLegs([])).toEqual([]);
    expect(autoTagLegs(null)).toEqual([]);
  });
});

describe('legButtonVisibility', () => {
  it('single leg: arrival only', () => {
    expect(legButtonVisibility(0, 1)).toEqual({ showArrival: true, showDeparture: false });
  });
  it('2 legs: outbound shows arrival only; return shows departure only', () => {
    expect(legButtonVisibility(0, 2)).toEqual({ showArrival: true, showDeparture: false });
    expect(legButtonVisibility(1, 2)).toEqual({ showArrival: false, showDeparture: true });
  });
  it('3+ legs: both shown (ambiguous)', () => {
    expect(legButtonVisibility(0, 3)).toEqual({ showArrival: true, showDeparture: true });
    expect(legButtonVisibility(2, 4)).toEqual({ showArrival: true, showDeparture: true });
  });
});
