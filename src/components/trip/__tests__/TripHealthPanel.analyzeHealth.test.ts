import { describe, it, expect } from 'vitest';
import { analyzeHealth } from '../TripHealthPanel';

const day = (n: number, activities: any[]) => ({ dayNumber: n, activities });

describe('analyzeHealth — overlap classification', () => {
  it('Villa Medici + Walk to Hotel Flora → warning, "Tight transition"', () => {
    const days = [day(3, [
      { name: 'Quiet Moment at Villa Medici Gardens', category: 'leisure', startTime: '10:05', endTime: '10:55' },
      { name: 'Walk to Hotel Flora', category: 'transfer', startTime: '10:45', endTime: '11:00' },
    ])];
    const issues = analyzeHealth(days).filter(i => i.fixAction === 'fix_timing');
    expect(issues.length).toBe(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].message).toMatch(/Tight transition/);
    expect(issues[0].message).toMatch(/Auto-resolves/);
  });

  it('two non-transit overlapping cards → still error', () => {
    const days = [day(1, [
      { name: 'Museum A', category: 'culture', startTime: '10:00', endTime: '12:00' },
      { name: 'Lunch B', category: 'dining', startTime: '11:30', endTime: '13:00' },
    ])];
    const issues = analyzeHealth(days).filter(i => i.fixAction === 'fix_timing');
    expect(issues.length).toBe(1);
    expect(issues[0].severity).toBe('error');
  });

  it('walk-titled card with no category → classified as transit by title prefix', () => {
    const days = [day(2, [
      { name: 'Gallery Visit', category: 'culture', startTime: '14:00', endTime: '15:30' },
      { name: 'Walk to next stop', startTime: '15:20', endTime: '15:35' },
    ])];
    const issues = analyzeHealth(days).filter(i => i.fixAction === 'fix_timing');
    expect(issues.length).toBe(1);
    expect(issues[0].severity).toBe('warning');
  });
});
