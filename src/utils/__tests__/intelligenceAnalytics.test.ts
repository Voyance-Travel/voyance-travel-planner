import { describe, it, expect } from 'vitest';
import {
  calculateItineraryValueStats,
  parseMoneySavings,
  parseTimeSavings,
} from '../intelligenceAnalytics';

describe('parseMoneySavings', () => {
  it('parses common formats', () => {
    expect(parseMoneySavings('$40')).toBe(40);
    expect(parseMoneySavings('€25')).toBe(25);
    expect(parseMoneySavings('$1,200')).toBe(1200);
    expect(parseMoneySavings('30')).toBe(30);
  });
  it('returns 0 for invalid input', () => {
    expect(parseMoneySavings(undefined)).toBe(0);
    expect(parseMoneySavings('')).toBe(0);
    expect(parseMoneySavings('lots')).toBe(0);
  });
});

describe('parseTimeSavings', () => {
  it('parses minutes and hours', () => {
    expect(parseTimeSavings('45 min')).toBe(45);
    expect(parseTimeSavings('3 hours')).toBe(180);
    expect(parseTimeSavings('1 hour')).toBe(60);
    expect(parseTimeSavings('2 hrs')).toBe(120);
    expect(parseTimeSavings('1 day')).toBe(1440);
  });
  it('returns 0 for unparseable input', () => {
    expect(parseTimeSavings(undefined)).toBe(0);
    expect(parseTimeSavings('lots of time')).toBe(0);
  });
});

describe('calculateItineraryValueStats — savings come only from skippedItems', () => {
  it('returns no savings when no skippedItems', () => {
    const stats = calculateItineraryValueStats(
      [{ activities: [{ name: 'X', tips: 'a'.repeat(50), bestTime: '7am' }] }],
      [],
    );
    expect(stats.estimatedSavings).toBeUndefined();
  });

  it('aggregates real money + time from skippedItems', () => {
    const stats = calculateItineraryValueStats(
      [{ activities: [] }],
      [
        { name: 'A', reason: 'r', savingsEstimate: { money: '$40', time: '45 min' } },
        { name: 'B', reason: 'r', savingsEstimate: { money: '$25' } },
        { name: 'C', reason: 'r', savingsEstimate: { time: '3 hours' } },
      ],
    );
    expect(stats.estimatedSavings).toBeDefined();
    expect(stats.estimatedSavings!.money).toBe('~$65');
    expect(stats.estimatedSavings!.time).toMatch(/hour/);
  });

  it('returns undefined estimatedSavings when skippedItems have no savings data', () => {
    const stats = calculateItineraryValueStats(
      [{ activities: [] }],
      [{ name: 'A', reason: 'r' }],
    );
    expect(stats.estimatedSavings).toBeUndefined();
  });

  it('does not fabricate savings from heuristic timing/gem counts', () => {
    const stats = calculateItineraryValueStats(
      [{
        activities: [
          { name: 'X', isHiddenGem: true, hasTimingHack: true, tips: 'a'.repeat(60) },
          { name: 'Y', isHiddenGem: true, hasTimingHack: true, tips: 'b'.repeat(60) },
        ],
      }],
      [],
    );
    // Even though 2 gems + 2 timing hacks are present, no skipped items means no savings
    expect(stats.voyanceFinds).toBe(2);
    expect(stats.timingOptimizations).toBe(2);
    expect(stats.estimatedSavings).toBeUndefined();
  });

  it('does not assign fabricated per-item timing savings string', () => {
    const stats = calculateItineraryValueStats(
      [{ activities: [{ name: 'X', hasTimingHack: true, bestTime: '7am' }] }],
      [],
    );
    expect(stats.timingDetails[0].savingsTime).toBeUndefined();
  });
});
