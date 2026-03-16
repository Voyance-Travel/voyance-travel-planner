import { describe, it, expect } from 'vitest';
import {
  resolveGroupTotal,
  resolvePerPersonForDb,
  resolveCategory,
  computeItineraryTotal,
} from './trip-pricing';

describe('resolveGroupTotal', () => {
  it('multiplies plain number by travelers (per_person default)', () => {
    expect(resolveGroupTotal(25, 2)).toBe(50);
    expect(resolveGroupTotal(25, 1)).toBe(25);
  });

  it('handles per_person basis object', () => {
    expect(resolveGroupTotal({ amount: 30, basis: 'per_person' }, 3)).toBe(90);
  });

  it('does NOT multiply flat basis', () => {
    expect(resolveGroupTotal({ amount: 60, basis: 'flat' }, 2)).toBe(60);
    expect(resolveGroupTotal({ amount: 60, basis: 'flat' }, 4)).toBe(60);
  });

  it('does NOT multiply per_room basis', () => {
    expect(resolveGroupTotal({ amount: 200, basis: 'per_room' }, 2)).toBe(200);
  });

  it('uses total field directly when provided', () => {
    expect(resolveGroupTotal({ amount: 25, total: 80 }, 2)).toBe(80);
  });

  it('returns 0 for null/undefined', () => {
    expect(resolveGroupTotal(null, 2)).toBe(0);
    expect(resolveGroupTotal(undefined, 2)).toBe(0);
  });

  it('defaults to per_person when basis is missing', () => {
    expect(resolveGroupTotal({ amount: 20 }, 3)).toBe(60);
  });
});

describe('resolvePerPersonForDb', () => {
  it('returns amount as-is for per_person basis', () => {
    expect(resolvePerPersonForDb({ amount: 30, basis: 'per_person' }, 2)).toBe(30);
  });

  it('divides flat amount by travelers', () => {
    expect(resolvePerPersonForDb({ amount: 60, basis: 'flat' }, 2)).toBe(30);
    expect(resolvePerPersonForDb({ amount: 60, basis: 'flat' }, 3)).toBe(20);
  });

  it('divides per_room by travelers', () => {
    expect(resolvePerPersonForDb({ amount: 200, basis: 'per_room' }, 2)).toBe(100);
  });

  it('derives per-person from total field', () => {
    expect(resolvePerPersonForDb({ total: 90 }, 3)).toBe(30);
  });

  it('plain number treated as per_person', () => {
    expect(resolvePerPersonForDb(25, 2)).toBe(25);
  });
});

describe('resolveCategory', () => {
  it('maps dining variants to dining', () => {
    expect(resolveCategory('restaurant')).toBe('dining');
    expect(resolveCategory('breakfast')).toBe('dining');
    expect(resolveCategory('Dinner')).toBe('dining');
  });

  it('maps transport variants to transport', () => {
    expect(resolveCategory('taxi')).toBe('transport');
    expect(resolveCategory('transfer')).toBe('transport');
  });

  it('preserves unknown categories', () => {
    expect(resolveCategory('spa')).toBe('spa');
  });

  it('falls back to type when category is undefined', () => {
    expect(resolveCategory(undefined, 'restaurant')).toBe('dining');
  });
});

describe('computeItineraryTotal', () => {
  it('sums group totals across days', () => {
    const days = [
      {
        activities: [
          { cost: { amount: 20, basis: 'per_person' as const } },
          { cost: { amount: 60, basis: 'flat' as const } },
        ],
      },
      {
        activities: [
          { cost: 15 },
        ],
      },
    ];
    // Day 1: 20*2=40 + 60(flat)=60 = 100
    // Day 2: 15*2=30
    // Total: 130
    expect(computeItineraryTotal(days, 2)).toBe(130);
  });

  it('budget coach swap on flat item never increases total', () => {
    // Before swap: flat dining at $60 for 2 travelers
    const before = [{ activities: [{ cost: { amount: 60, basis: 'flat' as const } }] }];
    const totalBefore = computeItineraryTotal(before, 2); // 60

    // After swap: new venue at $40, preserving flat basis
    const after = [{ activities: [{ cost: { amount: 40, basis: 'flat' as const } }] }];
    const totalAfter = computeItineraryTotal(after, 2); // 40

    expect(totalAfter).toBeLessThan(totalBefore);
  });
});
