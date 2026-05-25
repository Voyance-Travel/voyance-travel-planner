/**
 * Deterministic missing must-do injector.
 *
 * Wired into action-generate-trip-day.ts chain-finalization BEFORE the
 * final persist, so injected cards land in JSON, itinerary_activities, and
 * activity_costs naturally. Idempotent: re-running finds 0 missing.
 *
 * Validate-then-stamp: caller re-runs assertMustDoCoverage AFTER injection
 * and only stamps `metadata.must_do_repair_attempted` once the new coverage
 * is verified. Any venues we couldn't schedule are surfaced as
 * `MUST_DO_INJECTION_FAILED` in `generation_health.persistGateCodes`.
 *
 * See mem://constraints/itinerary/must-do-deterministic-injection.
 */

import { scheduleMustDos, type ScheduleInput, type MustDoSlot } from './schedule-must-dos.ts';

export interface InjectResult {
  attempted: string[];
  injected: Array<{ venue: string; dayNumber: number; startTime: string; endTime: string; slotReason: string }>;
  unscheduled: string[];
}

function buildAnchorCard(slot: MustDoSlot, idx: number): Record<string, unknown> {
  return {
    id: `must-do-d${slot.dayNumber}-${idx}-${Date.now()}`,
    title: slot.title,
    name: slot.title,
    startTime: slot.startTime,
    endTime: slot.endTime,
    durationMinutes: slot.durationMinutes,
    category: 'sightseeing',
    venue_name: slot.title,
    location: { name: slot.title, address: '' },
    cost: { amount: 0, currency: 'USD' },
    description: '',
    locked: true,
    isLocked: true,
    lockedSource: `must_do:${slot.title}`,
    anchorSource: 'must_do',
    needsAnchorEnrichment: true,
    source: 'must-do-injection',
  };
}

/**
 * Mutates `days` in place: pushes a locked anchor card into the day picked
 * by the scheduler for every venue in `missing` that found an eligible slot.
 */
export function injectMissingMustDos(
  days: any[],
  missing: string[],
  scheduleCtx: Omit<ScheduleInput, 'days'>,
): InjectResult {
  const result: InjectResult = { attempted: [...missing], injected: [], unscheduled: [] };
  if (!Array.isArray(days) || days.length === 0 || missing.length === 0) {
    result.unscheduled = [...missing];
    return result;
  }

  const slots = scheduleMustDos(missing, { ...scheduleCtx, days });

  slots.forEach((slot, idx) => {
    if (!slot) {
      result.unscheduled.push(missing[idx]);
      return;
    }
    const day = days.find((d: any) => Number(d?.dayNumber) === slot.dayNumber);
    if (!day) {
      result.unscheduled.push(slot.venue);
      return;
    }
    if (!Array.isArray(day.activities)) day.activities = [];
    const card = buildAnchorCard(slot, idx);
    day.activities.push(card);
    result.injected.push({
      venue: slot.venue,
      dayNumber: slot.dayNumber,
      startTime: slot.startTime,
      endTime: slot.endTime,
      slotReason: slot.slotReason,
    });
  });

  return result;
}

export const __test__ = { buildAnchorCard };
