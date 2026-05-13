import { describe, it, expect } from 'vitest';
import { classifyMealSlot } from '../TripHealthPanel';

describe('classifyMealSlot', () => {
  it('classifies dining card by lunch time-window', () => {
    expect(
      classifyMealSlot({ category: 'dining', title: 'José Enrique', startTime: '12:30' })
    ).toBe('lunch');
  });

  it('classifies dining card by dinner time-window', () => {
    expect(
      classifyMealSlot({ category: 'restaurant', title: 'Santaella', startTime: '7:45 PM' })
    ).toBe('dinner');
  });

  it('classifies brunch-window venue as breakfast', () => {
    expect(
      classifyMealSlot({ category: 'dining', title: 'Pinky\'s', startTime: '11:00 AM' })
    ).toBe('breakfast');
  });

  it('respects explicit mealSlot metadata', () => {
    expect(
      classifyMealSlot({ category: 'dining', title: 'Kasalta', startTime: '09:00', mealSlot: 'breakfast' })
    ).toBe('breakfast');
  });

  it('drinks-only nightcap does not satisfy dinner', () => {
    expect(
      classifyMealSlot({ category: 'dining', title: 'Mezzanine Nightcap', startTime: '22:30' })
    ).toBeNull();
  });

  it('returns null for non-dining card', () => {
    expect(
      classifyMealSlot({ category: 'museum', title: 'Castillo San Cristóbal', startTime: '10:00' })
    ).toBeNull();
  });

  it('afternoon coffee does not satisfy any meal', () => {
    expect(
      classifyMealSlot({ category: 'cafe', title: 'Cafe Cuatro Sombras', startTime: '16:00' })
    ).toBeNull();
  });

  // ── Bug A regression: real restaurants mislabeled by generator ─────────
  it('mislabeled cultural restaurant in lunch window → lunch (Katsukura)', () => {
    expect(
      classifyMealSlot({ category: 'cultural', title: 'Katsukura Sanjo Honten', startTime: '12:30' })
    ).toBe('lunch');
  });

  it('mislabeled experience sushi venue in dinner window → dinner', () => {
    expect(
      classifyMealSlot({ category: 'experience', title: 'Sushi Saito', startTime: '19:30' })
    ).toBe('dinner');
  });

  it('cuisine metadata signal counts as meal venue', () => {
    expect(
      classifyMealSlot({ category: 'experience', title: 'Casa Mono', startTime: '13:00', cuisine: 'spanish' })
    ).toBe('lunch');
  });

  it('temple in lunch window does NOT classify as lunch', () => {
    expect(
      classifyMealSlot({ category: 'cultural', title: 'Kennin-ji Temple', startTime: '12:30' })
    ).toBeNull();
  });

  it('walking transit in lunch window does NOT classify as lunch', () => {
    expect(
      classifyMealSlot({ category: 'transit', title: 'Walk to Gion', startTime: '12:30' })
    ).toBeNull();
  });

  it('park visit in lunch window does NOT classify as lunch', () => {
    expect(
      classifyMealSlot({ category: 'sightseeing', title: 'Maruyama Park stroll', startTime: '12:45' })
    ).toBeNull();
  });
});
