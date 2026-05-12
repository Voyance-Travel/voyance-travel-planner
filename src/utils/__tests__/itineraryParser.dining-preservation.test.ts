import { describe, it, expect } from 'vitest';
import { parseItineraryDays } from '../itineraryParser';

const baseDay = (overrides: any = {}) => ({
  dayNumber: 1,
  date: '2026-06-01',
  activities: [],
  ...overrides,
});

// `parseItineraryDays` runs the read-time hotel-return safety net (Step 4b),
// which can append a synthetic bookend card. These dedup tests only care
// about the parser's own output — strip bookend cards before counting.
const stripBookends = (acts: any[]) =>
  acts.filter(a => !String(a?.source || '').startsWith('bookend-'));

describe('parseItineraryDays — dining preservation (Bruges meal-loss fix)', () => {
  it('keeps two dining cards with same title but different startTimes', () => {
    const data = {
      days: [
        baseDay({
          activities: [
            { title: 'Lunch', startTime: '12:30', category: 'dining', venue_name: 'Cafe A' },
            { title: 'Lunch', startTime: '14:00', category: 'dining', venue_name: 'Cafe B' },
          ],
        }),
      ],
    };
    const days = parseItineraryDays(data, '2026-06-01');
    const acts = stripBookends(days[0].activities);
    expect(acts.length).toBe(2);
    expect(acts.map((a: any) => a.startTime).sort()).toEqual(['12:30', '14:00']);
  });

  it('keeps two dining cards with empty startTime (empty-time dedup exempt)', () => {
    const data = {
      days: [
        baseDay({
          activities: [
            { title: 'Lunch', startTime: '', category: 'dining', venue_name: 'Cafe A' },
            { title: 'Lunch', startTime: '', category: 'dining', venue_name: 'Cafe B' },
          ],
        }),
      ],
    };
    const days = parseItineraryDays(data, '2026-06-01');
    expect(days[0].activities.length).toBe(2);
  });

  it('salvages dining from duplicate dayNumber when winner lacks the meal', () => {
    const data = {
      days: [
        baseDay({
          dayNumber: 2,
          date: '2026-06-02',
          activities: [
            { title: 'Museum visit', startTime: '10:00', category: 'sightseeing' },
            { title: 'Walk to square', startTime: '14:00', category: 'transport' },
            { title: 'Hotel return', startTime: '22:00', category: 'accommodation' },
          ],
        }),
        baseDay({
          dayNumber: 2,
          date: '2026-06-02',
          activities: [
            { title: 'Dinner at Den Gouden Harynck', startTime: '19:30', category: 'dining', venue_name: 'Den Gouden Harynck' },
          ],
        }),
      ],
    };
    const days = parseItineraryDays(data, '2026-06-01');
    expect(days.length).toBe(1);
    const titles = days[0].activities.map((a: any) => a.title);
    expect(titles).toContain('Dinner at Den Gouden Harynck');
    expect(titles).toContain('Museum visit');
  });

  it('with hardened key (category included), different-category same-time cards both survive', () => {
    const data = {
      days: [
        baseDay({
          activities: [
            { title: 'Lunch', startTime: '12:30', category: 'transport' },
            { title: 'Lunch', startTime: '12:30', category: 'dining', venue_name: 'Bistro' },
          ],
        }),
      ],
    };
    const days = parseItineraryDays(data, '2026-06-01');
    const acts = stripBookends(days[0].activities);
    // Old behavior dropped the second card on bare title|start key.
    // Hardened key includes category, so both survive.
    expect(acts.length).toBe(2);
    expect(acts.some((a: any) => a.category === 'dining')).toBe(true);
  });
});

describe('parseItineraryDays — hotel return dedupe', () => {
  it('keeps one generated hotel return and does not append a read-time duplicate', () => {
    const data = {
      days: [
        baseDay({
          activities: [
            { title: 'Dinner', startTime: '19:00', endTime: '20:30', category: 'dining' },
            { title: 'Return to The Notary', startTime: '20:45', endTime: '21:10', category: 'accommodation', source: 'bookend-validator' },
            { title: 'Return to The Notary', startTime: '21:15', endTime: '21:40', category: 'accommodation', source: 'bookend-readtime' },
          ],
        }),
      ],
    };
    const days = parseItineraryDays(data, '2026-06-01');
    const returns = days[0].activities.filter((a: any) => /return to/i.test(String(a.title)));
    expect(returns).toHaveLength(1);
    expect(returns[0].startTime).toBe('21:15');
  });

  it('does not inject hotel return on departure day with flight card', () => {
    const data = {
      days: [
        baseDay({
          activities: [
            { title: 'Brunch', startTime: '10:00', endTime: '11:00', category: 'dining' },
            { title: 'Departure Flight to JFK', startTime: '17:50', endTime: '19:50', category: 'flight' },
          ],
        }),
      ],
    };
    const days = parseItineraryDays(data, '2026-06-01');
    expect(days[0].activities.some((a: any) => /return to/i.test(String(a.title)))).toBe(false);
  });

  it('preserves locked/manual hotel returns while removing generated duplicates', () => {
    const data = {
      days: [
        baseDay({
          activities: [
            { title: 'Return to The Notary', startTime: '20:45', endTime: '21:10', category: 'accommodation', source: 'manual', isLocked: true },
            { title: 'Return to The Notary', startTime: '21:15', endTime: '21:40', category: 'accommodation', source: 'bookend-readtime' },
          ],
        }),
      ],
    };
    const days = parseItineraryDays(data, '2026-06-01');
    const returns = days[0].activities.filter((a: any) => /return to/i.test(String(a.title)));
    expect(returns).toHaveLength(1);
    expect(returns[0].source).toBe('manual');
    expect(returns[0].isLocked).toBe(true);
  });
});
