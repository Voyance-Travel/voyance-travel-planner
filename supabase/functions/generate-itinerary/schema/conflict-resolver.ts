// ============================================================
// EDGE FUNCTION COPY — Source of truth is in src/
// This file is a copy of src/lib/schema-compiler/conflict-resolver.ts with import paths
// adjusted for the Deno edge function environment.
// If you modify this file, also update the src/ version.
// ============================================================

import type { DaySlot } from './types.ts';
import type { PatternGroupConfig } from './types.ts';

export function resolveConflicts(
  slots: DaySlot[],
  config: PatternGroupConfig
): DaySlot[] {
  let resolved = [...slots];

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

  resolved = resolved.map((slot, idx) => ({ ...slot, position: idx }));

  return resolved;
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}
