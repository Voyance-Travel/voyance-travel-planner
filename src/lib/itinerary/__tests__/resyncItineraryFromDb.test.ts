import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reportItineraryDrift, dispatchTripPersisted, TRIP_PERSISTED_EVENT } from '../resyncItineraryFromDb';

describe('reportItineraryDrift', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('emits no warn when prev and db match', () => {
    const days = [
      {
        dayNumber: 1,
        activities: [
          { title: 'Breakfast', category: 'dining', endTime: '09:00' },
          { title: 'Dinner at Metis', category: 'dining', endTime: '21:00' },
        ],
      },
    ];
    reportItineraryDrift('trip-1', days, JSON.parse(JSON.stringify(days)));
    const driftCalls = warnSpy.mock.calls.filter(c => String(c[0]).includes('[ITIN_RESYNC_DRIFT]'));
    expect(driftCalls.length).toBe(0);
  });

  it('emits drift warn when terminal endTime shifts (Bali repro)', () => {
    const prev = [
      { dayNumber: 1, activities: [
        { title: 'Dinner at Metis', category: 'dining', endTime: '21:42' },
        { title: 'Nightcap', category: 'dining', endTime: '23:05' },
      ] },
    ];
    const db = [
      { dayNumber: 1, activities: [
        { title: 'Dinner at Metis', category: 'dining', endTime: '20:22' },
        { title: 'Nightcap', category: 'dining', endTime: '21:45' },
      ] },
    ];
    reportItineraryDrift('trip-1', prev, db, 'test');
    const driftCall = warnSpy.mock.calls.find(c => String(c[0]).includes('[ITIN_RESYNC_DRIFT]'));
    expect(driftCall).toBeDefined();
    expect((driftCall![1] as any).kinds).toContain('terminal_end');
  });

  it('emits drift warn when hotel-return appears post-refresh', () => {
    const prev = [
      { dayNumber: 1, activities: [
        { title: 'Dinner', category: 'dining', endTime: '21:00' },
      ] },
    ];
    const db = [
      { dayNumber: 1, activities: [
        { title: 'Dinner', category: 'dining', endTime: '21:00' },
        { title: 'Return to your hotel', category: 'logistics', endTime: '23:15' },
      ] },
    ];
    reportItineraryDrift('trip-1', prev, db);
    const driftCall = warnSpy.mock.calls.find(c => String(c[0]).includes('[ITIN_RESYNC_DRIFT]'));
    expect(driftCall).toBeDefined();
    expect((driftCall![1] as any).kinds).toContain('hotel_return');
  });

  it('emits drift warn when meaningful count drops (Bruges meal-loss repro)', () => {
    const prev = [
      { dayNumber: 1, activities: [
        { title: 'Breakfast', category: 'dining', endTime: '09:00' },
        { title: 'Lunch', category: 'dining', endTime: '13:00' },
        { title: 'Dinner', category: 'dining', endTime: '21:00' },
      ] },
    ];
    const db = [
      { dayNumber: 1, activities: [
        { title: 'Breakfast', category: 'dining', endTime: '09:00' },
        { title: 'Dinner', category: 'dining', endTime: '21:00' },
      ] },
    ];
    reportItineraryDrift('trip-1', prev, db);
    const driftCall = warnSpy.mock.calls.find(c => String(c[0]).includes('[ITIN_RESYNC_DRIFT]'));
    expect(driftCall).toBeDefined();
    expect((driftCall![1] as any).kinds).toContain('meaningful_count');
  });

  it('never throws on malformed input', () => {
    expect(() => reportItineraryDrift('t', undefined, undefined)).not.toThrow();
    expect(() => reportItineraryDrift('t', [null as any], [{ dayNumber: 1 } as any])).not.toThrow();
  });
});

describe('dispatchTripPersisted', () => {
  it('fires the TRIP_PERSISTED_EVENT with detail payload', () => {
    const handler = vi.fn();
    window.addEventListener(TRIP_PERSISTED_EVENT, handler);
    dispatchTripPersisted({ tripId: 'trip-xyz', source: 'unit-test' });
    expect(handler).toHaveBeenCalledTimes(1);
    const evt = handler.mock.calls[0][0] as CustomEvent;
    expect(evt.detail).toEqual({ tripId: 'trip-xyz', source: 'unit-test' });
    window.removeEventListener(TRIP_PERSISTED_EVENT, handler);
  });
});
