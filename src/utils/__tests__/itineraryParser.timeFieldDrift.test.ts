/**
 * Time-field canonicalization at parser boundary.
 * mem://constraints/itinerary/time-field-canonicalization
 */
import { describe, it, expect, vi } from 'vitest';
import { parseItineraryDays } from '../itineraryParser';

describe('parser time-field canonicalization', () => {
  it('mirrors stale legacy `time` to canonical `startTime` value', () => {
    const raw = {
      days: [
        {
          dayNumber: 1,
          activities: [
            {
              id: 'a1',
              title: 'Museum',
              startTime: '13:45',
              endTime: '15:00',
              time: '12:31', // stale legacy field
              category: 'sightseeing',
            },
          ],
        },
      ],
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const days = parseItineraryDays(raw);
    const a = days[0].activities[0] as { startTime: string; time: string };
    expect(a.startTime).toBe('13:45');
    // legacy time mirrors startTime — never re-surfaces 12:31
    expect(a.time).toBe('13:45');
    expect(warn).toHaveBeenCalledWith(
      '[TIME_FIELD_DRIFT]',
      expect.objectContaining({ startTime: '13:45', time: '12:31' })
    );
    warn.mockRestore();
  });

  it('preserves matching startTime/time without warning', () => {
    const raw = {
      days: [
        {
          dayNumber: 1,
          activities: [
            { id: 'b1', title: 'Lunch', startTime: '12:30', endTime: '13:30', time: '12:30' },
          ],
        },
      ],
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const days = parseItineraryDays(raw);
    const a = days[0].activities[0] as { startTime: string; time: string };
    expect(a.startTime).toBe('12:30');
    expect(a.time).toBe('12:30');
    expect(warn).not.toHaveBeenCalledWith('[TIME_FIELD_DRIFT]', expect.anything());
    warn.mockRestore();
  });

  it('uses legacy `time` only when startTime is absent', () => {
    const raw = {
      days: [
        {
          dayNumber: 1,
          activities: [{ id: 'c1', title: 'Untimed', time: '09:00' }],
        },
      ],
    };
    const days = parseItineraryDays(raw);
    const a = days[0].activities[0] as { startTime: string; time: string };
    expect(a.startTime).toBe('09:00');
    expect(a.time).toBe('09:00');
  });
});
