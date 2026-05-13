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
});
