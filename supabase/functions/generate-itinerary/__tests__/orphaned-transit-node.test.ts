/**
 * ORPHANED_TRANSIT_NODE — structural transit ghost detection + repair.
 *
 * Covers:
 *   - Detection when "Travel to Tasca do Chico" has no scheduled match.
 *   - No false-positive when Tasca do Chico IS scheduled (incl. substring +
 *     diacritic-stripped match).
 *   - Generic targets (hotel/airport/station/lunch) exempt.
 *   - Bookend / late-nightlife / departure-kind transit exempt.
 *   - repair-day removes the orphan.
 *   - validation-gate drops survivors when repair is bypassed.
 */

import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { validateDay } from '../pipeline/validate-day.ts';
import { repairDay } from '../pipeline/repair-day.ts';
import { FAILURE_CODES } from '../pipeline/types.ts';
import { applyValidationGate } from '../pipeline/validation-gate.ts';

function transit(title: string, extra: Record<string, unknown> = {}) {
  return {
    id: `transit-${title}`,
    title,
    category: 'transport',
    startTime: '12:30',
    endTime: '12:45',
    transportation: { method: 'walk', durationMinutes: 15 },
    ...extra,
  };
}

function activity(title: string, extra: Record<string, unknown> = {}) {
  return {
    id: `act-${title}`,
    title,
    category: 'sightseeing',
    startTime: '13:00',
    endTime: '14:00',
    location: { name: title },
    ...extra,
  };
}

function makeDay(activities: any[]) {
  return {
    dayNumber: 2,
    title: 'Day 2',
    activities,
  } as any;
}

const baseInput = (day: any) => ({
  day,
  destination: 'Lisbon, Portugal',
  budgetTier: 'standard',
});

Deno.test('flags orphan transit whose target is not scheduled', () => {
  const day = makeDay([
    activity('Pastéis de Belém'),
    transit('Travel to Tasca do Chico'),
    activity('Castelo de São Jorge'),
  ]);
  const results = validateDay(baseInput(day));
  const orphans = results.filter(r => r.code === FAILURE_CODES.ORPHANED_TRANSIT_NODE);
  assertEquals(orphans.length, 1);
  assertEquals(orphans[0].activityIndex, 1);
  assertEquals(orphans[0].severity, 'critical');
});

Deno.test('does NOT flag when target IS scheduled (substring + diacritics)', () => {
  const day = makeDay([
    transit('Travel to Tasca do Chico'),
    activity('Dinner at Tasca do Chico'),
  ]);
  const results = validateDay(baseInput(day));
  assertEquals(results.filter(r => r.code === FAILURE_CODES.ORPHANED_TRANSIT_NODE).length, 0);

  const day2 = makeDay([
    transit('Walk to Café Versailles'),
    activity('Cafe Versailles pastry tasting'),
  ]);
  const results2 = validateDay(baseInput(day2));
  assertEquals(results2.filter(r => r.code === FAILURE_CODES.ORPHANED_TRANSIT_NODE).length, 0);
});

Deno.test('does NOT flag generic targets (hotel, airport, lunch)', () => {
  const day = makeDay([
    activity('Belém Tower'),
    transit('Walk to hotel'),
    transit('Transfer to airport'),
    transit('Taxi to the station'),
    transit('Travel to lunch'),
  ]);
  const results = validateDay(baseInput(day));
  assertEquals(results.filter(r => r.code === FAILURE_CODES.ORPHANED_TRANSIT_NODE).length, 0);
});

Deno.test('does NOT flag bookend / late-nightlife transit', () => {
  const day = makeDay([
    activity('Fado at Tasca do Chico'),
    transit('Return to Hotel Avenida', {
      source: 'late_nightlife_bookend',
      tags: ['hotel', 'rest'],
    }),
  ]);
  const results = validateDay(baseInput(day));
  assertEquals(results.filter(r => r.code === FAILURE_CODES.ORPHANED_TRANSIT_NODE).length, 0);
});

Deno.test('repair-day removes flagged orphan', () => {
  const day = makeDay([
    activity('Pastéis de Belém'),
    transit('Travel to Tasca do Chico'),
    activity('Castelo de São Jorge'),
  ]);
  const validationResults = validateDay(baseInput(day));
  const result = repairDay({
    day,
    validationResults,
    dayNumber: 2,
    isFirstDay: false,
    isLastDay: false,
  } as any);
  assertEquals(result.day.activities.length, 2);
  assert(!result.day.activities.some((a: any) => /Tasca do Chico/i.test(a.title)));
  assert(result.repairs.some(r => r.code === FAILURE_CODES.ORPHANED_TRANSIT_NODE));
});

Deno.test('repair-day skips locked orphans', () => {
  const day = makeDay([
    activity('Pastéis de Belém'),
    { ...transit('Travel to Tasca do Chico'), isLocked: true, lockReason: 'user' },
    activity('Castelo de São Jorge'),
  ]);
  const validationResults = validateDay(baseInput(day));
  const result = repairDay({
    day,
    validationResults,
    dayNumber: 2,
    isFirstDay: false,
    isLastDay: false,
  } as any);
  // Locked orphan preserved.
  assertEquals(result.day.activities.length, 3);
});

Deno.test('validation-gate drops survivor when repair is bypassed', () => {
  const day = makeDay([
    activity('Pastéis de Belém'),
    transit('Travel to Tasca do Chico'),
    activity('Castelo de São Jorge'),
  ]);
  const results = validateDay(baseInput(day));
  const gated = applyValidationGate(day, results, {
    dayNumber: 2,
    destination: 'Lisbon, Portugal',
  } as any);
  assertEquals(gated.day.activities.length, 2);
  assert(!gated.day.activities.some((a: any) => /Tasca do Chico/i.test(a.title)));
});
