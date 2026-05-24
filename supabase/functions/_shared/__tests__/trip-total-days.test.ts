/**
 * trip-total-days helper — Bangkok-class regression guard.
 *
 * Verifies the canonical "how many days is this trip?" answer always
 * takes max across (date span, table count, generation_total_days, json
 * length) so a temporary JSON shrink can never silently rewrite trip
 * duration.
 */
import { describe, it, expect } from 'vitest';
import { dateSpanDays, totalDays } from '../trip-total-days.ts';

describe('trip-total-days', () => {
  describe('dateSpanDays', () => {
    it('inclusive span: Aug 10 → Aug 13 is 4 days', () => {
      expect(dateSpanDays({ start_date: '2025-08-10', end_date: '2025-08-13' })).toBe(4);
    });
    it('1-day trip', () => {
      expect(dateSpanDays({ start_date: '2025-08-10', end_date: '2025-08-10' })).toBe(1);
    });
    it('missing dates → 0', () => {
      expect(dateSpanDays({})).toBe(0);
      expect(dateSpanDays(null)).toBe(0);
    });
    it('inverted dates → 0 (defensive, never negative)', () => {
      expect(dateSpanDays({ start_date: '2025-08-13', end_date: '2025-08-10' })).toBe(0);
    });
  });

  describe('totalDays', () => {
    it('date span wins over short json (Bangkok pattern)', () => {
      expect(totalDays({
        trip: { start_date: '2025-08-10', end_date: '2025-08-13' },
        itineraryDaysTableCount: 4,
        generationTotalDays: 4,
        jsonDaysLength: 1,
      })).toBe(4);
    });
    it('table count wins when dates missing', () => {
      expect(totalDays({ itineraryDaysTableCount: 4, jsonDaysLength: 1 })).toBe(4);
    });
    it('json length used only as last fallback', () => {
      expect(totalDays({ jsonDaysLength: 3 })).toBe(3);
    });
    it('returns >= 1 even when every source is zero/missing', () => {
      expect(totalDays({})).toBe(1);
    });
    it('ignores non-finite / negative values', () => {
      expect(totalDays({
        jsonDaysLength: -5,
        itineraryDaysTableCount: NaN as any,
        generationTotalDays: 4,
      })).toBe(4);
    });
  });
});
