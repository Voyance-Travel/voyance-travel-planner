import { describe, it, expect } from 'vitest';
import { parseItineraryDays } from '../itineraryParser';

// Closes the 14/14 "floating Lunch after airport transfer on departure day"
// reproduction. A real restaurant (often mis-tagged `cultural`) lands in the
// last day's JSON with no startTime; dayChronoKey sorts it after every timed
// card so it visually follows the airport transfer.
describe('parseItineraryDays — departure-day untimed strip', () => {
  const tripStart = '2026-06-01';

  it('strips untimed dining card sitting after airport transfer (Katsukura pattern)', () => {
    const raw = {
      days: [
        {
          dayNumber: 1,
          activities: [
            { id: 'a1', title: 'Lunch', category: 'dining', startTime: '13:00', endTime: '14:00' },
            { id: 'a2', title: 'Dinner', category: 'dining', startTime: '19:00', endTime: '20:30' },
          ],
        },
        {
          dayNumber: 2,
          activities: [
            { id: 'b1', title: 'Breakfast', category: 'dining', startTime: '08:30', endTime: '09:15' },
            { id: 'b2', title: 'Checkout from Four Seasons Hotel Kyoto', category: 'accommodation', startTime: '10:00', endTime: '10:30' },
            { id: 'b3', title: 'Transfer to Kansai International Airport (KIX)', category: 'transport', startTime: '12:00', endTime: '13:00' },
            // The leak: real restaurant, mislabeled category, NO startTime.
            { id: 'b4', title: 'Katsukura Sanjo Honten', category: 'cultural' },
          ],
        },
      ],
    };
    const out = parseItineraryDays(raw, tripStart, '2026-06-02');
    expect(out).toHaveLength(2);
    const departureActs = out[1].activities;
    // The untimed Katsukura row must be gone.
    expect(departureActs.find((a: any) => a.id === 'b4')).toBeUndefined();
    // Logistics + timed rows survive.
    expect(departureActs.find((a: any) => a.id === 'b1')).toBeDefined();
    expect(departureActs.find((a: any) => a.id === 'b2')).toBeDefined();
    expect(departureActs.find((a: any) => a.id === 'b3')).toBeDefined();
  });

  it('preserves locked + userAdded untimed rows on departure day', () => {
    const raw = {
      days: [
        { dayNumber: 1, activities: [{ id: 'a1', title: 'Lunch', category: 'dining', startTime: '13:00', endTime: '14:00' }] },
        {
          dayNumber: 2,
          activities: [
            { id: 'b1', title: 'Hotel Checkout', category: 'accommodation', startTime: '11:00', endTime: '11:30' },
            { id: 'b2', title: 'Transfer to Schiphol Airport', category: 'transport', startTime: '14:00', endTime: '15:00' },
            { id: 'b3', title: 'My Important Pinned Lunch', category: 'dining', isLocked: true },
            { id: 'b4', title: 'Reservation I Booked', category: 'dining', userAdded: true },
          ],
        },
      ],
    };
    const out = parseItineraryDays(raw, tripStart, '2026-06-02');
    const departureActs = out[1].activities;
    expect(departureActs.find((a: any) => a.id === 'b3')).toBeDefined();
    expect(departureActs.find((a: any) => a.id === 'b4')).toBeDefined();
  });

  it('does not strip untimed cards on non-departure days', () => {
    const raw = {
      days: [
        {
          dayNumber: 1,
          activities: [
            { id: 'a1', title: 'Untimed Sightseeing', category: 'cultural' },
            { id: 'a2', title: 'Lunch', category: 'dining', startTime: '13:00', endTime: '14:00' },
          ],
        },
        {
          dayNumber: 2,
          activities: [
            { id: 'b1', title: 'Hotel Checkout', category: 'accommodation', startTime: '11:00', endTime: '11:30' },
            { id: 'b2', title: 'Transfer to Airport', category: 'transport', startTime: '14:00', endTime: '15:00' },
          ],
        },
      ],
    };
    const out = parseItineraryDays(raw, tripStart, '2026-06-02');
    // a1 (untimed) must SURVIVE on day 1 — strip is departure-day only.
    expect(out[0].activities.find((a: any) => a.id === 'a1')).toBeDefined();
  });
});
