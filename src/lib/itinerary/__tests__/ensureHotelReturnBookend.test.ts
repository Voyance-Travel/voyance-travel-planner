import { describe, it, expect } from 'vitest';
import { ensureHotelReturnBookend } from '../ensureHotelReturnBookend';

const mk = (over: any = {}) => ({
  id: over.id ?? 'a',
  title: over.title ?? 'Activity',
  category: over.category ?? 'sightseeing',
  startTime: over.startTime,
  endTime: over.endTime,
  ...over,
});

describe('ensureHotelReturnBookend', () => {
  it('Bruges Day 1: nightcap 21:36–22:36 → injects "Return to {hotel}"', () => {
    const acts = [
      mk({ title: 'Dinner', category: 'dining', startTime: '19:00', endTime: '20:30' }),
      mk({ title: "Nightcap at L'Estaminet", category: 'activity', startTime: '21:36', endTime: '22:36' }),
    ];
    const out = ensureHotelReturnBookend(acts, { hotelName: 'The Notary', dayIndex: 0 });
    expect(out).toHaveLength(3);
    const last = out[out.length - 1];
    expect(last.title).toBe('Return to The Notary');
    expect(last.source).toBe('bookend-readtime');
    expect(last.cost.amount).toBe(0);
    expect(last.startTime >= '19:00' && last.startTime <= '23:30').toBe(true);
  });

  it('Bruges Day 2: dinner 19:00–20:15 → injects bookend', () => {
    const acts = [
      mk({ title: 'Lunch', category: 'dining', startTime: '12:30', endTime: '13:45' }),
      mk({ title: 'Dinner: Refter', category: 'dining', startTime: '19:00', endTime: '20:15' }),
    ];
    const out = ensureHotelReturnBookend(acts, { hotelName: 'The Notary', dayIndex: 1 });
    expect(out).toHaveLength(3);
    expect(out[2].source).toBe('bookend-readtime');
  });

  it('Seoul Day 1: cultural ends 02:50 (gray zone, no nightlife) → overnight bookend', () => {
    const acts = [
      mk({ title: 'Sunset Dinner', category: 'dining', startTime: '18:00', endTime: '19:30' }),
      mk({ title: 'Starlight Palace Viewpoint', category: 'cultural', startTime: '01:20', endTime: '02:50' }),
    ];
    const out = ensureHotelReturnBookend(acts, { hotelName: 'MARI HOTEL', dayIndex: 0 });
    expect(out).toHaveLength(3);
    const last = out[out.length - 1];
    expect(last.source).toBe('bookend-overnight');
    expect(last.title).toBe('Return to MARI HOTEL');
  });

  it('Late nightlife 23:16–00:16 → injects late-bleed bookend', () => {
    const acts = [
      mk({ title: 'Dinner', category: 'dining', startTime: '19:00', endTime: '21:00' }),
      mk({ title: "Nightcap at L'Estaminet", category: 'nightlife', startTime: '23:16', endTime: '00:16' }),
    ];
    const out = ensureHotelReturnBookend(acts, { hotelName: 'The Notary', dayIndex: 0 });
    expect(out).toHaveLength(3);
    const last = out[out.length - 1];
    expect(last.source).toBe('bookend-readtime');
    expect(last.tags).toContain('late_nightlife_bookend');
    expect(last.startTime <= '02:55').toBe(true);
  });

  it('idempotent — already ends in "Return to ..."', () => {
    const acts = [
      mk({ title: 'Dinner', startTime: '19:00', endTime: '20:30' }),
      mk({ title: 'Return to Hotel Cipriani', category: 'accommodation', startTime: '21:00', endTime: '21:30' }),
    ];
    const out = ensureHotelReturnBookend(acts, { dayIndex: 0 });
    expect(out).toBe(acts);
  });

  it('idempotent — already ends in checkout', () => {
    const acts = [mk({ title: 'Checkout from Hotel', category: 'accommodation', startTime: '11:00', endTime: '11:30' })];
    const out = ensureHotelReturnBookend(acts, { dayIndex: 0 });
    expect(out).toBe(acts);
  });

  it('skips departure day (flight terminal)', () => {
    const acts = [
      mk({ title: 'Brunch', startTime: '10:00', endTime: '11:00' }),
      mk({ title: 'Departure Flight', category: 'flight', startTime: '17:50', endTime: '19:50' }),
    ];
    const out = ensureHotelReturnBookend(acts, { isDepartureDay: true, dayIndex: 2 });
    expect(out).toBe(acts);
  });

  it('respects locked terminal activity', () => {
    const acts = [
      mk({ title: 'Late dinner', startTime: '20:00', endTime: '22:30', isLocked: true }),
    ];
    const out = ensureHotelReturnBookend(acts, { dayIndex: 0 });
    expect(out).toBe(acts);
  });

  it('respects user-source terminal activity', () => {
    const acts = [
      mk({ title: 'User picked event', startTime: '20:00', endTime: '22:30', source: 'user' }),
    ];
    const out = ensureHotelReturnBookend(acts, { dayIndex: 0 });
    expect(out).toBe(acts);
  });

  it('extracts hotel name from existing checkout card on another day', () => {
    const allTrip = [
      mk({ title: 'Checkout from The Notary', category: 'accommodation', startTime: '11:00', endTime: '11:30' }),
    ];
    const acts = [mk({ title: 'Dinner', category: 'dining', startTime: '19:00', endTime: '20:30' })];
    const out = ensureHotelReturnBookend(acts, { allTripActivities: allTrip, dayIndex: 0 });
    expect(out).toHaveLength(2);
    expect(out[1].title).toBe('Return to The Notary');
  });

  it('falls back to "Return to Your Hotel" when no name available', () => {
    const acts = [mk({ title: 'Dinner', category: 'dining', startTime: '19:00', endTime: '20:30' })];
    const out = ensureHotelReturnBookend(acts, { dayIndex: 0 });
    expect(out).toHaveLength(2);
    expect(out[1].title).toBe('Return to Your Hotel');
  });

  it('empty activities → no-op', () => {
    const out = ensureHotelReturnBookend([], { dayIndex: 0 });
    expect(out).toEqual([]);
  });

  it('00:00–02:30 with non-nightlife terminal → no injection (avoid fabrication)', () => {
    const acts = [mk({ title: 'Random late activity', category: 'cultural', startTime: '23:30', endTime: '01:30' })];
    const out = ensureHotelReturnBookend(acts, { dayIndex: 0 });
    expect(out).toBe(acts);
  });
});
