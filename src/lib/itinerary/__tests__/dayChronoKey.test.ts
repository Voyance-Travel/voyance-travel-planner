import { describe, it, expect } from 'vitest';
import { dayChronoKey } from '../dayChronoKey';

describe('dayChronoKey', () => {
  it('places early-AM bookend after the prior late-night activity', () => {
    const acts = [
      { startTime: '09:00' },
      { startTime: '23:30' },
      { startTime: '00:55' },
    ];
    const sorted = [...acts].sort((a, b) => dayChronoKey(a.startTime) - dayChronoKey(b.startTime));
    expect(sorted.map((a) => a.startTime)).toEqual(['09:00', '23:30', '00:55']);
  });

  it('pushes untimed entries to the end', () => {
    const acts = [{ startTime: '' }, { startTime: '10:00' }, { startTime: undefined }];
    const sorted = [...acts].sort((a, b) => dayChronoKey(a.startTime) - dayChronoKey(b.startTime));
    expect(sorted[0].startTime).toBe('10:00');
  });

  it('handles am/pm strings', () => {
    expect(dayChronoKey('12:55 AM')).toBe(55 + 24 * 60);
    expect(dayChronoKey('11:45 PM')).toBe(23 * 60 + 45);
    expect(dayChronoKey('12:00 PM')).toBe(12 * 60);
  });

  it('respects custom wrap boundary', () => {
    expect(dayChronoKey('05:30', { wrapBoundaryMin: 4 * 60 })).toBe(5 * 60 + 30);
    expect(dayChronoKey('03:30', { wrapBoundaryMin: 4 * 60 })).toBe(3 * 60 + 30 + 24 * 60);
  });
});
