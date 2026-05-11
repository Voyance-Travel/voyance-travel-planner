import { describe, it, expect } from 'vitest';
import { detectGapsForDay } from '../TripHealthPanel';

const a = (over: Record<string, any>) => ({
  category: 'sightseeing',
  ...over,
});

describe('detectGapsForDay — day-boundary invariant', () => {
  it('does NOT flag overnight window between Day 2 last activity and Day 3 first', () => {
    const flat = [
      a({ dayNumber: 2, title: 'Cena',  startTime: '20:00', endTime: '21:40' }),
      a({ dayNumber: 3, title: 'Misión Café', startTime: '08:30', endTime: '09:30' }),
      a({ dayNumber: 3, title: 'Reina Sofía',  startTime: '10:00', endTime: '12:30' }),
    ];
    const gaps = detectGapsForDay(flat, 3);
    expect(gaps).toHaveLength(0);
  });

  it('flags real intra-day 7h gap (lunch → dinner)', () => {
    const acts = [
      a({ dayNumber: 3, title: 'Lunch',  startTime: '12:00', endTime: '13:00' }),
      a({ dayNumber: 3, title: 'Dinner', startTime: '20:00', endTime: '22:00' }),
    ];
    const gaps = detectGapsForDay(acts, 3);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].message).toMatch(/7h gap before Dinner/);
  });

  it('does NOT emit a synthetic gap before the first activity', () => {
    const acts = [
      a({ dayNumber: 3, title: 'Misión Café', startTime: '08:30', endTime: '09:30' }),
    ];
    expect(detectGapsForDay(acts, 3)).toHaveLength(0);
  });

  it('skips wrap-past-midnight nightcap mis-tagged on day 3', () => {
    const acts = [
      a({ dayNumber: 3, title: 'Stray Nightcap', startTime: '22:00', endTime: '01:30' }),
      a({ dayNumber: 3, title: 'Misión Café',    startTime: '08:30', endTime: '09:30' }),
    ];
    expect(detectGapsForDay(acts, 3)).toHaveLength(0);
  });

  it('skips pre-dawn residue rows', () => {
    const acts = [
      a({ dayNumber: 3, title: 'Phantom 03:00', startTime: '03:00', endTime: '04:00' }),
      a({ dayNumber: 3, title: 'Misión Café',  startTime: '08:30', endTime: '09:30' }),
    ];
    expect(detectGapsForDay(acts, 3)).toHaveLength(0);
  });

  it('returns no gaps for a bookend/transit-only day', () => {
    const acts = [
      a({ dayNumber: 1, category: 'check-in', title: 'Hotel check-in', startTime: '15:00', endTime: '15:30' }),
      a({ dayNumber: 1, category: 'transfer', title: 'Transfer to hotel', startTime: '14:00', endTime: '14:45' }),
      a({ dayNumber: 1, title: 'Walk to hotel', startTime: '14:50', endTime: '15:00' }),
    ];
    expect(detectGapsForDay(acts, 1)).toHaveLength(0);
  });

  it('only inspects day-N rows when caller passes a polluted flat list', () => {
    const flat = [
      a({ dayNumber: 1, title: 'D1 morning', startTime: '09:00', endTime: '10:00' }),
      a({ dayNumber: 1, title: 'D1 evening', startTime: '20:00', endTime: '22:00' }), // 10h gap on D1
      a({ dayNumber: 2, title: 'D2 only',    startTime: '10:00', endTime: '11:00' }),
    ];
    const d2 = detectGapsForDay(flat, 2);
    expect(d2).toHaveLength(0);
    const d1 = detectGapsForDay(flat, 1);
    expect(d1).toHaveLength(1);
    expect(d1[0].message).toMatch(/10h gap before D1 evening/);
  });

  it('accepts snake_case day_number alias', () => {
    const acts = [
      { day_number: 3, title: 'Lunch',  startTime: '12:00', endTime: '13:00', category: 'dining' },
      { day_number: 3, title: 'Dinner', startTime: '20:00', endTime: '22:00', category: 'dining' },
    ];
    expect(detectGapsForDay(acts, 3)).toHaveLength(1);
  });

  // ── M3 wrap-detection edge case (user addendum) ──
  it('M3: skips Return to Hotel ending exactly at 00:00 (midnight wrap)', () => {
    const acts = [
      a({ dayNumber: 3, title: 'Return to Hotel', startTime: '23:30', endTime: '00:00' }),
      a({ dayNumber: 3, title: 'Misión Café',     startTime: '08:30', endTime: '09:30' }),
    ];
    expect(detectGapsForDay(acts, 3)).toHaveLength(0);
  });

  it('M3: skips wrap with end===0 (exact midnight) on a non-bookend stray', () => {
    // Even when the title doesn't match the bookend regex, the wrap predicate
    // alone must discard a 22:00→00:00 row so it can't anchor a phantom gap.
    const acts = [
      a({ dayNumber: 3, title: 'Late Tasting', category: 'dining', startTime: '22:00', endTime: '00:00' }),
      a({ dayNumber: 3, title: 'Brunch',       category: 'dining', startTime: '11:00', endTime: '12:00' }),
    ];
    expect(detectGapsForDay(acts, 3)).toHaveLength(0);
  });
});
