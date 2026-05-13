/**
 * Cascade preview — health engine reads post-cascade times so collisions
 * the save-time scheduler will auto-resolve don't surface as warnings.
 *
 * Repros the Montreal Day 1/Day 2 false-positives:
 *   - Pointe-à-Callière 10:30–12:40 vs Schwartz's lunch starting at 12:30
 *     (cascade pushes lunch to 12:40 + buffer; rendered card matches)
 *   - Plateau Murals E-Bike Tour ending shortly before Joe Beef
 */
import { describe, it, expect } from 'vitest';
import { analyzeHealth } from '../TripHealthPanel';

const baseDay = (dayNumber: number, activities: any[]) => ({
  dayNumber,
  metadata: { quality: { dayMode: 'full_day', requiredMeals: ['breakfast', 'lunch', 'dinner'] } },
  activities: activities.map((a) => ({ dayNumber, ...a })),
});

const meals = [
  { id: 'bk', title: 'Breakfast', name: 'Breakfast', category: 'dining', startTime: '08:00', endTime: '08:45' },
  { id: 'dn', title: 'Dinner', name: 'Dinner', category: 'dining', startTime: '19:00', endTime: '20:30' },
];

describe('TripHealthPanel cascade preview', () => {
  it('suppresses Schwartz-style overlap that the cascade resolves', () => {
    const day = baseDay(1, [
      ...meals,
      {
        id: 'museum',
        title: 'Pointe-à-Callière',
        name: 'Pointe-à-Callière',
        category: 'museum',
        startTime: '10:30',
        endTime: '12:40',
      },
      {
        id: 'lunch',
        title: 'Lunch at Schwartz\'s',
        name: 'Lunch at Schwartz\'s',
        category: 'dining',
        startTime: '12:30', // collides with museum end 12:40
        endTime: '13:30',
      },
    ]);

    const issues = analyzeHealth([day]);
    const conflicts = issues.filter((i) => i.fixAction === 'fix_timing');
    expect(conflicts).toHaveLength(0);
  });

  it('suppresses bike-tour vs Joe Beef tight buffer', () => {
    const day = baseDay(2, [
      ...meals,
      {
        id: 'bike',
        title: 'Plateau Murals E-Bike Tour',
        name: 'Plateau Murals E-Bike Tour',
        category: 'activity',
        startTime: '10:00',
        endTime: '13:12',
      },
      {
        id: 'joebeef',
        title: 'Joe Beef',
        name: 'Joe Beef',
        category: 'dining',
        startTime: '13:00', // overlaps; cascade pushes
        endTime: '14:30',
      },
    ]);

    const issues = analyzeHealth([day]);
    const conflicts = issues.filter((i) => i.fixAction === 'fix_timing');
    expect(conflicts).toHaveLength(0);
  });

  it('still flags overlap between two locked cards (cascade cannot move them)', () => {
    const day = baseDay(1, [
      ...meals,
      {
        id: 'a',
        title: 'Locked Tour A',
        name: 'Locked Tour A',
        category: 'activity',
        startTime: '10:00',
        endTime: '12:00',
        locked: true,
      },
      {
        id: 'b',
        title: 'Locked Tour B',
        name: 'Locked Tour B',
        category: 'activity',
        startTime: '11:30',
        endTime: '13:00',
        locked: true,
      },
    ]);

    const issues = analyzeHealth([day]);
    const conflicts = issues.filter((i) => i.fixAction === 'fix_timing');
    expect(conflicts.length).toBeGreaterThan(0);
  });
});
