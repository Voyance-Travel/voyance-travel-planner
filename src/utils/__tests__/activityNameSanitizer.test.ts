import { describe, it, expect } from 'vitest';
import { sanitizeActivityText } from '../activityNameSanitizer';

describe('sanitizeActivityText - orphan article repair', () => {
  it('repairs "the of <Proper>" by inserting "City"', () => {
    expect(sanitizeActivityText('Explore the of Paris Museum')).toBe(
      'Explore the City of Paris Museum',
    );
  });

  it('repairs mid-sentence variants', () => {
    expect(sanitizeActivityText('Visit the of Lisbon palace')).toBe(
      'Visit the City of Lisbon palace',
    );
  });

  it('does not fire when next word is lowercase', () => {
    // Regex requires a capital letter following "of "
    expect(sanitizeActivityText('Walk the of dogs')).toBe('Walk the of dogs');
  });
});
