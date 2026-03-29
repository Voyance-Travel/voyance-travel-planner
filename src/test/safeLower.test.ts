import { describe, it, expect } from 'vitest';
import { safeLower } from '@/utils/safeLower';

describe('safeLower', () => {
  it('converts strings to lowercase', () => {
    expect(safeLower('Hello')).toBe('hello');
    expect(safeLower('ACTIVITY')).toBe('activity');
  });

  it('returns empty string for null/undefined', () => {
    expect(safeLower(null)).toBe('');
    expect(safeLower(undefined)).toBe('');
  });

  it('handles non-string values', () => {
    expect(safeLower(42)).toBe('42');
    expect(safeLower(true)).toBe('true');
    expect(safeLower({})).toBe('[object object]');
  });

  it('handles empty string', () => {
    expect(safeLower('')).toBe('');
  });
});
