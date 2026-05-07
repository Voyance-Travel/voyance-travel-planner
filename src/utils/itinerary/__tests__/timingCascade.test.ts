import { describe, it, expect } from 'vitest';
import { enforceTimingAndBuffers, parseTime } from '../timingCascade';

describe('enforceTimingAndBuffers (client mirror)', () => {
  it('Day 1: pulls "Transfer to Marriott 09:00" past Breakfast ending 09:15', () => {
    const acts = [
      { id: 'b', title: 'Breakfast at Antico Forno Roscioli', category: 'dining', startTime: '08:30', endTime: '09:15' },
      { id: 't', title: 'Transfer to Marriott', category: 'transport', startTime: '09:00', endTime: '09:45' },
    ];
    const { activities, repairs } = enforceTimingAndBuffers(acts);
    expect(repairs.length).toBeGreaterThan(0);
    expect(parseTime(activities[1].startTime)!).toBeGreaterThanOrEqual(9 * 60 + 15);
  });

  it('Day 2: pulls "Walk to Lunch 12:20" past Vatican ending 12:30', () => {
    const acts = [
      { id: 'v', title: 'Vatican Museums & Sistine Chapel', category: 'culture', startTime: '09:30', endTime: '12:30' },
      { id: 'w', title: "Walk to Lunch via Ponte Sant'Angelo", category: 'transit', startTime: '12:20', endTime: '12:40' },
    ];
    const { activities, repairs } = enforceTimingAndBuffers(acts);
    expect(repairs.length).toBeGreaterThan(0);
    expect(parseTime(activities[1].startTime)!).toBeGreaterThanOrEqual(12 * 60 + 30);
  });

  it('Day 3: pulls "Walk to Hotel Flora 10:45" past Villa Medici ending 10:55', () => {
    const acts = [
      { id: 'vm', title: 'Quiet Moment at Villa Medici Gardens', category: 'leisure', startTime: '10:05', endTime: '10:55' },
      { id: 'wh', title: 'Walk to Hotel Flora', category: 'transfer', startTime: '10:45', endTime: '11:00' },
    ];
    const { activities, repairs } = enforceTimingAndBuffers(acts);
    expect(repairs.length).toBeGreaterThan(0);
    expect(parseTime(activities[1].startTime)!).toBeGreaterThanOrEqual(10 * 60 + 55);
  });

  it('clean day produces no repairs', () => {
    const acts = [
      { id: 'a', title: 'A', startTime: '09:00', endTime: '10:00' },
      { id: 'b', title: 'B', startTime: '10:30', endTime: '11:30' },
    ];
    const { repairs } = enforceTimingAndBuffers(acts);
    expect(repairs.length).toBe(0);
  });
});
