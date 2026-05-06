import { describe, it, expect } from 'vitest';
import { isAIStubVenueName, inferMealTypeFromTime, stubFallbackLabel } from '../stubVenueDetection';
import { sanitizeActivityName } from '../activityNameSanitizer';

describe('isAIStubVenueName', () => {
  it('flags bare French stub venues', () => {
    expect(isAIStubVenueName('Table du Quartier')).toBe(true);
    expect(isAIStubVenueName('Café Matinal')).toBe(true);
    expect(isAIStubVenueName('Bistrot du Marché')).toBe(true);
    expect(isAIStubVenueName('Boulangerie du Quartier')).toBe(true);
    expect(isAIStubVenueName('Le Petit Matin')).toBe(true);
  });

  it('flags meal-prefixed stubs ("Lunch at Table du Quartier")', () => {
    expect(isAIStubVenueName('Lunch at Table du Quartier')).toBe(true);
    expect(isAIStubVenueName('Breakfast — Café Matinal')).toBe(true);
  });

  it('does NOT flag real restaurants', () => {
    expect(isAIStubVenueName('Le Comptoir du Relais')).toBe(false);
    expect(isAIStubVenueName('Septime')).toBe(false);
    expect(isAIStubVenueName('Café de Flore')).toBe(false);
    expect(isAIStubVenueName("Chez L'Ami Jean")).toBe(false);
  });

  it('handles empty / null input', () => {
    expect(isAIStubVenueName('')).toBe(false);
    expect(isAIStubVenueName(null)).toBe(false);
    expect(isAIStubVenueName(undefined)).toBe(false);
  });
});

describe('inferMealTypeFromTime', () => {
  it('maps hours to meal types', () => {
    expect(inferMealTypeFromTime('09:00')).toBe('breakfast');
    expect(inferMealTypeFromTime('13:00')).toBe('lunch');
    expect(inferMealTypeFromTime('19:30')).toBe('dinner');
  });
});

describe('sanitizeActivityName + stub mask', () => {
  it('masks stub dining title with meal-aware fallback', () => {
    expect(sanitizeActivityName('Table du Quartier', { category: 'dining', startTime: '13:00' }))
      .toBe('Lunch — find a local spot');
    expect(sanitizeActivityName('Lunch at Table du Quartier', { category: 'dining' }))
      .toBe('Lunch — find a local spot');
    expect(sanitizeActivityName('Café Matinal', { category: 'restaurant', startTime: '08:30' }))
      .toBe('Breakfast — find a local spot');
  });

  it('does NOT mask real restaurant names', () => {
    expect(sanitizeActivityName('Le Comptoir du Relais', { category: 'dining', startTime: '13:00' }))
      .toBe('Le Comptoir du Relais');
  });

  it('does NOT mask non-dining categories even if name matches', () => {
    expect(sanitizeActivityName('Table du Quartier', { category: 'cultural' }))
      .toBe('Table du Quartier');
  });

  it('default fallback when no meal info available', () => {
    expect(stubFallbackLabel(null)).toBe('Meal — find a local spot');
  });
});
