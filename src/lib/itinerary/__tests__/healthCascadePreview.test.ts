/**
 * Casablanca Day 1 reproducer for the stale-overlap health-panel false
 * positive: Wander Place Mohammed V (18:44, durationMinutes 105, no endTime)
 * + Dinner: Le Jasmine (19:00–20:15). The cascade preview must shift Le
 * Jasmine past Wander's end so the overlap warning never surfaces.
 *
 * Locks the three invariants from
 * mem://constraints/itinerary/health-cascade-preview round 2:
 *   1. Missing endTime is synthesized from start + durationMinutes.
 *   2. Canonical lock detection (manuallyAdded/extracted/pinned) keeps
 *      user-pinned rows in place.
 *   3. Records carrying `name` (no `title`) still classify correctly.
 */
import { describe, it, expect } from 'vitest';
import { buildCascadePreview } from '../healthCascadePreview';

describe('buildCascadePreview — Casablanca Day 1 stale-overlap', () => {
  it('shifts Le Jasmine past Wander even when Wander has no endTime', () => {
    const activities = [
      {
        id: 'wander-1',
        name: 'Wander Place Mohammed V',
        category: 'exploration',
        startTime: '18:44',
        // endTime intentionally missing — only durationMinutes
        durationMinutes: 105,
      },
      {
        id: 'le-jasmine',
        name: 'Dinner: Le Jasmine',
        category: 'dining',
        startTime: '19:00',
        endTime: '20:15',
      },
    ];

    const preview = buildCascadePreview(activities);
    const shifted = preview.get('le-jasmine');
    expect(shifted).toBeDefined();
    // Wander effective end = 18:44 + 105 = 20:29. Push Le Jasmine to ≥ 20:34
    // (currEffEnd + 5min overlap buffer for non-transit pair).
    const [h, m] = (shifted!.startTime || '').split(':').map(Number);
    const mins = h * 60 + m;
    expect(mins).toBeGreaterThanOrEqual(20 * 60 + 34);
  });

  it('keeps a manuallyAdded dinner pinned (no false move)', () => {
    const activities = [
      {
        id: 'wander-1',
        name: 'Wander Place Mohammed V',
        category: 'exploration',
        startTime: '18:44',
        durationMinutes: 105,
      },
      {
        id: 'le-jasmine',
        name: 'Dinner: Le Jasmine',
        category: 'dining',
        startTime: '19:00',
        endTime: '20:15',
        manuallyAdded: true,
      },
    ];

    const preview = buildCascadePreview(activities);
    const pinned = preview.get('le-jasmine');
    // Pinned rows survive the cascade unchanged.
    expect(pinned?.startTime).toBe('19:00');
  });

  it('synthesizes endTime when present only as duration (no false bail)', () => {
    const activities = [
      {
        id: 'a',
        name: 'A',
        category: 'sightseeing',
        startTime: '10:00',
        durationMinutes: 60,
      },
      {
        id: 'b',
        name: 'B',
        category: 'sightseeing',
        startTime: '10:30',
        endTime: '11:30',
      },
    ];
    const preview = buildCascadePreview(activities);
    const b = preview.get('b');
    // A effective end = 11:00; B must be pushed to ≥ 11:05.
    const [h, m] = (b!.startTime || '').split(':').map(Number);
    expect(h * 60 + m).toBeGreaterThanOrEqual(11 * 60 + 5);
  });
});
