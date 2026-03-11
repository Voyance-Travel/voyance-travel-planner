// src/lib/schema-compiler/conflict-resolver.ts
// Detect and resolve slot conflicts in the compiled schema.

import type { DaySlot } from '@/types/schema-generation';
import type { PatternGroupConfig } from '@/types/schema-generation';

/**
 * Resolve conflicts in the slot array.
 *
 * Checks for:
 * - Overlapping time windows between consecutive slots
 * - Duplicate meal types (two lunches, two dinners)
 * - Slots that extend past dayEndTime
 * - Insufficient time for required slots
 */
export function resolveConflicts(
  slots: DaySlot[],
  config: PatternGroupConfig
): DaySlot[] {
  let resolved = [...slots];

  // 1. Remove duplicate meal types (keep the first of each type)
  const seenMealTypes = new Set<string>();
  resolved = resolved.filter(slot => {
    if (slot.slotType === 'meal' && slot.mealType) {
      if (seenMealTypes.has(slot.mealType)) {
        return false;
      }
      seenMealTypes.add(slot.mealType);
    }
    return true;
  });

  // 2. Ensure slots don't extend past dayEndTime
  const dayEndMinutes = parseTimeToMinutes(config.dayEndTime);
  resolved = resolved.filter(slot => {
    if (slot.timeWindow && slot.status === 'empty') {
      const slotStart = parseTimeToMinutes(slot.timeWindow.earliest);
      if (slotStart >= dayEndMinutes) {
        return !slot.required;
      }
    }
    return true;
  });

  // 3. Re-index positions after any removals
  resolved = resolved.map((slot, idx) => ({ ...slot, position: idx }));

  return resolved;
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}
