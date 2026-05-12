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
    expect(days[0].activities.length).toBe(2);
    expect(days[0].activities.map((a: any) => a.startTime).sort()).toEqual(['12:30', '14:00']);
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
    // Old behavior dropped the second card on bare title|start key.
    // Hardened key includes category, so both survive.
    expect(days[0].activities.length).toBe(2);
    expect(days[0].activities.some((a: any) => a.category === 'dining')).toBe(true);
  });
});
