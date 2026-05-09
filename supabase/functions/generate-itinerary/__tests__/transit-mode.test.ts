import { describe, it, expect } from 'vitest';
import { enforceTransitModeByDistance } from '../sanitization';
import { pickTransitTier, haversineMeters } from '../../_shared/transit-mode';

// Cape Town: Kirstenbosch (-33.9881, 18.4326) → Woodstock (-33.9275, 18.4581) ≈ 7 km
const KIRSTENBOSCH = { lat: -33.9881, lng: 18.4326 };
const WOODSTOCK = { lat: -33.9275, lng: 18.4581 };

describe('pickTransitTier', () => {
  it('returns walk for ≤650m', () => {
    const t = pickTransitTier(400, 'X');
    expect(t.method).toBe('walk');
    expect(t.costAmount).toBe(0);
  });
  it('returns metro for 650m-5km', () => {
    expect(pickTransitTier(2000, 'X').method).toBe('metro');
  });
  it('returns uber for >5km', () => {
    const t = pickTransitTier(7000, 'X');
    expect(t.method).toBe('uber');
    expect(t.costAmount).toBeGreaterThan(0);
  });
});

describe('enforceTransitModeByDistance', () => {
  const makeWalk = (extra: any = {}) => ({
    title: 'Walk to Woodstock',
    category: 'transit',
    transportation: { method: 'walking', duration: '1h 30m', durationMinutes: 90 },
    ...extra,
  });

  it('overrides walk → uber on long inter-district hop using prev/next coords', () => {
    const act = makeWalk();
    const prev = { location: { coordinates: KIRSTENBOSCH }, title: 'Kirstenbosch' };
    const next = { location: { coordinates: WOODSTOCK }, title: 'Woodstock café' };
    const changed = enforceTransitModeByDistance(act, prev, next, 'TEST');
    expect(changed).toBe(true);
    expect(act.transportation.method).toBe('uber');
    expect(act.transportation.durationMinutes).toBeLessThan(40);
    expect(act.transportation.estimatedCost.amount).toBeGreaterThan(0);
    expect(act.title).toBe('Taxi to Woodstock');
  });

  it('leaves a sub-650m walk alone', () => {
    const act = makeWalk();
    const prev = { location: { coordinates: { lat: 48.8606, lng: 2.3376 } } };
    // ~500m away
    const next = { location: { coordinates: { lat: 48.8635, lng: 2.3275 } } };
    const changed = enforceTransitModeByDistance(act, prev, next, 'TEST');
    expect(changed).toBe(false);
    expect(act.transportation.method).toBe('walking');
  });

  it('no-op when coords cannot be resolved', () => {
    const act = makeWalk();
    const changed = enforceTransitModeByDistance(act, null, null, 'TEST');
    expect(changed).toBe(false);
    expect(act.transportation.method).toBe('walking');
  });

  it('rewrites title verb (Walk to → Taxi to / Metro to)', () => {
    const act = makeWalk({ title: 'Walk to Kirstenbosch' });
    const prev = { location: { coordinates: WOODSTOCK } };
    const next = { location: { coordinates: KIRSTENBOSCH } };
    enforceTransitModeByDistance(act, prev, next, 'TEST');
    expect(/^(Taxi|Metro) to /.test(act.title)).toBe(true);
  });

  it('haversineMeters sanity: KB→Woodstock is ~6-9 km', () => {
    const d = haversineMeters(KIRSTENBOSCH.lat, KIRSTENBOSCH.lng, WOODSTOCK.lat, WOODSTOCK.lng);
    expect(d).toBeGreaterThan(5500);
    expect(d).toBeLessThan(10_000);
  });
});
