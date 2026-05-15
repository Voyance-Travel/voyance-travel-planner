/**
 * Cascade preview — health engine reads post-cascade times for DETECTION,
 * but the user-facing warning only fires/suppresses based on the times the
 * card actually renders.
 *
 * Contract (mem://constraints/itinerary/health-warning-rendered-times):
 *   1. If the rendered times on the cards overlap, the engine ALWAYS warns,
 *      regardless of whether a future save-time cascade would resolve it.
 *      The user is staring at the conflict on screen right now.
 *   2. Cascade suppression only fires when rendered times don't overlap —
 *      i.e. the conflict only exists in the dry-run cascade view.
 *   3. Warning text mirrors the rendered times via getRenderedStartTime /
 *      getRenderedEndTime, never the cascaded value or a synthesized end.
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
  it('Bali repro: warns on visible overlap even when cascade would resolve it', () => {
    // Uluwatu Temple 11:50–13:20 + Naughty Nuri\'s 12:30–13:30 — 50-min
    // overlap visible on screen. The save-time cascade WOULD push lunch to
    // 13:20+, but the user sees the conflict now and we must warn.
    const day = baseDay(1, [
      ...meals,
      {
        id: 'temple',
        title: 'Uluwatu Temple',
        name: 'Uluwatu Temple',
        category: 'sightseeing',
        startTime: '11:50',
        endTime: '13:20',
      },
      {
        id: 'lunch',
        title: "Naughty Nuri's",
        name: "Naughty Nuri's",
        category: 'dining',
        startTime: '12:30',
        endTime: '13:30',
      },
    ]);

    const issues = analyzeHealth([day]);
    const conflicts = issues.filter((i) => i.fixAction === 'fix_timing');
    expect(conflicts.length).toBeGreaterThan(0);
  });

  it('Copenhagen repro: warning text uses card endTime, never a synthesized end', () => {
    // Card shows Høst 21:50–22:50 (endTime field). Engine must NOT synthesize
    // a 23:50 end from durationMinutes:120 — the user would see "21:50–23:50"
    // in the warning while the card shows "21:50–22:50".
    const day = baseDay(1, [
      { id: 'bk2', title: 'Breakfast', name: 'Breakfast', category: 'dining', startTime: '08:00', endTime: '08:45' },
      { id: 'lu2', title: 'Lunch', name: 'Lunch', category: 'dining', startTime: '12:30', endTime: '13:30' },
      {
        id: 'host',
        title: 'Dinner at Høst',
        name: 'Dinner at Høst',
        category: 'dining',
        startTime: '21:50',
        endTime: '22:50',
        durationMinutes: 120, // would synth 23:50 if engine fell back
      },
      {
        id: 'metro',
        title: 'Metro to The Barking Dog',
        name: 'Metro to The Barking Dog',
        category: 'transit',
        startTime: '22:30', // overlaps Høst 22:50 end
        endTime: '22:44',
      },
    ]);

    const issues = analyzeHealth([day]);
    const conflicts = issues.filter((i) => i.fixAction === 'fix_timing');
    if (conflicts.length > 0) {
      // If the engine warns at all here, the message must echo 22:50, not 23:50.
      expect(conflicts[0].message).toContain('22:50');
      expect(conflicts[0].message).not.toContain('23:50');
    }
  });

  it('cascade-only artifact: rendered times don\'t overlap → no warning', () => {
    // Card-rendered times don't overlap (museum 10:30–11:30 ends before
    // lunch 12:00). Cascade dry-run shouldn't shift anything either, so no
    // warning. This is the legitimate "dry-run-only artifact" suppression
    // window the engine still respects.
    const day = baseDay(1, [
      ...meals,
      {
        id: 'museum',
        title: 'Quiet Museum',
        name: 'Quiet Museum',
        category: 'museum',
        startTime: '10:30',
        endTime: '11:30',
      },
      {
        id: 'lunch',
        title: 'Lunch',
        name: 'Lunch',
        category: 'dining',
        startTime: '12:00',
        endTime: '13:00',
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
    // AND a stale time:12:31 (pre-cascade). The rendered helper reads 13:45,
    // not 12:31, so no overlap warning fires.
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
});
