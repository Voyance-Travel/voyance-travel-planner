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
 * Categories of AI-generated cards that are "filler" and may be displaced
 * to make room for a user-selected attraction. Locked / manual / extracted /
 * pinned / user / booked / dining / meal / logistics rows are NEVER displaced.
 *
 * See plan: "user-selected attractions outrank AI filler activities".
 */
const FILLER_CATEGORY_RE = /\b(sightseeing|cultural|activity|experience|entertainment|leisure|shopping|exploration|wellness|spa|relaxation|landmark|monument)\b/i;
const PROTECTED_CATEGORY_RE = /\b(dining|food|breakfast|brunch|lunch|dinner|cafe|transport|transit|transfer|logistics|airport|flight|accommodation|hotel|checkout|return|bookend)\b/i;

function isDisplaceableFiller(a: any): boolean {
  if (!a || typeof a !== 'object') return false;
  if (a.isLocked || a.locked || a.userAdded || a.userEdited || a.extracted || a.pinned || a.isManual) return false;
  const basis = String(a?.cost?.basis || a?.cost_basis || '').toLowerCase();
  if (basis === 'user' || basis === 'user_override' || basis === 'booked') return false;
  if (a.source === 'must-do-injection') return false;
  if (a.anchorSource) return false;
  const cat = String(a.category || '').toLowerCase();
  const title = String(a.title || a.name || '').toLowerCase();
  if (PROTECTED_CATEGORY_RE.test(cat) || PROTECTED_CATEGORY_RE.test(title)) return false;
  if (!FILLER_CATEGORY_RE.test(cat)) return false;
  return true;
}

/**
 * Mutates `days` in place: pushes a locked anchor card into the day picked
 * by the scheduler for every venue in `missing` that found an eligible slot.
 * Falls back to displacing AI-generated filler when no clean slot exists.
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

  let slots = scheduleMustDos(missing, { ...scheduleCtx, days });

  // ── DISPLACEMENT PASS ────────────────────────────────────────────
  // For any venue the scheduler couldn't slot, try removing the
  // lowest-value AI filler card on the trip to free up its window, then
  // re-run the scheduler against the lighter days. This is the practical
  // fix for "we selected 4, only 2 fit": selected attractions outrank
  // generic filler. Locked / manual / dining / logistics rows are exempt.
  const initialUnscheduledIdxs = slots
    .map((s, i) => (s === null ? i : -1))
    .filter((i) => i >= 0);
  if (initialUnscheduledIdxs.length > 0) {
    let displaced = 0;
    for (const idx of initialUnscheduledIdxs) {
      // Find the fullest day (most filler cards) and drop ONE filler.
      let bestDay: any = null;
      let bestFillerIdx = -1;
      let bestDayLoad = -1;
      for (const day of days) {
        const acts = Array.isArray(day?.activities) ? day.activities : [];
        const fillerIdxs = acts
          .map((a: any, i: number) => (isDisplaceableFiller(a) ? i : -1))
          .filter((i: number) => i >= 0);
        if (fillerIdxs.length === 0) continue;
        if (fillerIdxs.length > bestDayLoad) {
          bestDayLoad = fillerIdxs.length;
          bestDay = day;
          // Prefer the last filler (usually the lowest-priority AI add).
          bestFillerIdx = fillerIdxs[fillerIdxs.length - 1];
        }
      }
      if (bestDay && bestFillerIdx >= 0) {
        const dropped = bestDay.activities.splice(bestFillerIdx, 1)[0];
        displaced++;
        console.log(
          `[MUST_DO_DISPLACE] day=${bestDay.dayNumber} dropped filler "${dropped?.title || dropped?.name}" to make room for "${missing[idx]}"`,
        );
      }
    }
    if (displaced > 0) {
      // Re-run scheduler with lighter days.
      const stillMissing = initialUnscheduledIdxs.map((i) => missing[i]);
      const retrySlots = scheduleMustDos(stillMissing, { ...scheduleCtx, days });
      retrySlots.forEach((s, j) => {
        const originalIdx = initialUnscheduledIdxs[j];
        if (s) slots[originalIdx] = s;
      });
      console.log(`[MUST_DO_DISPLACE] retry placed ${retrySlots.filter(Boolean).length}/${stillMissing.length} after ${displaced} displacement(s)`);
    }
  }

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
