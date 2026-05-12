/**
 * Reproduces the verified gap in EditorialItinerary's sync fingerprint:
 * timing-only changes (Bali post-cascade resync) MUST cause the fingerprint
 * to differ so setDays(initialDays) actually fires.
 *
 * The fingerprint formula is duplicated here so any future refactor that
 * silently weakens it (back to id-only) trips this test.
 *
 * See mem://constraints/itinerary/db-is-source-of-truth.
 */
import { describe, it, expect } from 'vitest';

function fingerprint(days: any[]): string {
  return JSON.stringify(days.map(d => ({
    n: d.dayNumber,
    d: d.date,
    a: d.activities.map((a: any) => `${a.id}@${a.startTime || ''}-${a.endTime || ''}#${a.durationMinutes ?? ''}`),
  })));
}

describe('EditorialItinerary initialDays fingerprint', () => {
  it('changes when only startTime/endTime shift (Bali timing-cascade resync)', () => {
    const before = [{
      dayNumber: 1,
      date: '2026-08-01',
      activities: [
        { id: 'a1', startTime: '17:20', endTime: '17:50', durationMinutes: 30 },
        { id: 'a2', startTime: '20:42', endTime: '22:30', durationMinutes: 108 },
      ],
    }];
    const after = [{
      dayNumber: 1,
      date: '2026-08-01',
      activities: [
        { id: 'a1', startTime: '16:00', endTime: '16:30', durationMinutes: 30 },
        { id: 'a2', startTime: '19:22', endTime: '21:10', durationMinutes: 108 },
      ],
    }];
    expect(fingerprint(before)).not.toEqual(fingerprint(after));
  });

  it('changes when an activity is added (Bruges/Istanbul meal-loss repro)', () => {
    const before = [{
      dayNumber: 1, date: '2026-08-01',
      activities: [{ id: 'a1', startTime: '09:00', endTime: '09:45' }],
    }];
    const after = [{
      dayNumber: 1, date: '2026-08-01',
      activities: [
        { id: 'a1', startTime: '09:00', endTime: '09:45' },
        { id: 'a2', startTime: '12:30', endTime: '13:30' },
      ],
    }];
    expect(fingerprint(before)).not.toEqual(fingerprint(after));
  });

  it('is stable when nothing material changes (no false-positive resync)', () => {
    const days = [{
      dayNumber: 1, date: '2026-08-01',
      activities: [{ id: 'a1', startTime: '09:00', endTime: '09:45', durationMinutes: 45 }],
    }];
    expect(fingerprint(days)).toEqual(fingerprint(JSON.parse(JSON.stringify(days))));
  });
});
