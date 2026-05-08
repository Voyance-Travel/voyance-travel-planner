import { describe, it, expect } from 'vitest';
import { sanitizeActivityName, sanitizeActivityText } from '../activityNameSanitizer';

describe('sanitizeActivityName / sanitizeActivityText – prompt-artifact stripping', () => {
  it('strips bare ALLCAPS-with-underscore tokens like (INTEREST_SLOT)', () => {
    expect(sanitizeActivityName('Anniversary Wellness Ritual (INTEREST_SLOT)'))
      .toBe('Anniversary Wellness Ritual');
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
});
