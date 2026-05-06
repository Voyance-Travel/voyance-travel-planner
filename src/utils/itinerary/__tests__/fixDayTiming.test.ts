import { describe, it, expect } from 'vitest';
import { fixDayTiming } from '../fixDayTiming';

describe('fixDayTiming', () => {
  it('resolves a simple two-activity overlap', () => {
    const r = fixDayTiming([
      { id: 'a', startTime: '10:00', endTime: '12:00', durationMinutes: 120, category: 'museum' },
      { id: 'b', startTime: '11:30', endTime: '13:00', durationMinutes: 90, category: 'dining' },
    ]);
    expect(r.success).toBe(true);
    expect(r.resolvedCount).toBe(1);
    expect(r.activities[1].startTime).toBe('12:05');
    expect(r.activities[1].endTime).toBe('13:35');
  });

  it('cascades through three overlapping activities', () => {
    const r = fixDayTiming([
      { id: 'a', startTime: '09:00', endTime: '11:00', durationMinutes: 120 },
      { id: 'b', startTime: '10:30', endTime: '12:00', durationMinutes: 90 },
      { id: 'c', startTime: '11:30', endTime: '13:00', durationMinutes: 90 },
    ]);
    expect(r.success).toBe(true);
    expect(r.resolvedCount).toBe(2);
    expect(r.activities[1].startTime).toBe('11:05');
    expect(r.activities[2].startTime).toBe('12:40'); // 11:05+90=12:35, +5 buffer
  });

  it('uses zero buffer when an activity is transit', () => {
    const r = fixDayTiming([
      { id: 'a', startTime: '10:00', endTime: '10:30', durationMinutes: 30, category: 'transit' },
      { id: 'b', startTime: '10:15', endTime: '11:00', durationMinutes: 45, category: 'museum' },
    ]);
    expect(r.success).toBe(true);
    expect(r.activities[1].startTime).toBe('10:30');
  });

  it('skips a locked next activity', () => {
    const r = fixDayTiming([
      { id: 'a', startTime: '10:00', endTime: '12:00', durationMinutes: 120 },
      { id: 'b', startTime: '11:30', endTime: '13:00', durationMinutes: 90, locked: true },
    ]);
    expect(r.success).toBe(false);
    expect(r.resolvedCount).toBe(0);
  });

  it('returns day_overflow when pushing past 23:30', () => {
    const r = fixDayTiming([
      { id: 'a', startTime: '20:00', endTime: '23:00', durationMinutes: 180 },
      { id: 'b', startTime: '22:00', endTime: '23:30', durationMinutes: 90 },
    ]);
    expect(r.success).toBe(false);
    expect(r.reason).toBe('day_overflow');
  });

  it('returns no_changes when nothing overlaps', () => {
    const r = fixDayTiming([
      { id: 'a', startTime: '09:00', endTime: '10:00', durationMinutes: 60 },
      { id: 'b', startTime: '11:00', endTime: '12:00', durationMinutes: 60 },
    ]);
    expect(r.success).toBe(false);
    expect(r.reason).toBe('no_changes');
  });
});
