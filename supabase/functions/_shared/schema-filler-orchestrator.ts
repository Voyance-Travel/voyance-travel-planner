// Phase 4 Filler Orchestrator — single entry point used by per-day actions.
//
// Behavior:
//   1. Rebuild the per-day SkeletonDay deterministically (same code Phase 3 uses).
//   2. Apply trip_plan.dayAssignments from metadata (must-do refs already
//      decided by the Planner) via selectMustDosForDay().
//   3. Call fillDaySkeleton against the empty slots.
//   4. Merge the result back into the skeleton, run the adapter, return shape
//      ready to feed into the legacy enrich/repair tail.
//
// In Phase 4 this is invoked in DRY-RUN mode behind the per-trip flag
// `metadata.feature_flags.schema_filler = true`. The caller stamps the trace
// under `metadata.quality.slot_filler` and does NOT replace the legacy AI path.
// Phase 5 / a follow-up commit flips to replacement once dry-run data is clean.

import { buildEmptyDaySkeleton } from './build-day-skeleton.ts';
import { fillDaySkeleton, mergeFillsIntoSkeleton, type FillerCallOptions } from './slot-filler-llm.ts';
import { skeletonToActivities, type AdapterActivity } from './skeleton-to-activities.ts';
import type { SkeletonDay, PatternGroup } from './schema-generation.ts';

export interface FillerOrchestratorInput {
  tripId: string;
  dayNumber: number;
  totalDays: number;
  destination: string;
  startDate: string;
  budgetTier?: string | null;
  archetype?: string | null;
  patternGroup?: PatternGroup | null;
  arrivalTime24?: string | null;
  departureTime24?: string | null;
  hasHotelData?: boolean;
  mustDos: Array<{ id: string; title: string; category?: string | null; priority?: number | null; fixedDayNumber?: number | null }>;
  /** Already-stored Phase 3 trip_plan if any (slot↔mustDo assignments). */
  tripPlan?: { dayAssignments?: Array<{ dayNumber: number; mustDoSlots: Array<{ slotId: string; mustDoRef: string }> }> } | null;
}

export interface FillerOrchestratorResult {
  ok: boolean;
  skeleton: SkeletonDay;
  filledSkeleton: SkeletonDay;
  activities: AdapterActivity[];
  unfilledSlotIds: string[];
  fillCount: number;
  durationMs: number;
  attempts: number;
  error?: string;
  /** Compact trace stamp ready to write to metadata.quality.slot_filler. */
  trace: {
    dayNumber: number;
    calls: number;
    fills: number;
    unfilled: number;
    durationMs: number;
    error?: string;
    /** Whether a Planner dayAssignment was found and applied for this day. */
    appliedDayAssignment: boolean;
    /** IDs from the Planner's mustDoSlots for this day (empty when no assignment). */
    assignedMustDoIds: string[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helper — exported so it can be unit-tested without mocking the LLM.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given the full must-do list and a (possibly absent) trip_plan, return the
 * subset that belongs to `dayNumber`.
 *
 * Rules (in priority order):
 *  1. If `tripPlan.dayAssignments` is absent → return full list (legacy fallback).
 *  2. If no assignment exists for `dayNumber` → return full list (safety fallback).
 *  3. Otherwise keep only must-dos whose `id` is referenced in that day's
 *     `mustDoSlots[].mustDoRef` **OR** whose `fixedDayNumber === dayNumber`
 *     (hard-anchored must-dos are always preserved regardless of Planner output).
 */
export function selectMustDosForDay(
  mustDos: FillerOrchestratorInput['mustDos'],
  dayNumber: number,
  tripPlan?: FillerOrchestratorInput['tripPlan'] | null,
): {
  filtered: FillerOrchestratorInput['mustDos'];
  appliedDayAssignment: boolean;
  assignedMustDoIds: string[];
} {
  if (!tripPlan?.dayAssignments?.length) {
    return { filtered: mustDos, appliedDayAssignment: false, assignedMustDoIds: [] };
  }

  const assignment = tripPlan.dayAssignments.find((a) => a.dayNumber === dayNumber);
  if (!assignment) {
    return { filtered: mustDos, appliedDayAssignment: false, assignedMustDoIds: [] };
  }

  const assignedIds = new Set(assignment.mustDoSlots.map((s) => s.mustDoRef));
  const filtered = mustDos.filter(
    (m) => assignedIds.has(m.id) || m.fixedDayNumber === dayNumber,
  );

  return {
    filtered,
    appliedDayAssignment: true,
    assignedMustDoIds: [...assignedIds],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator
// ─────────────────────────────────────────────────────────────────────────────

export async function runSchemaFillerForDay(
  input: FillerOrchestratorInput,
  opts: FillerCallOptions = {},
): Promise<FillerOrchestratorResult> {
  const t0 = Date.now();

  // Apply Planner day assignments — filter must-dos to only those assigned to
  // this specific day. Falls back to full list when no tripPlan is present.
  const { filtered: dayMustDos, appliedDayAssignment, assignedMustDoIds } = selectMustDosForDay(
    input.mustDos,
    input.dayNumber,
    input.tripPlan,
  );

  const built = buildEmptyDaySkeleton({
    dayNumber: input.dayNumber,
    totalDays: input.totalDays,
    date: new Date(
      new Date(input.startDate).getTime() + (input.dayNumber - 1) * 86400000,
    ).toISOString().slice(0, 10),
    destination: input.destination,
    isFirstDay: input.dayNumber === 1,
    isLastDay: input.dayNumber === input.totalDays,
    patternGroup: input.patternGroup ?? undefined,
    archetypeName: input.archetype ?? undefined,
    arrivalTime24: input.dayNumber === 1 ? input.arrivalTime24 ?? null : null,
    departureTime24: input.dayNumber === input.totalDays ? input.departureTime24 ?? null : null,
    hasHotelData: input.hasHotelData,
    mustDos: dayMustDos.map((m) => ({
      id: m.id,
      title: m.title,
      category: m.category ?? undefined,
      priority: m.priority ?? undefined,
      fixedDayNumber: m.fixedDayNumber ?? undefined,
    })),
  });

  const skeleton = built.skeleton;
  const titles: Record<string, string> = Object.fromEntries(
    dayMustDos.map((m) => [m.id, m.title]),
  );

  const filler = await fillDaySkeleton(
    { skeleton, archetype: input.archetype, budgetTier: input.budgetTier, mustDoTitlesById: titles },
    opts,
  );

  if (!filler.ok || !filler.response) {
    return {
      ok: false,
      skeleton,
      filledSkeleton: skeleton,
      activities: [],
      unfilledSlotIds: filler.unfilledSlotIds,
      fillCount: 0,
      durationMs: Date.now() - t0,
      attempts: filler.attempts,
      error: filler.error,
      trace: {
        dayNumber: input.dayNumber,
        calls: filler.attempts,
        fills: 0,
        unfilled: filler.unfilledSlotIds.length,
        durationMs: filler.durationMs,
        error: filler.error,
        appliedDayAssignment,
        assignedMustDoIds,
      },
    };
  }

  const filledSkeleton = mergeFillsIntoSkeleton(skeleton, filler.response.fills);
  const { activities } = skeletonToActivities(filledSkeleton);

  return {
    ok: true,
    skeleton,
    filledSkeleton,
    activities,
    unfilledSlotIds: filler.unfilledSlotIds,
    fillCount: filler.response.fills.length,
    durationMs: Date.now() - t0,
    attempts: filler.attempts,
    trace: {
      dayNumber: input.dayNumber,
      calls: filler.attempts,
      fills: filler.response.fills.length,
      unfilled: filler.unfilledSlotIds.length,
      durationMs: filler.durationMs,
      appliedDayAssignment,
      assignedMustDoIds,
    },
  };
}
