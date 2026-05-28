// Unit tests for selectMustDosForDay — the pure day-assignment filter helper
// extracted from the schema-filler orchestrator.
//
// These tests exercise only the pure function (no LLM, no DB) so they run
// fast and deterministically.

import { assertEquals } from 'jsr:@std/assert@1';
import { selectMustDosForDay } from '../schema-filler-orchestrator.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const ALL_MUST_DOS = [
  { id: 'md-1', title: 'Eiffel Tower', category: 'landmark', priority: 10, fixedDayNumber: null },
  { id: 'md-2', title: 'Louvre Museum', category: 'museum', priority: 9, fixedDayNumber: null },
  { id: 'md-3', title: 'Montmartre Walk', category: 'walking', priority: 8, fixedDayNumber: null },
  { id: 'md-4', title: 'Seine Cruise', category: 'activity', priority: 7, fixedDayNumber: null },
  { id: 'md-5', title: 'Versailles', category: 'landmark', priority: 6, fixedDayNumber: null },
];

function makeTripPlan(assignments: Array<{ dayNumber: number; refs: string[] }>) {
  return {
    dayAssignments: assignments.map(({ dayNumber, refs }) => ({
      dayNumber,
      mustDoSlots: refs.map((ref, i) => ({ slotId: `d${dayNumber}-slot-${i}`, mustDoRef: ref })),
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('selectMustDosForDay: Planner assigned 2 of 5 must-dos to Day 2 → only those 2 reach the skeleton', () => {
  const tripPlan = makeTripPlan([
    { dayNumber: 1, refs: ['md-1'] },
    { dayNumber: 2, refs: ['md-2', 'md-3'] },
    { dayNumber: 3, refs: ['md-4', 'md-5'] },
  ]);

  const result = selectMustDosForDay(ALL_MUST_DOS, 2, tripPlan);

  assertEquals(result.appliedDayAssignment, true);
  assertEquals(result.filtered.length, 2);
  assertEquals(result.filtered.map((m) => m.id).sort(), ['md-2', 'md-3']);
  assertEquals(result.assignedMustDoIds.sort(), ['md-2', 'md-3']);
});

Deno.test('selectMustDosForDay: no tripPlan → all must-dos passed through (legacy parity)', () => {
  const result = selectMustDosForDay(ALL_MUST_DOS, 2, null);

  assertEquals(result.appliedDayAssignment, false);
  assertEquals(result.filtered.length, ALL_MUST_DOS.length);
  assertEquals(result.assignedMustDoIds, []);
});

Deno.test('selectMustDosForDay: tripPlan present but no assignment for that day → falls back to full list', () => {
  // Only days 1 and 3 have assignments; Day 2 is absent.
  const tripPlan = makeTripPlan([
    { dayNumber: 1, refs: ['md-1'] },
    { dayNumber: 3, refs: ['md-5'] },
  ]);

  const result = selectMustDosForDay(ALL_MUST_DOS, 2, tripPlan);

  assertEquals(result.appliedDayAssignment, false);
  assertEquals(result.filtered.length, ALL_MUST_DOS.length);
  assertEquals(result.assignedMustDoIds, []);
});

Deno.test('selectMustDosForDay: fixedDayNumber must-do not in Planner assignment is preserved as safety net', () => {
  // md-4 has fixedDayNumber=2 (hard-anchored) but Planner only listed md-2 for Day 2.
  const mustDosWithFixed = ALL_MUST_DOS.map((m) =>
    m.id === 'md-4' ? { ...m, fixedDayNumber: 2 } : m,
  );
  const tripPlan = makeTripPlan([
    { dayNumber: 2, refs: ['md-2'] },
  ]);

  const result = selectMustDosForDay(mustDosWithFixed, 2, tripPlan);

  assertEquals(result.appliedDayAssignment, true);
  // md-2 (assigned by Planner) + md-4 (fixedDayNumber=2) both present.
  assertEquals(result.filtered.length, 2);
  const ids = result.filtered.map((m) => m.id).sort();
  assertEquals(ids, ['md-2', 'md-4']);
  // assignedMustDoIds reflects only what Planner said — not the fixed one.
  assertEquals(result.assignedMustDoIds, ['md-2']);
});

Deno.test('selectMustDosForDay: trace fields appliedDayAssignment and assignedMustDoIds are present and correct', () => {
  const tripPlan = makeTripPlan([
    { dayNumber: 1, refs: ['md-1', 'md-3'] },
  ]);

  const applied = selectMustDosForDay(ALL_MUST_DOS, 1, tripPlan);
  assertEquals(applied.appliedDayAssignment, true);
  assertEquals(applied.assignedMustDoIds.sort(), ['md-1', 'md-3']);

  const notApplied = selectMustDosForDay(ALL_MUST_DOS, 2, null);
  assertEquals(notApplied.appliedDayAssignment, false);
  assertEquals(notApplied.assignedMustDoIds, []);
});

Deno.test('selectMustDosForDay: empty dayAssignments array → falls back to full list', () => {
  const tripPlan = { dayAssignments: [] };
  const result = selectMustDosForDay(ALL_MUST_DOS, 1, tripPlan);

  assertEquals(result.appliedDayAssignment, false);
  assertEquals(result.filtered.length, ALL_MUST_DOS.length);
});
