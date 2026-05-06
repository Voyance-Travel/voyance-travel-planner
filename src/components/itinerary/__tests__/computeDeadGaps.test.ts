import { describe, it, expect } from 'vitest';
import { computeDeadGaps } from '../TransitGapIndicator';

const a = (over: any) => ({ id: over.id || Math.random().toString(), title: 'X', ...over });

describe('computeDeadGaps', () => {
  it('flags a 6h morning gap between non-transport activities', () => {
    const acts = [
      a({ title: 'Breakfast', category: 'dining', startTime: '08:30', endTime: '09:15' }),
      a({ title: 'Place Vendôme', category: 'attraction', startTime: '15:10', endTime: '16:30' }),
    ];
    const gaps = computeDeadGaps(acts);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].minutes).toBeGreaterThanOrEqual(180);
    expect(gaps[0].beforeIndex).toBe(0);
  });

  it('ignores gaps shorter than the threshold', () => {
    const acts = [
      a({ category: 'dining', startTime: '12:00', endTime: '13:00' }),
      a({ category: 'attraction', startTime: '14:00', endTime: '15:00' }),
    ];
    expect(computeDeadGaps(acts)).toHaveLength(0);
  });

  it('skips gaps adjacent to transport entries', () => {
    const acts = [
      a({ category: 'dining', startTime: '08:30', endTime: '09:15' }),
      a({ category: 'transport', startTime: '09:15', endTime: '09:30' }),
      a({ category: 'attraction', startTime: '15:10', endTime: '16:30' }),
    ];
    // dining→transport skipped; transport→attraction skipped
    expect(computeDeadGaps(acts)).toHaveLength(0);
  });

  it('skips gaps adjacent to logistics (checkout/airport)', () => {
    const acts = [
      a({ title: 'Hotel Checkout', category: 'accommodation', startTime: '08:00', endTime: '08:30' }),
      a({ title: 'Airport Transfer', category: 'logistics', startTime: '15:00', endTime: '16:00' }),
    ];
    expect(computeDeadGaps(acts)).toHaveLength(0);
  });

  it('skips overnight gaps outside the 09:00–18:00 window', () => {
    const acts = [
      a({ category: 'dining', startTime: '20:00', endTime: '22:00' }),
      a({ category: 'attraction', startTime: '06:00', endTime: '07:00' }), // next-day-style; no overlap
    ];
    expect(computeDeadGaps(acts)).toHaveLength(0);
  });
});
