import { describe, it, expect } from 'vitest';
import { itineraryFingerprint } from '../itineraryFingerprint';

const day = (n: number, acts: any[]) => ({ dayNumber: n, activities: acts });
const act = (id: string, title = 'X') => ({ id, title });

describe('itineraryFingerprint', () => {
  it('returns identical fingerprints for byte-equal itineraries', () => {
    const a = { days: [day(1, [act('a'), act('b')]), day(2, [act('c')])] };
    const b = { days: [day(1, [act('a'), act('b')]), day(2, [act('c')])] };
    expect(itineraryFingerprint(a)).toBe(itineraryFingerprint(b));
  });

  it('changes when an activity is added', () => {
    const a = { days: [day(1, [act('a')])] };
    const b = { days: [day(1, [act('a'), act('b')])] };
    expect(itineraryFingerprint(a)).not.toBe(itineraryFingerprint(b));
  });

  it('changes when an activity is removed (Faro/Bruges meal-erosion repro)', () => {
    const a = { days: [day(1, [act('breakfast'), act('lunch'), act('dinner')])] };
    const b = { days: [day(1, [act('breakfast'), act('lunch')])] };
    expect(itineraryFingerprint(a)).not.toBe(itineraryFingerprint(b));
  });

  it('changes when activity text is edited', () => {
    const a = { days: [day(1, [act('a', 'Short')])] };
    const b = { days: [day(1, [act('a', 'A much longer rewritten title')])] };
    expect(itineraryFingerprint(a)).not.toBe(itineraryFingerprint(b));
  });

  it('changes when day order is swapped', () => {
    const a = { days: [day(1, [act('a')]), day(2, [act('b'), act('c')])] };
    const b = { days: [day(1, [act('b'), act('c')]), day(2, [act('a')])] };
    expect(itineraryFingerprint(a)).not.toBe(itineraryFingerprint(b));
  });

  it('handles null / undefined / empty inputs without throwing', () => {
    expect(itineraryFingerprint(null)).toBe('0:');
    expect(itineraryFingerprint(undefined)).toBe('0:');
    expect(itineraryFingerprint({})).toBe('0:');
    expect(itineraryFingerprint({ days: [] })).toBe('0:');
  });

  it('treats missing activities array as zero-count day', () => {
    const a = { days: [{ dayNumber: 1 }, { dayNumber: 2, activities: [] }] };
    // Each empty `[]` serializes to 2 chars → lenSum=4, both days have 0 activities.
    expect(itineraryFingerprint(a)).toBe('4:0,0');
  });
});
