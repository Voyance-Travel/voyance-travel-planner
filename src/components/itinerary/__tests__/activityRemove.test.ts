import { describe, it, expect } from 'vitest';
import { resolveLiveActivity } from '../activityRemoveResolver';

describe('resolveLiveActivity', () => {
  const days = [
    { dayNumber: 1, activities: [{ id: 'a1', title: 'Louvre' }] },
    { dayNumber: 2, activities: [{ id: 'a2', title: 'Le Jules Verne' }] },
    { dayNumber: 3, activities: [{ id: 'a3', name: 'Versailles' }] },
  ];

  it('finds an id present on day 2', () => {
    const r = resolveLiveActivity(days, 'a2');
    expect(r).toEqual({ found: true, dayIdx: 1, title: 'Le Jules Verne' });
  });

  it('returns not-found for a stale id (post-regen)', () => {
    expect(resolveLiveActivity(days, 'stale-uuid')).toEqual({ found: false });
  });

  it('returns not-found for empty days', () => {
    expect(resolveLiveActivity([], 'a1')).toEqual({ found: false });
  });

  it('resolves an id only present in the last day', () => {
    const r = resolveLiveActivity(days, 'a3');
    expect(r).toEqual({ found: true, dayIdx: 2, title: 'Versailles' });
  });

  it('returns not-found for empty/null activityId', () => {
    expect(resolveLiveActivity(days, '')).toEqual({ found: false });
  });
});
