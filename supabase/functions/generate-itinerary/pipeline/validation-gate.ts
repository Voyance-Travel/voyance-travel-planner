/**
 * Validation Gate — the missing blocking layer between validate-day and persist.
 *
 * Premise: validate-day.ts already classifies failures as info/warning/error/critical
 * but nothing acts on the classification. This gate runs AFTER repair-day, re-validates
 * (cheap), and forces in-place downgrades for any `critical` semantic failure that
 * survived the deterministic repair pass.
 *
 * Severity policy:
 *   critical  → downgrade-in-place (blank field / drop activity / strip identity);
 *               persist with metadata.quality.gate_forced_persist = true.
 *   error     → log only (repair already had its chance).
 *   warning   → log only.
 *
 * No regen call here. Regen would be expensive and would break the per-day flow;
 * the gate's job is to ensure no critical defect reaches the UI.
 *
 * Memory: mem://constraints/itinerary/validation-gate-blocking-layer
 * See plan: .lovable/plan.md (Semantic Validation Gate)
 */

import { FAILURE_CODES, type ValidationResult } from './types.ts';
import type { StrictDayMinimal, StrictActivityMinimal } from '../day-validation.ts';
import { pickTransitFallback } from '../../_shared/transit-mode.ts';
import { trimToLastSentence } from './repair-day.ts';

export interface GateCounters {
  critical: number;
  error: number;
  warning: number;
  forcedDowngrades: number;
  droppedActivities: number;
  blankedFields: number;
}

export interface GateResult {
  verdict: 'persist' | 'persist_forced';
  counters: GateCounters;
  /** Mutated day (in place); also returned for clarity. */
  day: StrictDayMinimal;
}

const ZERO: GateCounters = {
  critical: 0, error: 0, warning: 0,
  forcedDowngrades: 0, droppedActivities: 0, blankedFields: 0,
};

/**
 * Apply the validation gate to a (post-repair) day. Mutates `day.activities`
 * in place when downgrades are required.
 */
export function applyValidationGate(
  day: StrictDayMinimal,
  results: ValidationResult[],
  ctx: { dayNumber: number; destination?: string },
): GateResult {
  const counters: GateCounters = { ...ZERO };

  for (const r of results) {
    if (r.severity === 'critical') counters.critical++;
    else if (r.severity === 'error') counters.error++;
    else if (r.severity === 'warning') counters.warning++;
  }

  if (counters.critical === 0) {
    log(ctx.dayNumber, 'persist', counters);
    return { verdict: 'persist', counters, day };
  }

  // Process critical issues, in reverse activity-index order so splices don't
  // shift later indices.
  const criticals = results
    .filter(r => r.severity === 'critical')
    .sort((a, b) => (b.activityIndex ?? -1) - (a.activityIndex ?? -1));

  const droppedIdx = new Set<number>();

  for (const r of criticals) {
    const idx = r.activityIndex;
    if (idx == null || idx < 0 || idx >= day.activities.length) continue;
    const act = day.activities[idx] as any;

    switch (r.code) {
      case FAILURE_CODES.PUNCTUATION_ONLY_FIELD: {
        if (r.field && typeof act[r.field] === 'string') {
          act[r.field] = '';
          counters.blankedFields++;
          counters.forcedDowngrades++;
        }
        break;
      }
      case FAILURE_CODES.CHECKOUT_HOTEL_LEAK: {
        if (!droppedIdx.has(idx)) {
          droppedIdx.add(idx);
          counters.droppedActivities++;
          counters.forcedDowngrades++;
        }
        break;
      }
      case FAILURE_CODES.WALK_OVER_THRESHOLD: {
        // Final safety net: even if repair-day was bypassed (e.g. legacy path)
        // or coords missing, force walk → taxi with conservative defaults.
        const t = (act.transportation = act.transportation || {});
        const distM = Number(t.distanceMeters) || 0;
        const curDur = Number(t.durationMinutes) || 0;
        const destName = (day.activities[idx + 1] as any)?.location?.name
          || act?.location?.name || '';
        const tier = pickTransitFallback(distM > 0 ? distM : null, curDur, destName);
        t.method = tier.method;
        t.durationMinutes = tier.durationMinutes;
        t.duration = `${tier.durationMinutes} min`;
        const currency = t.estimatedCost?.currency || 'USD';
        t.estimatedCost = { amount: tier.costAmount, currency };
        if (act.cost && typeof act.cost === 'object') {
          act.cost.amount = tier.costAmount;
          if (!act.cost.currency) act.cost.currency = currency;
        }
        if (typeof act.title === 'string') {
          const verb = tier.method === 'metro' ? 'Metro' : 'Taxi';
          act.title = act.title.replace(/^(?:Walk|Walking)\b/i, verb);
        }
        counters.forcedDowngrades++;
        break;
      }
      case FAILURE_CODES.TRUNCATED_SENTENCE: {
        // Trim mid-sentence tail back to the last sentence boundary.
        // If no terminator exists, leave field unchanged (don't fall through
        // to default which would blank it — fragment > blank).
        if (r.field && typeof act[r.field] === 'string') {
          const trimmed = trimToLastSentence(act[r.field]);
          if (trimmed != null && trimmed !== act[r.field]) {
            act[r.field] = trimmed;
            counters.blankedFields++;
            counters.forcedDowngrades++;
          }
        }
        break;
      }
      case FAILURE_CODES.SUSPICIOUS_DUPLICATE_PRICE: {
        // Final safety net mirroring repair-day §10d. The LLM duplicated a
        // price token across adjacent same-category cards; blank cost on the
        // offending activity so downstream snapshot estimates from cost_reference.
        if (act?.cost && typeof act.cost === 'object') act.cost.amount = 0;
        if (act?.estimatedCost && typeof act.estimatedCost === 'object') act.estimatedCost.amount = 0;
        if (typeof act.price_per_person === 'number') act.price_per_person = 0;
        if (typeof act.estimated_price_per_person === 'number') act.estimated_price_per_person = 0;
        if (typeof act.price === 'number') act.price = 0;
        counters.blankedFields++;
        counters.forcedDowngrades++;
        break;
      }
      default: {
        // Unknown critical → blank the offending field if any, else drop.
        if (r.field && typeof act[r.field] === 'string') {
          act[r.field] = '';
          counters.blankedFields++;
          counters.forcedDowngrades++;
        } else if (!droppedIdx.has(idx)) {
          droppedIdx.add(idx);
          counters.droppedActivities++;
          counters.forcedDowngrades++;
        }
      }
    }
  }

  if (droppedIdx.size > 0) {
    day.activities = day.activities.filter((_: StrictActivityMinimal, i: number) => !droppedIdx.has(i));
  }

  log(ctx.dayNumber, 'persist_forced', counters);
  return { verdict: 'persist_forced', counters, day };
}

function log(dayNumber: number, verdict: string, c: GateCounters): void {
  console.log(
    `[VALIDATION_GATE] day=${dayNumber} verdict=${verdict} ` +
    `critical=${c.critical} error=${c.error} warning=${c.warning} ` +
    `forcedDowngrades=${c.forcedDowngrades} dropped=${c.droppedActivities} blanked=${c.blankedFields}`,
  );
}
