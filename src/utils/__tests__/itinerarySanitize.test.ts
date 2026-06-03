import { describe, it, expect } from 'vitest';
import {
  safeLower,
  safeTrim,
  safeStr,
  sanitizeActivity,
  sanitizeEditorialDays,
} from '../itinerarySanitize';

describe('safeLower', () => {
  it('lowercases strings', () => {
    expect(safeLower('HELLO')).toBe('hello');
  });
  it('never throws on undefined/null — the Small Detour crash root cause', () => {
    expect(safeLower(undefined)).toBe('');
    expect(safeLower(null)).toBe('');
  });
  it('coerces non-strings', () => {
    expect(safeLower(42)).toBe('42');
  });
});

describe('safeTrim / safeStr', () => {
  it('safeTrim handles undefined', () => {
    expect(safeTrim(undefined)).toBe('');
    expect(safeTrim('  x  ')).toBe('x');
  });
  it('safeStr falls back', () => {
    expect(safeStr(undefined, 'fallback')).toBe('fallback');
    expect(safeStr('keep')).toBe('keep');
  });
});

describe('sanitizeActivity', () => {
  it('guarantees string fields the renderer calls .toLowerCase() on', () => {
    const a = sanitizeActivity({ id: '1' } as Record<string, unknown>);
    expect(typeof a.category).toBe('string');
    expect(typeof a.title).toBe('string');
    expect(typeof a.startTime).toBe('string');
    // Critically: calling string methods on the result never throws.
    expect(() => (a.category as string).toLowerCase()).not.toThrow();
    expect(() => (a.title as string).toLowerCase()).not.toThrow();
  });

  it('derives title from name/venue fallbacks', () => {
    expect(sanitizeActivity({ name: 'Louvre' } as Record<string, unknown>).title).toBe('Louvre');
    expect(sanitizeActivity({ venue: 'Cafe' } as Record<string, unknown>).title).toBe('Cafe');
    expect(sanitizeActivity({} as Record<string, unknown>).title).toBe('Untitled Activity');
  });

  it('coerces nested location/transportation strings without dropping other fields', () => {
    const a = sanitizeActivity({
      title: 'X',
      cost: { amount: 10, currency: 'USD' },
      location: { lat: 1, lng: 2 }, // name/address missing
      transportation: { distance: '2km' }, // method/duration missing
    } as Record<string, unknown>);
    expect((a.location as any).name).toBe('');
    expect((a.location as any).lat).toBe(1); // preserved
    expect((a.transportation as any).method).toBe('');
    expect((a.cost as any).amount).toBe(10); // preserved
  });

  it('handles a null/garbage activity without throwing', () => {
    expect(() => sanitizeActivity(null as unknown as Record<string, unknown>)).not.toThrow();
    expect(sanitizeActivity(null as unknown as Record<string, unknown>).title).toBe('Untitled Activity');
  });
});

type TestDay = { dayNumber?: number; activities: Array<Record<string, unknown>> };

describe('sanitizeEditorialDays', () => {
  it('returns [] for non-array input', () => {
    expect(sanitizeEditorialDays(undefined)).toEqual([]);
    expect(sanitizeEditorialDays(null)).toEqual([]);
    expect(sanitizeEditorialDays('nope')).toEqual([]);
  });

  it('guarantees activities is an array even when missing or wrong-typed', () => {
    const out = sanitizeEditorialDays<TestDay>([{ dayNumber: 1 }, { dayNumber: 2, activities: 'bad' }]);
    expect(Array.isArray(out[0].activities)).toBe(true);
    expect(Array.isArray(out[1].activities)).toBe(true);
  });

  it('drops null days and null activities, sanitizes the rest', () => {
    const out = sanitizeEditorialDays<TestDay>([
      null,
      { dayNumber: 1, activities: [null, { name: 'Tower' }, undefined] },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].activities).toHaveLength(1);
    expect((out[0].activities as any)[0].title).toBe('Tower');
  });

  it('a fully malformed partial-generation payload never throws on render-style access', () => {
    // Mirrors the partial/garbage data that triggers Small Detour.
    const garbage = [
      { dayNumber: 1, activities: [{ category: undefined, location: null }] },
      { activities: null },
    ];
    const out = sanitizeEditorialDays<TestDay>(garbage);
    expect(() => {
      for (const day of out) {
        for (const act of day.activities as any[]) {
          (act.category as string).toLowerCase();
          (act.title as string).toLowerCase();
        }
      }
    }).not.toThrow();
  });
});
