import { describe, it, expect } from 'vitest';
import { sanitizeActivityText, sanitizeActivityName } from '../activityNameSanitizer';

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

  it('repairs orphan possessive "the\'s" → "the city\'s"', () => {
    expect(
      sanitizeActivityText("A sensory retreat at the's historic mosque"),
    ).toBe("A sensory retreat at the city's historic mosque");
  });

  it('repairs orphan possessive with stray space "the\' s"', () => {
    expect(sanitizeActivityText("Walk the' s old quarter")).toBe(
      "Walk the city's old quarter",
    );
  });

  it('repairs comma-prefixed ", the of <Proper>"', () => {
    expect(sanitizeActivityText('Settle in, the of Lisbon awaits')).toBe(
      'Settle in, the City of Lisbon awaits',
    );
  });
});

describe('sanitizeActivityName - orphan article repair', () => {
  it('repairs "the of <Proper>" in titles', () => {
    expect(sanitizeActivityName('Explore the of Paris Museum')).toBe(
      'Explore the City of Paris Museum',
    );
  });

  it('does not fire when next word is lowercase', () => {
    expect(sanitizeActivityName('Walk the of dogs')).toBe('Walk the of dogs');
  });
});

describe('sanitizeActivityText - curly apostrophe repair', () => {
  it('repairs curly "the’s" → "the city\'s"', () => {
    expect(
      sanitizeActivityText('A sensory retreat at the\u2019s historic mosque'),
    ).toBe("A sensory retreat at the city's historic mosque");
  });

  it('repairs curly "the’ s" with space', () => {
    expect(sanitizeActivityText('Walk the\u2019 s old quarter')).toBe(
      "Walk the city's old quarter",
    );
  });
});
