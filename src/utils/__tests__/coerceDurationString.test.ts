import { describe, it, expect } from 'vitest';
import { coerceDurationString } from '../plannerUtils';

describe('coerceDurationString', () => {
  it('prefers durationMinutes when valid', () => {
    expect(coerceDurationString('15:00:00', 45)).toBe('45m');
    expect(coerceDurationString('garbage', 90)).toBe('1h 30m');
  });

  it('parses HH:MM:SS — implausible-as-hours leading numbers become minutes', () => {
    // AI emits "45:00:00" meaning "45 min" — must NOT become 45h.
    expect(coerceDurationString('45:00:00')).toBe('45m');
    expect(coerceDurationString('30:00:00')).toBe('30m');
    expect(coerceDurationString('15:00:00')).toBe('15m');
    expect(coerceDurationString('10:00:00')).toBe('10m');
    // Realistic clock-style durations stay intact.
    expect(coerceDurationString('1:05:00')).toBe('1h 5m');
    expect(coerceDurationString('2:20:00')).toBe('2h 20m');
    expect(coerceDurationString('3:00:00')).toBe('3h');
  });

  it('parses MM:SS heuristically (>=24 first part = minutes)', () => {
    expect(coerceDurationString('45:00')).toBe('45m');
    expect(coerceDurationString('90:00')).toBe('1h 30m');
  });

  it('parses HH:MM normally when first part < 5 and no seconds', () => {
    expect(coerceDurationString('1:30')).toBe('1h 30m');
    expect(coerceDurationString('2:15')).toBe('2h 15m');
  });

  it('passes through human strings', () => {
    expect(coerceDurationString('90 min')).toBe('1h 30m');
    expect(coerceDurationString('2h 15m')).toBe('2h 15m');
    expect(coerceDurationString('45m')).toBe('45m');
  });

  it('handles bare integer as minutes', () => {
    expect(coerceDurationString('120')).toBe('2h');
    expect(coerceDurationString(60)).toBe('1h');
  });

  it('returns empty for unparseable junk', () => {
    expect(coerceDurationString('hello')).toBe('');
    expect(coerceDurationString(null)).toBe('');
    expect(coerceDurationString(undefined)).toBe('');
  });

  it('keeps descriptive ranges as-is', () => {
    expect(coerceDurationString('2-3 hours')).toBe('2-3 hours');
    expect(coerceDurationString('30-45 min')).toBe('30-45 min');
  });
});
