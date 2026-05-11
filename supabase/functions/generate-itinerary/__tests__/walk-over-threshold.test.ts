/**
 * WALK_OVER_THRESHOLD validate→repair→gate cascade.
 *
 * Hard ceiling: walk legs > 30 min OR > 1500 m must be force-converted to
 * taxi/metro. Complements the 650m sanitizer guard.
 */

import { describe, it, expect } from 'vitest';
import { FAILURE_CODES } from '../pipeline/types.ts';
import { validateDay } from '../pipeline/validate-day.ts';
import { repairDay } from '../pipeline/repair-day.ts';
import { applyValidationGate } from '../pipeline/validation-gate.ts';
import { pickTransitFallback } from '../../_shared/transit-mode.ts';

function transitAct(over: Partial<any> = {}) {
  return {
    id: 't1',
    title: 'Walk to Woodstock',
    category: 'transport',
    startTime: '10:00',
    endTime: '12:30',
    transportation: { method: 'walk', durationMinutes: 146, distanceMeters: 12000 },
    ...over,
  };
}

function makeDay(transportOver: Partial<any> = {}) {
  return {
    activities: [
      transitAct(transportOver),
      { id: 'a2', title: 'Lunch in Woodstock', category: 'dining', startTime: '12:30', endTime: '13:30', location: { name: 'Test Cafe' } },
    ],
  } as any;
}

const baseInput = {
  dayNumber: 1, isFirstDay: true, isLastDay: false,
  hasHotel: false, requiredMeals: [], previousDays: [],
};

describe('WALK_OVER_THRESHOLD', () => {
  it('flags 146min/12km walk as critical', () => {
    const day = makeDay();
    const results = validateDay({ ...baseInput, day } as any);
    const hit = results.find(r => r.code === FAILURE_CODES.WALK_OVER_THRESHOLD);
    expect(hit).toBeTruthy();
    expect(hit!.severity).toBe('critical');
    expect(hit!.activityIndex).toBe(0);
  });

  it('does NOT flag 25-min/900m walk', () => {
    const day = makeDay({ transportation: { method: 'walk', durationMinutes: 25, distanceMeters: 900 } });
    const results = validateDay({ ...baseInput, day } as any);
    expect(results.find(r => r.code === FAILURE_CODES.WALK_OVER_THRESHOLD)).toBeUndefined();
  });

  it('flags 20min/1800m (distance only)', () => {
    const day = makeDay({ transportation: { method: 'walk', durationMinutes: 20, distanceMeters: 1800 } });
    const results = validateDay({ ...baseInput, day } as any);
    expect(results.find(r => r.code === FAILURE_CODES.WALK_OVER_THRESHOLD)).toBeTruthy();
  });

  it('repair converts walk → uber for 12km leg + rewrites title', async () => {
    const day = makeDay();
    const results = validateDay({ ...baseInput, day } as any);
    const out = await repairDay({ day, validationResults: results, dayNumber: 1, isFirstDay: true, isLastDay: false } as any);
    const t = out.day.activities[0].transportation;
    expect(t.method).toBe('uber');
    expect(t.estimatedCost.amount).toBeGreaterThan(0);
    expect(out.day.activities[0].title).toMatch(/^Taxi to/);
    expect(out.repairs.find(r => r.code === FAILURE_CODES.WALK_OVER_THRESHOLD)).toBeTruthy();
  });

  it('gate fallback fires when distance unknown', () => {
    const day = makeDay({ transportation: { method: 'walk', durationMinutes: 40, distanceMeters: 0 } });
    const results = [{
      code: FAILURE_CODES.WALK_OVER_THRESHOLD, severity: 'critical' as const,
      message: 'x', activityIndex: 0, field: 'transportation', autoRepairable: true,
    }];
    const r = applyValidationGate(day, results, { dayNumber: 1 });
    const t = r.day.activities[0].transportation;
    expect(t.method).toBe('uber');
    expect(t.durationMinutes).toBeGreaterThanOrEqual(20);
    expect(t.estimatedCost.amount).toBe(15);
    expect(r.counters.forcedDowngrades).toBeGreaterThanOrEqual(1);
  });

  it('pickTransitFallback returns taxi defaults for unknown distance', () => {
    const tier = pickTransitFallback(null, 5, 'Somewhere');
    expect(tier.method).toBe('uber');
    expect(tier.durationMinutes).toBe(20);
    expect(tier.costAmount).toBe(15);
  });

  // ── M4 leak-path regressions ────────────────────────────────────────────
  it('flags title-only walk with empty transportation.method (Madrid DiverXO)', () => {
    const day = {
      activities: [
        {
          id: 't1',
          title: 'Walk to DiverXO',
          category: 'transport',
          startTime: '12:30',
          endTime: '13:57',
          transportation: {}, // method missing — LLM omission
        },
        { id: 'a2', title: 'Lunch', category: 'dining', startTime: '14:00', endTime: '15:30' },
      ],
    } as any;
    const results = validateDay({ ...baseInput, day } as any);
    const hit = results.find(r => r.code === FAILURE_CODES.WALK_OVER_THRESHOLD);
    expect(hit).toBeTruthy();
    expect(hit!.severity).toBe('critical');
  });

  it('flags walk with top-level durationMinutes only (no transport block duration)', () => {
    const day = {
      activities: [
        {
          id: 't1',
          title: 'Walk to Salamanca',
          category: 'transport',
          durationMinutes: 87,
          transportation: { method: 'walk' },
        },
        { id: 'a2', title: 'Dinner', category: 'dining' },
      ],
    } as any;
    const results = validateDay({ ...baseInput, day } as any);
    expect(results.find(r => r.code === FAILURE_CODES.WALK_OVER_THRESHOLD)).toBeTruthy();
  });
});

describe('enforceTransitModeByDistance — duration-only fallback', () => {
  it('overrides walk → uber/metro when coords missing but duration > 15min', async () => {
    const { enforceTransitModeByDistance } = await import('../sanitization');
    const act: any = {
      title: 'Walk to DiverXO',
      category: 'transport',
      transportation: { method: 'walk', durationMinutes: 87 },
    };
    const changed = enforceTransitModeByDistance(act, null, null, 'TEST');
    expect(changed).toBe(true);
    expect(act.transportation.method).not.toBe('walk');
    expect(['uber', 'metro']).toContain(act.transportation.method);
    expect(act.title).not.toMatch(/^Walk\b/);
  });

  it('does NOT override when coords missing AND duration ≤ 15min', async () => {
    const { enforceTransitModeByDistance } = await import('../sanitization');
    const act: any = {
      title: 'Walk to Plaza Mayor',
      category: 'transport',
      transportation: { method: 'walk', durationMinutes: 8 },
    };
    const changed = enforceTransitModeByDistance(act, null, null, 'TEST');
    expect(changed).toBe(false);
    expect(act.transportation.method).toBe('walk');
  });
});
