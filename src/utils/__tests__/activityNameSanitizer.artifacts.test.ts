import { describe, it, expect } from 'vitest';
import { sanitizeActivityName, sanitizeActivityText } from '../activityNameSanitizer';

describe('sanitizeActivityName / sanitizeActivityText – prompt-artifact stripping', () => {
  it('strips bare ALLCAPS-with-underscore tokens like (INTEREST_SLOT)', () => {
    // Note: the test subject must NOT itself be a generic-wellness title, or
    // the wellness-integrity mask ("Spa Time — find a venue") fires AFTER the
    // token is stripped. This case isolates the (INTEREST_SLOT) token strip.
    expect(sanitizeActivityName('Anniversary Dinner Cruise (INTEREST_SLOT)'))
      .toBe('Anniversary Dinner Cruise');
    expect(sanitizeActivityName('Open Afternoon - Wander Castello (FLEX_WINDOW)'))
      .toBe('Open Afternoon - Wander Castello');
    expect(sanitizeActivityName('Stroll San Marco (NARRATIVE_MOOD)'))
      .toBe('Stroll San Marco');
  });

  it('strips labelled slot/placeholder tokens', () => {
    expect(sanitizeActivityName('Dinner (AESTHETIC slot)')).toBe('Dinner');
    expect(sanitizeActivityName('Cicchetti tour (slot)')).toBe('Cicchetti tour');
    expect(sanitizeActivityName('Activity (placeholder)')).toBe('Activity');
  });

  it('does NOT strip legit acronyms in parens like (NYC) / (USA)', () => {
    expect(sanitizeActivityName('Visit MoMA (NYC)')).toContain('(NYC)');
    expect(sanitizeActivityName('Photo stop (USA)')).toContain('(USA)');
  });

  it('sanitizeActivityText also strips artifacts in descriptions', () => {
    expect(sanitizeActivityText('A relaxed evening (AESTHETIC slot) with locals'))
      .toBe('A relaxed evening with locals');
    expect(sanitizeActivityText('Open afternoon (FLEX_WINDOW) for wandering'))
      .toBe('Open afternoon for wandering');
  });

  it('strips orphan "Reservation Urgency: ." prompt-template label leak', () => {
    expect(sanitizeActivityText('Soothing massage. Reservation Urgency: .'))
      .toBe('Soothing massage.');
  });

  it('strips value-bearing "Reservation Urgency: book_soon." segment', () => {
    expect(sanitizeActivityText('Reservation Urgency: book_soon. Spa with hammam.'))
      .toBe('Spa with hammam.');
  });

  it('preserves legit "Reservation: required for Sunday brunch." (singular Reservation:)', () => {
    expect(sanitizeActivityText('Reservation: required for Sunday brunch.'))
      .toBe('Reservation: required for Sunday brunch.');
  });
});
