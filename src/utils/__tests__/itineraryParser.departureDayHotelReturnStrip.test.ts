import { describe, it, expect } from 'vitest';
import { parseItineraryDays } from '../itineraryParser';

// Closes Osaka / Amsterdam / Sapporo recurring leak: a persisted hotel-return
// card showing up after the airport transfer on departure day.
describe('parseItineraryDays — departure-day hotel-return strip', () => {
  const tripStart = '2026-06-01';

  it('strips persisted "Return to {hotel}" / wind-down-overnight card from departure day with airport transfer', () => {
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
            { id: 'b2', title: 'Checkout from Four Seasons Hotel Osaka', category: 'accommodation', startTime: '11:00', endTime: '11:30' },
            { id: 'b3', title: 'Transfer to Kansai International Airport (KIX)', category: 'transport', startTime: '12:00', endTime: '13:00' },
            // The leak: a persisted bookend-overnight "Return to hotel"
            // sitting AFTER the airport transfer at ~13:55.
            {
              id: 'b4',
              title: 'Return to Four Seasons Hotel Osaka',
              category: 'accommodation',
              startTime: '13:55',
              endTime: '14:20',
              source: 'bookend-overnight',
              description: 'Head back to Four Seasons Hotel Osaka to wind down (overnight).',
            },
          ],
        },
      ],
    };
    const out = parseItineraryDays(raw, tripStart, '2026-06-02');
    expect(out).toHaveLength(2);
    const departureActs = out[1].activities;
    // The bookend-overnight row must be gone.
    expect(departureActs.find((a: any) => a.id === 'b4')).toBeUndefined();
    // The legitimate logistics rows survive.
    expect(departureActs.find((a: any) => a.id === 'b2')).toBeDefined();
    expect(departureActs.find((a: any) => a.id === 'b3')).toBeDefined();
    expect(departureActs.find((a: any) => a.id === 'b1')).toBeDefined();
  });

  it('strips persisted "Return to hotel" without bookend metadata on departure day', () => {
    const raw = {
      days: [
        { dayNumber: 1, activities: [{ id: 'a1', title: 'Lunch', category: 'dining', startTime: '13:00', endTime: '14:00' }] },
        {
          dayNumber: 2,
          activities: [
            { id: 'b1', title: 'Sightseeing', category: 'sightseeing', startTime: '10:00', endTime: '11:30' },
            { id: 'b2', title: 'Transfer to Schiphol Airport', category: 'transport', startTime: '12:00', endTime: '13:00' },
            // No source/tag, plain accommodation row.
            { id: 'b3', title: 'Return to Amsterdam Marriott Hotel', category: 'accommodation', startTime: '13:55', endTime: '14:20' },
          ],
        },
      ],
    };
    const out = parseItineraryDays(raw, tripStart, '2026-06-02');
    expect(out[1].activities.find((a: any) => a.id === 'b3')).toBeUndefined();
  });

  it('does NOT strip a locked / user-added "Return to hotel" row', () => {
    const raw = {
      days: [
        { dayNumber: 1, activities: [{ id: 'a1', title: 'Lunch', category: 'dining', startTime: '13:00', endTime: '14:00' }] },
        {
          dayNumber: 2,
          activities: [
            { id: 'b1', title: 'Checkout', category: 'accommodation', startTime: '11:00', endTime: '11:30' },
            { id: 'b2', title: 'Transfer to Airport', category: 'transport', startTime: '12:00', endTime: '13:00' },
            { id: 'b3', title: 'Return to Amsterdam Marriott Hotel', category: 'accommodation', startTime: '13:55', endTime: '14:20', isLocked: true },
          ],
        },
      ],
    };
    const out = parseItineraryDays(raw, tripStart, '2026-06-02');
    expect(out[1].activities.find((a: any) => a.id === 'b3')).toBeDefined();
  });

  it('preserves end-of-day "Return to hotel" on a NON-departure day', () => {
    const raw = {
      days: [
        {
          dayNumber: 1,
          activities: [
            { id: 'a1', title: 'Dinner', category: 'dining', startTime: '19:00', endTime: '20:30' },
            { id: 'a2', title: 'Return to Amsterdam Marriott Hotel', category: 'accommodation', startTime: '21:00', endTime: '21:30', source: 'bookend-readtime' },
          ],
        },
        {
          dayNumber: 2,
          activities: [
            { id: 'b1', title: 'Checkout', category: 'accommodation', startTime: '11:00', endTime: '11:30' },
            { id: 'b2', title: 'Transfer to Airport', category: 'transport', startTime: '12:00', endTime: '13:00' },
          ],
        },
      ],
    };
    const out = parseItineraryDays(raw, tripStart, '2026-06-02');
    // Day 1 (non-departure) keeps its hotel-return.
    expect(out[0].activities.find((a: any) => a.id === 'a2')).toBeDefined();
  });
});
