import { describe, it, expect } from 'vitest';
import { pruneDepartureUntimed, detectDepartureDayIdx } from '../pruneDepartureUntimed';

describe('pruneDepartureUntimed', () => {
  it('drops untimed dining card on departure day (Katsukura: real restaurant tagged cultural, no startTime)', () => {
    const acts = [
      { title: 'Hotel Checkout', category: 'accommodation', startTime: '10:00' },
      { title: 'Katsukura Sanjo Honten', category: 'cultural' /* no startTime */ },
      { title: 'Transfer to KIX Airport', category: 'transport', startTime: '12:00' },
    ];
    const { activities, droppedTitles } = pruneDepartureUntimed(acts);
    expect(droppedTitles).toEqual(['Katsukura Sanjo Honten']);
    expect(activities).toHaveLength(2);
    expect(activities.map((a: any) => a.title)).toEqual([
      'Hotel Checkout',
      'Transfer to KIX Airport',
    ]);
  });

  it('preserves logistics rows even when untimed', () => {
    const acts = [
      { title: 'Hotel Checkout', category: 'accommodation' /* untimed */ },
      { title: 'Transfer to Airport', category: 'transport' /* untimed */ },
    ];
    const { activities, droppedTitles } = pruneDepartureUntimed(acts);
    expect(droppedTitles).toEqual([]);
    expect(activities).toHaveLength(2);
  });

  it('preserves locked / userAdded / extracted rows even when untimed', () => {
    const acts = [
      { title: 'Locked Lunch', category: 'dining', isLocked: true },
      { title: 'User Lunch', category: 'dining', userAdded: true },
      { title: 'Extracted Lunch', category: 'dining', source: 'extracted' },
      { title: 'Untimed Floating Lunch', category: 'dining' },
    ];
    const { activities, droppedTitles } = pruneDepartureUntimed(acts);
    expect(droppedTitles).toEqual(['Untimed Floating Lunch']);
    expect(activities).toHaveLength(3);
  });

  it('keeps timed cards via startTime, start_time, or time alias', () => {
    const acts = [
      { title: 'Lunch A', category: 'dining', startTime: '12:30' },
      { title: 'Lunch B', category: 'dining', start_time: '13:00' },
      { title: 'Lunch C', category: 'dining', time: '13:30' },
      { title: 'Lunch D', category: 'dining' /* no time fields */ },
    ];
    const { droppedTitles } = pruneDepartureUntimed(acts);
    expect(droppedTitles).toEqual(['Lunch D']);
  });

  it('handles 12h AM/PM time strings', () => {
    const acts = [
      { title: 'Brunch', category: 'dining', startTime: '11:30 AM' },
      { title: 'Late Lunch', category: 'dining', startTime: '1:30 PM' },
      { title: 'Garbage Time', category: 'dining', startTime: 'soon' },
    ];
    const { droppedTitles } = pruneDepartureUntimed(acts);
    expect(droppedTitles).toEqual(['Garbage Time']);
  });

  it('returns empty result for empty/null inputs', () => {
    expect(pruneDepartureUntimed(null).activities).toEqual([]);
    expect(pruneDepartureUntimed(undefined).activities).toEqual([]);
    expect(pruneDepartureUntimed([]).activities).toEqual([]);
  });
});

describe('detectDepartureDayIdx', () => {
  it('finds last day with airport transfer', () => {
    const days = [
      { activities: [{ title: 'Lunch', category: 'dining' }] },
      { activities: [{ title: 'Transfer to Airport', category: 'transport' }] },
    ];
    expect(detectDepartureDayIdx(days)).toBe(1);
  });

  it('finds day with hotel checkout when transfer was stripped', () => {
    const days = [
      { activities: [{ title: 'Lunch' }] },
      { activities: [{ title: 'Hotel Checkout', category: 'accommodation' }] },
    ];
    expect(detectDepartureDayIdx(days)).toBe(1);
  });

  it('falls back to last day for multi-day trips with no signal', () => {
    const days = [
      { activities: [{ title: 'Lunch' }] },
      { activities: [{ title: 'Dinner' }] },
    ];
    expect(detectDepartureDayIdx(days)).toBe(1);
  });

  it('returns -1 for single-day trip with no departure signal', () => {
    const days = [{ activities: [{ title: 'Lunch' }] }];
    expect(detectDepartureDayIdx(days)).toBe(-1);
  });

  it('does not treat arrival flights as departure', () => {
    const days = [
      { activities: [{ title: 'Arrival Flight from JFK', category: 'flight' }] },
      { activities: [{ title: 'Lunch' }] },
    ];
    // Falls back to last day (multi-day) but the arrival on day 0 doesn't qualify.
    expect(detectDepartureDayIdx(days)).toBe(1);
  });
});
