import { describe, it, expect, vi } from 'vitest';
import { getDisplayDayTitle } from '../dayTitleCoherence';

describe('getDisplayDayTitle', () => {
  it('preserves a coherent title', () => {
    const day = {
      dayNumber: 2,
      title: 'Le Marais Wandering',
      activities: [
        { title: 'Musée Picasso', category: 'cultural', neighborhood: 'Le Marais' },
        { title: 'Lunch at Breizh Café', category: 'dining', neighborhood: 'Le Marais' },
        { title: 'Place des Vosges Stroll', category: 'sightseeing', neighborhood: 'Le Marais' },
      ],
    };
    expect(getDisplayDayTitle(day, 'Paris')).toBe('Le Marais Wandering');
  });

  it('relabels mismatched neighborhood title', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const day = {
      dayNumber: 4,
      title: 'Montmartre Mornings',
      activities: [
        { title: 'Musée Picasso', category: 'cultural', neighborhood: 'Le Marais' },
        { title: 'Lunch at Breizh Café', category: 'dining', neighborhood: 'Le Marais' },
        { title: 'Place des Vosges Stroll', category: 'sightseeing', neighborhood: 'Le Marais' },
      ],
    };
    const out = getDisplayDayTitle(day, 'Paris');
    expect(out).not.toBe('Montmartre Mornings');
    expect(out.toLowerCase()).toContain('marais');
    warn.mockRestore();
  });

  it('keeps stored title when too few activities', () => {
    const day = {
      dayNumber: 1,
      title: 'Arrival in Paris',
      activities: [
        { title: 'Flight to CDG', category: 'transport' },
        { title: 'Hotel check-in', category: 'accommodation' },
      ],
    };
    expect(getDisplayDayTitle(day, 'Paris')).toBe('Arrival in Paris');
  });

  it('logistics-only day with generic title is preserved', () => {
    const day = {
      dayNumber: 1,
      title: 'Arrival',
      activities: [
        { title: 'Flight to CDG', category: 'transport' },
        { title: 'Transfer to hotel', category: 'transport' },
        { title: 'Hotel check-in', category: 'accommodation' },
      ],
    };
    // < 3 non-logistics activities → returns existing title
    expect(getDisplayDayTitle(day, 'Paris')).toBe('Arrival');
  });
});
