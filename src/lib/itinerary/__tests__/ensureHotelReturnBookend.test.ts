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

  it('existing earlier hotel return is SUPERSEDED by a later non-bookend tail (Casablanca pattern)', () => {
    const acts = [
      mk({ title: 'Return to The Notary', category: 'accommodation', startTime: '20:45', endTime: '21:10' }),
      mk({ title: 'Late notes at the lounge', category: 'activity', startTime: '21:20', endTime: '22:00' }),
    ];
    const out = ensureHotelReturnBookend(acts, { hotelName: 'The Notary', dayIndex: 0 });
    // The earlier return must NOT short-circuit — the wrap-aware tail (lounge
    // 22:00) is the chronological end of day, so a fresh bookend is appended.
    expect(out.length).toBe(acts.length + 1);
    expect(out.filter((a: any) => /return to/i.test(String(a.title))).length).toBe(2);
    expect((out[out.length - 1] as any).source).toBe('bookend-readtime');
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

  it('locked terminal activity is preserved verbatim and bookend is appended after it', () => {
    const acts = [
      mk({ id: 'lk', title: 'Late dinner', startTime: '20:00', endTime: '22:30', isLocked: true }),
    ];
    const out = ensureHotelReturnBookend(acts, { hotelName: 'The Notary', dayIndex: 0 });
    expect(out).toHaveLength(2);
    // Locked row untouched
    expect(out[0]).toBe(acts[0]);
    expect((out[0] as any).isLocked).toBe(true);
    // Bookend appended after it
    expect(out[1].source).toBe('bookend-readtime');
    expect(out[1].title).toBe('Return to The Notary');
  });

  it('user-source terminal dinner still receives a hotel return after it', () => {
    const acts = [
      mk({ id: 'u1', title: 'User dinner pick', startTime: '20:00', endTime: '22:30', source: 'user' }),
    ];
    const out = ensureHotelReturnBookend(acts, { hotelName: 'The Notary', dayIndex: 0 });
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(acts[0]);
    expect(out[1].title).toBe('Return to The Notary');
  });

  it('Milan Day 1: Nabucco dinner ends 23:13 → injects bookend', () => {
    const acts = [
      mk({ title: 'Lunch', category: 'dining', startTime: '13:00', endTime: '14:30' }),
      mk({ title: 'Dinner at Ristorante Nabucco', category: 'dining', startTime: '21:30', endTime: '23:13' }),
    ];
    const out = ensureHotelReturnBookend(acts, { hotelName: 'Hotel Spadari', dayIndex: 0 });
    expect(out).toHaveLength(3);
    const last = out[out.length - 1];
    expect(last.title).toBe('Return to Hotel Spadari');
    expect(last.source).toBe('bookend-readtime');
  });

  it('Milan Day 2: stale "Travel to Parco Sempione" tail after dinner → bookend still appended after the tail', () => {
    const acts = [
      mk({ title: 'Lunch', category: 'dining', startTime: '13:00', endTime: '14:00' }),
      mk({ title: 'Dinner at Al Coniglio Bianco', category: 'dining', startTime: '20:00', endTime: '21:49' }),
      mk({ title: 'Travel to Parco Sempione', category: 'transit', startTime: '22:00', endTime: '22:20' }),
    ];
    const out = ensureHotelReturnBookend(acts, { hotelName: 'Hotel Spadari', dayIndex: 1 });
    expect(out).toHaveLength(4);
    const last = out[out.length - 1];
    expect(last.title).toBe('Return to Hotel Spadari');
    expect(last.source).toBe('bookend-readtime');
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
    const acts = [mk({ title: 'Random late activity', category: 'cultural', startTime: '00:30', endTime: '01:30' })];
    const out = ensureHotelReturnBookend(acts, { dayIndex: 0 });
    expect(out).toBe(acts);
  });

  it('flight card present but NOT array-tail → no bookend (defense-in-depth)', () => {
    const acts = [
      mk({ title: 'Brunch', category: 'dining', startTime: '10:00', endTime: '11:00' }),
      mk({ title: 'Departure Flight to JFK', category: 'flight', startTime: '17:50', endTime: '19:50' }),
      mk({ title: 'Quick gallery visit', category: 'activity', startTime: '14:00', endTime: '15:00' }),
    ];
    const out = ensureHotelReturnBookend(acts, { dayIndex: 2 });
    expect(out).toBe(acts);
  });

  it('airport-transfer mid-array followed by stale leisure → no bookend', () => {
    const acts = [
      mk({ title: 'Checkout', category: 'accommodation', startTime: '11:00', endTime: '11:30' }),
      mk({ title: 'Transfer to Airport', category: 'transport', startTime: '12:00', endTime: '12:45' }),
      mk({ title: 'Stroll along the river', category: 'activity', startTime: '13:00', endTime: '14:00' }),
    ];
    const out = ensureHotelReturnBookend(acts, { dayIndex: 3 });
    expect(out).toBe(acts);
  });

  it('Casablanca Day 2: existing 20:15 hotel return + 23:29 nightcap → appends second bookend', () => {
    const acts = [
      mk({ title: 'Lunch', category: 'dining', startTime: '12:30', endTime: '13:30' }),
      mk({ title: 'Dinner: Rouget de l’Isle', category: 'dining', startTime: '19:00', endTime: '20:15' }),
      mk({
        title: 'Return to Casablanca Marriott Hotel',
        category: 'accommodation',
        startTime: '20:15',
        endTime: '20:40',
        source: 'bookend-validator',
      }),
      mk({
        title: 'Nightcap at La Sqala',
        category: 'dining',
        startTime: '23:29',
        endTime: '23:44',
      }),
    ];
    const out = ensureHotelReturnBookend(acts, {
      hotelName: 'Casablanca Marriott Hotel',
      dayIndex: 1,
    });
    // Earlier 20:15 return must NOT suppress; a fresh bookend is appended
    // after the 23:29 nightcap (standard 14–23 window → clamped 19:00–23:30).
    expect(out.length).toBe(acts.length + 1);
    const last = out[out.length - 1];
    expect(last.title).toBe('Return to Casablanca Marriott Hotel');
    expect(last.startTime >= '23:00' && last.startTime <= '23:30').toBe(true);
    expect(last.endTime <= '23:59').toBe(true);
  });


  it('Osaka Day 1: arrival flight + nightcap tail → still injects bookend (arrival ≠ departure terminal)', () => {
    const acts = [
      mk({ title: 'Arrival Flight', category: 'flight', startTime: '07:00', endTime: '09:00' }),
      mk({ title: 'Transfer to Four Seasons Hotel Osaka', category: 'transport', startTime: '09:30', endTime: '10:15' }),
      mk({ title: 'Lunch: Ajinoya Honten', category: 'dining', startTime: '12:30', endTime: '13:30' }),
      mk({ title: 'Dinner: Hajime', category: 'dining', startTime: '19:00', endTime: '20:15' }),
      mk({ title: 'Nightcap at Bar Barouche', category: 'activity', startTime: '23:29', endTime: '23:44' }),
    ];
    const out = ensureHotelReturnBookend(acts, { hotelName: 'Four Seasons Hotel Osaka', dayIndex: 0 });
    expect(out).toHaveLength(acts.length + 1);
    const last = out[out.length - 1] as any;
    expect(last.title).toBe('Return to Four Seasons Hotel Osaka');
    expect(last.source).toBe('bookend-readtime');
  });
});
