/**
 * Regression tests for buildFlightOnlyRoute — the multi-city flight form must
 * RESPECT each leg's chosen transport mode. A leg the user set to car/train/
 * bus/ferry must NOT be pre-filled as a flight; only flight (or an unset
 * outbound/inter-city leg) belongs in the flight form.
 */
import { describe, it, expect } from 'vitest';
import { buildFlightOnlyRoute, type CityHotelInfo } from '../EditorialItinerary';

const city = (name: string, order: number, transportType?: CityHotelInfo['transportType']): CityHotelInfo => ({
  cityName: name,
  cityOrder: order,
  checkOutDate: `2026-06-0${order + 2}`,
  transportType,
});

describe('buildFlightOnlyRoute', () => {
  it('returns undefined for a single-city trip (no inter-city legs)', () => {
    expect(buildFlightOnlyRoute([city('Paris', 0)], 'NYC', '2026-06-01', '2026-06-05')).toBeUndefined();
    expect(buildFlightOnlyRoute(undefined, 'NYC', '2026-06-01', '2026-06-05')).toBeUndefined();
  });

  it('drops an inter-city leg the user set to TRAIN', () => {
    // Paris -> Lyon by train, Lyon -> home by flight.
    const route = buildFlightOnlyRoute(
      [city('Paris', 0, 'flight'), city('Lyon', 1, 'train')],
      'NYC',
      '2026-06-01',
      '2026-06-07',
    );
    const pairs = (route || []).map((r) => `${r.from}>${r.to}`);
    // outbound NYC->Paris (flight) and return Lyon->NYC (flight) kept; the
    // Paris->Lyon TRAIN leg is excluded.
    expect(pairs).toEqual(['NYC>Paris', 'Lyon>NYC']);
    expect(pairs).not.toContain('Paris>Lyon');
  });

  it('drops car / bus / ferry inter-city legs too', () => {
    const route = buildFlightOnlyRoute(
      [city('A', 0, 'flight'), city('B', 1, 'car'), city('C', 2, 'bus'), city('D', 3, 'ferry')],
      'HOME',
      '2026-06-01',
      '2026-06-10',
    );
    const pairs = (route || []).map((r) => `${r.from}>${r.to}`);
    // Only the outbound flight and the return flight survive.
    expect(pairs).toEqual(['HOME>A', 'D>HOME']);
  });

  it('keeps an inter-city leg explicitly set to FLIGHT', () => {
    const route = buildFlightOnlyRoute(
      [city('Tokyo', 0, 'flight'), city('Osaka', 1, 'flight')],
      'NYC',
      '2026-06-01',
      '2026-06-08',
    );
    const pairs = (route || []).map((r) => `${r.from}>${r.to}`);
    expect(pairs).toEqual(['NYC>Tokyo', 'Tokyo>Osaka', 'Osaka>NYC']);
  });

  it('tags each surviving leg with a mode (flight or unset)', () => {
    const route = buildFlightOnlyRoute(
      [city('Tokyo', 0, 'flight'), city('Osaka', 1, 'train')],
      'NYC',
      '2026-06-01',
      '2026-06-08',
    ) || [];
    // return leg is always flagged 'flight'
    expect(route.find((r) => r.to === 'NYC')?.mode).toBe('flight');
    // the train leg must be gone
    expect(route.some((r) => r.mode === 'train')).toBe(false);
  });
});
