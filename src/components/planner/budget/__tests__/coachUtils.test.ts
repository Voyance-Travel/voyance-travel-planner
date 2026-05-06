import { describe, it, expect } from 'vitest';
import {
  isSuggestableActivity,
  hasSuggestableContent,
  isGenericCoachTitle,
  isCoachEligible,
  type CoachActivity,
  type CoachDay,
} from '../coachUtils';

const make = (overrides: Partial<CoachActivity>): CoachActivity => ({
  id: 'a1',
  title: 'Dinner at Le Jules Verne',
  category: 'dining',
  cost: 250,
  ...overrides,
});

describe('isGenericCoachTitle', () => {
  it('flags placeholder titles', () => {
    expect(isGenericCoachTitle('Free time')).toBe(true);
    expect(isGenericCoachTitle('Activity')).toBe(true);
    expect(isGenericCoachTitle('Untitled')).toBe(true);
    expect(isGenericCoachTitle('Dinner —')).toBe(true);
    expect(isGenericCoachTitle('Explore the neighborhood')).toBe(true);
    expect(isGenericCoachTitle('')).toBe(true);
  });
  it('accepts real venue names', () => {
    expect(isGenericCoachTitle('Dinner at Le Jules Verne')).toBe(false);
    expect(isGenericCoachTitle('Louvre Museum')).toBe(false);
  });
});

describe('isSuggestableActivity', () => {
  it('accepts paid, non-locked, real-named activity', () => {
    expect(isSuggestableActivity(make({}))).toBe(true);
  });
  it('rejects hotel rows', () => {
    expect(isSuggestableActivity(make({ category: 'hotel', title: 'Hotel Plaza' }))).toBe(false);
  });
  it('rejects check-in / check-out / bag-drop / return-to-hotel', () => {
    expect(isSuggestableActivity(make({ title: 'Hotel Check-in', category: 'logistics' }))).toBe(false);
    expect(isSuggestableActivity(make({ title: 'Bag drop at hotel', category: 'logistics' }))).toBe(false);
    expect(isSuggestableActivity(make({ title: 'Return to your hotel', category: 'leisure' }))).toBe(false);
  });
  it('rejects generic placeholder titles', () => {
    expect(isSuggestableActivity(make({ title: 'Free time' }))).toBe(false);
    expect(isSuggestableActivity(make({ title: 'Explore the neighborhood' }))).toBe(false);
    expect(isSuggestableActivity(make({ title: 'Activity' }))).toBe(false);
  });
  it('rejects $0 activities', () => {
    expect(isSuggestableActivity(make({ cost: 0 }))).toBe(false);
    expect(isSuggestableActivity(make({ cost: null as any }))).toBe(false);
  });
  it('rejects locked activities', () => {
    expect(isSuggestableActivity(make({ isLocked: true }))).toBe(false);
  });
  it('rejects rows without an id', () => {
    expect(isSuggestableActivity(make({ id: undefined }))).toBe(false);
  });
  it('reads cost from object form', () => {
    expect(isSuggestableActivity(make({ cost: { amount: 100 } }))).toBe(true);
    expect(isSuggestableActivity(make({ cost: { amount: 0 } }))).toBe(false);
  });
});

describe('hasSuggestableContent', () => {
  const hotelOnly: CoachDay[] = [
    { dayNumber: 1, activities: [make({ id: 'h', title: 'Four Seasons George V', category: 'hotel', cost: 1200 })] },
  ];
  const hotelPlusFiller: CoachDay[] = [
    {
      dayNumber: 1,
      activities: [
        make({ id: 'h', title: 'Four Seasons George V', category: 'hotel', cost: 1200 }),
        make({ id: 'f', title: 'Free time', category: 'leisure', cost: 0 }),
      ],
    },
  ];
  const hotelPlusRealDinner: CoachDay[] = [
    {
      dayNumber: 1,
      activities: [
        make({ id: 'h', title: 'Four Seasons George V', category: 'hotel', cost: 1200 }),
        make({ id: 'd', title: 'Dinner at Le Jules Verne', category: 'dining', cost: 250 }),
      ],
    },
  ];

  it('hotel-only itinerary → false (root cause of phantom suggestions)', () => {
    expect(hasSuggestableContent(hotelOnly)).toBe(false);
  });
  it('hotel + generic Free time → false', () => {
    expect(hasSuggestableContent(hotelPlusFiller)).toBe(false);
  });
  it('hotel + one priced real dinner → true', () => {
    expect(hasSuggestableContent(hotelPlusRealDinner)).toBe(true);
  });
  it('null / empty input → false', () => {
    expect(hasSuggestableContent(null)).toBe(false);
    expect(hasSuggestableContent([])).toBe(false);
    expect(hasSuggestableContent([{ dayNumber: 1, activities: [] }])).toBe(false);
  });
  it('locked priced activity does NOT count', () => {
    const days: CoachDay[] = [
      {
        dayNumber: 1,
        activities: [make({ id: 'l', title: 'Dinner at Le Jules Verne', isLocked: true, cost: 250 })],
      },
    ];
    expect(hasSuggestableContent(days)).toBe(false);
  });
});

describe('isCoachEligible', () => {
  const hotel = (id = 'h') =>
    make({ id, title: 'Four Seasons George V', category: 'hotel', cost: 1200 });
  const dinner = (id: string, title = 'Dinner at Le Jules Verne') =>
    make({ id, title, category: 'dining', cost: 250 });

  it('hotel-only multi-day → false', () => {
    const days: CoachDay[] = [
      { dayNumber: 1, activities: [hotel()] },
      { dayNumber: 2, activities: [hotel('h2')] },
      { dayNumber: 3, activities: [hotel('h3')] },
    ];
    expect(isCoachEligible({ days })).toBe(false);
  });

  it('hotel + single paid dinner across 3 days → false (regression: phantom over-budget suggestions)', () => {
    const days: CoachDay[] = [
      { dayNumber: 1, activities: [hotel(), dinner('d1')] },
      { dayNumber: 2, activities: [hotel('h2')] },
      { dayNumber: 3, activities: [hotel('h3')] },
    ];
    expect(isCoachEligible({ days })).toBe(false);
  });

  it('hotel + 2 paid activities across 3 days → true', () => {
    const days: CoachDay[] = [
      { dayNumber: 1, activities: [hotel(), dinner('d1')] },
      { dayNumber: 2, activities: [hotel('h2'), dinner('d2', 'Dinner at Septime')] },
      { dayNumber: 3, activities: [hotel('h3')] },
    ];
    expect(isCoachEligible({ days })).toBe(true);
  });

  it('failed status with incomplete_itinerary → false even when activities exist', () => {
    const days: CoachDay[] = [
      { dayNumber: 1, activities: [hotel(), dinner('d1')] },
      { dayNumber: 2, activities: [hotel('h2'), dinner('d2', 'Dinner at Septime')] },
    ];
    expect(
      isCoachEligible({
        days,
        tripStatus: 'failed',
        generationFailureReason: 'incomplete_itinerary',
      }),
    ).toBe(false);
  });

  it('single-day trip with 1 paid dinner → true (single-day exemption)', () => {
    const days: CoachDay[] = [
      { dayNumber: 1, activities: [hotel(), dinner('d1')] },
    ];
    expect(isCoachEligible({ days })).toBe(true);
  });

  it('null / empty days → false', () => {
    expect(isCoachEligible({ days: null })).toBe(false);
    expect(isCoachEligible({ days: [] })).toBe(false);
  });
});
