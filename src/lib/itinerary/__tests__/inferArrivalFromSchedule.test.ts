import { describe, it, expect } from 'vitest';
import { inferArrivalMinsFromSchedule } from '../inferArrivalFromSchedule';

describe('inferArrivalMinsFromSchedule', () => {
  it('skips transport-category logistics card and uses next real activity', () => {
    const acts = [
      { title: 'Travel to Casablanca Marriott Hotel', category: 'transport', startTime: '10:20' },
      { title: 'Luggage Drop at Casablanca Marriott Hotel', category: 'accommodation', startTime: '11:05' },
      { title: 'Hassan II Mosque Guided Tour', category: 'sightseeing', startTime: '12:45' },
    ];
    expect(inferArrivalMinsFromSchedule(acts)).toBe(12 * 60 + 45);
  });

  it('skips synthetic 08:00 transport when next real activity is 11:30', () => {
    const acts = [
      { title: 'Travel to Hotel', category: 'transport', startTime: '08:00' },
      { title: 'Mosque tour', category: 'sightseeing', startTime: '11:30' },
    ];
    expect(inferArrivalMinsFromSchedule(acts)).toBe(11 * 60 + 30);
  });

  it('skips luggage drop card by title even when category is generic', () => {
    const acts = [
      { title: 'Luggage Drop at Hotel', category: 'activity', startTime: '09:50' },
      { title: 'City walk', category: 'sightseeing', startTime: '11:45' },
    ];
    expect(inferArrivalMinsFromSchedule(acts)).toBe(11 * 60 + 45);
  });

  it('returns the start of the first real activity when it is the very first card', () => {
    const acts = [{ title: 'Museum visit', category: 'culture', startTime: '09:00' }];
    expect(inferArrivalMinsFromSchedule(acts)).toBe(9 * 60);
  });

  it('returns null when the schedule is entirely logistics', () => {
    const acts = [
      { title: 'Travel to Hotel', category: 'transport', startTime: '10:20' },
      { title: 'Check-in', category: 'check-in', startTime: '15:00' },
      { title: 'Return to Your Hotel', category: 'accommodation', startTime: '22:00' },
    ];
    expect(inferArrivalMinsFromSchedule(acts)).toBeNull();
  });

  it('parses 12h AM/PM clocks', () => {
    const acts = [{ title: 'Tour', category: 'sightseeing', startTime: '11:30 AM' }];
    expect(inferArrivalMinsFromSchedule(acts)).toBe(11 * 60 + 30);
  });

  it('returns null for empty / non-array input', () => {
    expect(inferArrivalMinsFromSchedule(null)).toBeNull();
    expect(inferArrivalMinsFromSchedule(undefined)).toBeNull();
    expect(inferArrivalMinsFromSchedule([])).toBeNull();
  });
});
