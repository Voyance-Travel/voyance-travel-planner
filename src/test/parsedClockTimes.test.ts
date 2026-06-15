import { describe, it, expect } from 'vitest';
import { convertParsedToItineraryData } from '@/utils/createTripFromParsed';
import { parseTimeToMinutes } from '@/utils/timeFormat';
import { timeOfDayBand } from '@/lib/itinerary/timeOfDayBand';
import type { ParsedTripInput } from '@/types/parsedTrip';

// Mirrors what the live parse-trip-input edge fn returns for a pasted ChatGPT
// itinerary: coarse time-of-day LABELS, not clock times.
const PARSED: ParsedTripInput = {
  destination: 'Austin',
  days: [
    {
      dayNumber: 1,
      activities: [
        { name: 'Cosmic Coffee', time: 'Morning', category: 'dining', source: 'parsed' },
        { name: 'Franklin BBQ', time: 'Lunch', category: 'dining', cost: 25, source: 'parsed' },
        { name: 'Barton Springs Pool', time: 'Afternoon', category: 'relaxation', cost: 9, source: 'parsed' },
        { name: 'Uchi', time: 'Dinner', category: 'dining', isOption: true, optionGroup: 'dinner-d1', source: 'parsed' },
        { name: 'Loro', time: 'Dinner', category: 'dining', isOption: true, optionGroup: 'dinner-d1', source: 'parsed' },
        { name: 'The Continental Club', time: 'Evening', category: 'nightlife', source: 'parsed' },
      ],
    },
  ],
};

describe('manual-paste converter assigns real clock times from labels', () => {
  const out = convertParsedToItineraryData(PARSED);
  const acts = out.days[0].activities as Array<{ name: string; startTime?: string }>;

  it('never leaves a coarse label as the startTime', () => {
    for (const a of acts) {
      expect(a.startTime).toMatch(/^\d{2}:\d{2}$/);
      expect(['morning', 'lunch', 'dinner', 'afternoon', 'evening']).not.toContain((a.startTime || '').toLowerCase());
    }
  });

  it('collapses the either/or dinner to a single stop', () => {
    expect(acts.filter((a) => a.name === 'Uchi' || a.name === 'Loro').length).toBe(1);
  });

  it('produces a strictly increasing, non-colliding schedule (no 00:00 pile-up)', () => {
    const mins = acts.map((a) => parseTimeToMinutes(a.startTime));
    for (let i = 1; i < mins.length; i++) expect(mins[i]).toBeGreaterThan(mins[i - 1]);
    expect(new Set(mins).size).toBe(mins.length); // no two cards share a minute
  });

  it('anchors labels to sensible bands — morning AM, dinner in the evening', () => {
    const byName = Object.fromEntries(acts.map((a) => [a.name, a.startTime!]));
    expect(timeOfDayBand(byName['Cosmic Coffee'])).toBe('Morning');
    expect(timeOfDayBand(byName['Franklin BBQ'])).toBe('Afternoon'); // lunch ~12:30
    expect(timeOfDayBand(byName['The Continental Club'])).toBe('Evening');
    expect(parseTimeToMinutes(byName['Uchi'])).toBeGreaterThanOrEqual(18 * 60);
  });

  it('honors an explicit clock time verbatim', () => {
    const o = convertParsedToItineraryData({
      destination: 'Austin',
      days: [{ dayNumber: 1, activities: [{ name: 'Tour', time: '7:30 PM', source: 'parsed' }] }],
    } as ParsedTripInput);
    expect((o.days[0].activities[0] as any).startTime).toBe('19:30');
  });
});
