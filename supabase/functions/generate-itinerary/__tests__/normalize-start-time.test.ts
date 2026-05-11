import { describe, it, expect } from 'vitest';
import { fillMissingStartTimes } from '../../_shared/timing-cascade.ts';

describe('fillMissingStartTimes', () => {
  it('computes startTime = endTime - durationMinutes when start is missing', () => {
    const acts: any[] = [
      { id: 'a', title: 'Bistro Refter', endTime: '13:30', durationMinutes: 60 },
    ];
    const res = fillMissingStartTimes(acts, { dayNumber: 3, path: 'test' });
    expect(res.filled).toBe(1);
    expect(acts[0].startTime).toBe('12:30');
    expect(acts[0].start_time).toBe('12:30');
    expect(acts[0].time).toBe('12:30');
  });

  it('does not overwrite an existing startTime', () => {
    const acts: any[] = [
      { id: 'a', startTime: '09:00', endTime: '13:30', durationMinutes: 60 },
    ];
    const res = fillMissingStartTimes(acts);
    expect(res.filled).toBe(0);
    expect(acts[0].startTime).toBe('09:00');
  });

  it('exempts locked / user-anchored rows', () => {
    const acts: any[] = [
      { id: 'a', endTime: '13:30', durationMinutes: 60, isLocked: true },
      { id: 'b', endTime: '14:30', durationMinutes: 60, userAdded: true },
    ];
    const res = fillMissingStartTimes(acts);
    expect(res.filled).toBe(0);
    expect(acts[0].startTime).toBeUndefined();
    expect(acts[1].startTime).toBeUndefined();
  });

  it('skips when duration is missing or zero', () => {
    const acts: any[] = [
      { id: 'a', endTime: '13:30' },
      { id: 'b', endTime: '13:30', durationMinutes: 0 },
    ];
    const res = fillMissingStartTimes(acts);
    expect(res.filled).toBe(0);
    expect(res.skipped).toBe(2);
    expect(acts[0].startTime).toBeUndefined();
  });

  it('clamps to 00:00 when duration exceeds endTime', () => {
    const acts: any[] = [
      { id: 'a', endTime: '00:30', durationMinutes: 60 },
    ];
    const res = fillMissingStartTimes(acts);
    expect(res.filled).toBe(1);
    expect(acts[0].startTime).toBe('00:00');
  });

  it('reads duration from snake_case fallback', () => {
    const acts: any[] = [
      { id: 'a', end_time: '15:00', duration_minutes: 90 },
    ];
    const res = fillMissingStartTimes(acts);
    expect(res.filled).toBe(1);
    expect(acts[0].startTime).toBe('13:30');
  });
});
