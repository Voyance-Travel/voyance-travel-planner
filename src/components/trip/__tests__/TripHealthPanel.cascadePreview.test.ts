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

  it('Casablanca: stale legacy `time` does not surface as overlap when startTime is canonical', () => {
    // Lunch 12:30–13:30 + Museum carrying both startTime:13:45 (rendered)
    // AND a stale time:12:31 (pre-cascade). The displayTime/cascade pipeline
    // must read 13:45, not 12:31, so no overlap warning fires.
    // mem://constraints/itinerary/time-field-canonicalization
    const day = baseDay(2, [
      ...meals,
      {
        id: 'lunch',
        title: 'Lunch: La Brasserie',
        name: 'Lunch: La Brasserie',
        category: 'dining',
        startTime: '12:30',
        endTime: '13:30',
        time: '12:30',
      },
      {
        id: 'museum',
        title: 'Museum of Moroccan Judaism',
        name: 'Museum of Moroccan Judaism',
        category: 'sightseeing',
        startTime: '13:45',
        endTime: '15:00',
        time: '12:31', // stale legacy field — must not be read
      },
    ]);

    const issues = analyzeHealth([day]);
    const conflicts = issues.filter((i) => i.fixAction === 'fix_timing');
    expect(conflicts).toHaveLength(0);
  });

  it('Casablanca Day 3: museum→lunch overlap is suppressed by cascade preview', () => {
    // Reproduces Issue 4: Art Deco Heritage 11:09–12:39 + Lunch 12:30–13:30.
    // Save-time cascade pushes lunch to 12:54 (15-min museum→dining buffer).
    // Health engine must show 0 conflicts.
    const day = baseDay(3, [
      ...meals,
      {
        id: 'museum',
        title: 'Art Deco Heritage at Musée Abderrahman Slaoui',
        name: 'Art Deco Heritage at Musée Abderrahman Slaoui',
        category: 'sightseeing',
        startTime: '11:09',
        endTime: '12:39',
      },
      {
        id: 'lunch',
        title: 'Lunch: Iloli',
        name: 'Lunch: Iloli',
        category: 'dining',
        startTime: '12:30',
        endTime: '13:30',
      },
    ]);

    const issues = analyzeHealth([day]);
    const conflicts = issues.filter((i) => i.fixAction === 'fix_timing');
    expect(conflicts).toHaveLength(0);
  });

  it('id-less activities still benefit from cascade-preview suppression', () => {
    // Same museum→lunch overlap but lunch carries an empty id (simulates a
    // partially-hydrated row whose `id` was lost). The Round 3 idx-keyed
    // fallback in buildCascadePreview / displayTime must still suppress.
    const day = baseDay(3, [
      ...meals,
      {
        id: 'museum',
        title: 'Art Deco Heritage',
        name: 'Art Deco Heritage',
        category: 'sightseeing',
        startTime: '11:09',
        endTime: '12:39',
      },
      {
        id: '', // simulated id-less row
        title: 'Lunch: Iloli',
        name: 'Lunch: Iloli',
        category: 'dining',
        startTime: '12:30',
        endTime: '13:30',
      },
    ]);

    const issues = analyzeHealth([day]);
    const conflicts = issues.filter((i) => i.fixAction === 'fix_timing');
    expect(conflicts).toHaveLength(0);
  });

  it('duplicate ids still get post-cascade resolution via idx fallback', () => {
    // Two siblings with the same id — without the idx:N keying, one would
    // overwrite the other in the cascade-preview map. The deterministic
    // per-pair re-check in analyzeHealth provides the final safety net.
    const day = baseDay(3, [
      ...meals,
      {
        id: 'dupe',
        title: 'Art Deco Heritage',
        name: 'Art Deco Heritage',
        category: 'sightseeing',
        startTime: '11:09',
        endTime: '12:39',
      },
      {
        id: 'dupe',
        title: 'Lunch: Iloli',
        name: 'Lunch: Iloli',
        category: 'dining',
        startTime: '12:30',
        endTime: '13:30',
      },
    ]);

    const issues = analyzeHealth([day]);
    const conflicts = issues.filter((i) => i.fixAction === 'fix_timing');
    expect(conflicts).toHaveLength(0);
  });
});

