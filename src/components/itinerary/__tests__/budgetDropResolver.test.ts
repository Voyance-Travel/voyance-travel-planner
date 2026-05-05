import { describe, it, expect } from 'vitest';
import { resolveDropTarget, titlesLooselyMatch } from '../budgetDropResolver';

const days = [
  {
    dayNumber: 1,
    activities: [
      { id: 'a1', title: 'Wellness Afternoon at the Hammam' },
      { id: 'a2', title: 'Lunch at Le Comptoir' },
    ],
  },
  {
    dayNumber: 2,
    activities: [{ id: 'a3', title: 'Louvre Museum Visit' }],
  },
];

describe('resolveDropTarget', () => {
  it('resolves happy path with matching title', () => {
    const r = resolveDropTarget(days, {
      activity_id: 'a1',
      current_item: 'Wellness Afternoon at the Hammam',
      day_number: 1,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.dayIdx).toBe(0);
  });

  it('resolves even when suggestion.day_number is wrong', () => {
    const r = resolveDropTarget(days, {
      activity_id: 'a3',
      current_item: 'Louvre Museum Visit',
      day_number: 99, // stale/wrong
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.dayIdx).toBe(1);
  });

  it('returns not-found when id is missing from all days', () => {
    const r = resolveDropTarget(days, {
      activity_id: 'ghost-id',
      current_item: 'Anything',
    });
    expect(r).toEqual({ ok: false, error: 'not-found' });
  });

  it('returns title-mismatch when live title is unrelated', () => {
    const r = resolveDropTarget(days, {
      activity_id: 'a1',
      current_item: 'Eiffel Tower Skip the Line',
    });
    expect(r).toEqual({ ok: false, error: 'title-mismatch' });
  });

  it('accepts loose match: punctuation/case differences', () => {
    const r = resolveDropTarget(days, {
      activity_id: 'a2',
      current_item: 'LUNCH @ le comptoir!',
    });
    expect(r.ok).toBe(true);
  });

  it('accepts match on a single shared 4+ char token', () => {
    const r = resolveDropTarget(days, {
      activity_id: 'a3',
      current_item: 'Quick Louvre stop',
    });
    expect(r.ok).toBe(true);
  });

  it('does not block when current_item is missing', () => {
    const r = resolveDropTarget(days, {
      activity_id: 'a1',
      current_item: '',
    });
    expect(r.ok).toBe(true);
  });

  it('returns not-found for empty activity_id', () => {
    const r = resolveDropTarget(days, {
      activity_id: '',
      current_item: 'whatever',
    });
    expect(r).toEqual({ ok: false, error: 'not-found' });
  });
});

describe('titlesLooselyMatch', () => {
  it('treats empty inputs as match (cannot verify)', () => {
    expect(titlesLooselyMatch('', 'Anything')).toBe(true);
    expect(titlesLooselyMatch('Anything', '')).toBe(true);
  });

  it('rejects clearly unrelated titles', () => {
    expect(titlesLooselyMatch('Wine Tasting', 'Bike Ride')).toBe(false);
  });
});
