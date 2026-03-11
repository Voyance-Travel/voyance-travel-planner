// src/lib/schema-compiler/pacing-override.ts
// Applies user-selected pacing to override DNA-derived activity counts.

import type { DaySlot, PatternGroupConfig } from '@/types/schema-generation';

export type PacingLevel = 'relaxed' | 'balanced' | 'packed';

const PACING_LIMITS: Record<PacingLevel, { minActivities: number; maxActivities: number; maxEvening: number; bufferOverride: number | null }> = {
  relaxed: {
    minActivities: 2,
    maxActivities: 3,
    maxEvening: 1,
    bufferOverride: 45,
  },
  balanced: {
    minActivities: 3,
    maxActivities: 5,
    maxEvening: 2,
    bufferOverride: null,
  },
  packed: {
    minActivities: 5,
    maxActivities: 7,
    maxEvening: 3,
    bufferOverride: 15,
  },
};

export function applyPacingOverride(
  slots: DaySlot[],
  pacing: PacingLevel,
  dnaConfig: PatternGroupConfig
): DaySlot[] {
  const limits = PACING_LIMITS[pacing];
  if (!limits) return slots;

  let modified = [...slots];

  const activitySlots = modified.filter(s => s.slotType === 'activity');
  const eveningSlots = modified.filter(s => s.slotType === 'evening');

  if (activitySlots.length > limits.maxActivities) {
    let removedCount = 0;
    const toRemove = activitySlots.length - limits.maxActivities;
    modified = modified.filter(slot => {
      if (slot.slotType === 'activity' && removedCount < toRemove) {
        const isLaterSlot = activitySlots.indexOf(slot) >= limits.maxActivities;
        if (isLaterSlot) {
          removedCount++;
          return false;
        }
      }
      return true;
    });
  }

  if (eveningSlots.length > limits.maxEvening) {
    let removedCount = 0;
    const toRemove = eveningSlots.length - limits.maxEvening;
    modified = modified.filter(slot => {
      if (slot.slotType === 'evening' && removedCount < toRemove) {
        removedCount++;
        return false;
      }
      return true;
    });
  }

  const remainingActivities = modified.filter(s => s.slotType === 'activity');
  modified = modified.map(slot => {
    if (slot.slotType === 'activity') {
      const idx = remainingActivities.indexOf(slot);
      return { ...slot, required: idx < limits.minActivities };
    }
    return slot;
  });

  if (remainingActivities.length < limits.minActivities) {
    const toAdd = limits.minActivities - remainingActivities.length;
    const dinnerIdx = modified.findIndex(s => s.slotType === 'meal' && s.mealType === 'dinner');
    const insertPoint = dinnerIdx > 0 ? dinnerIdx : modified.length - 1;

    for (let i = 0; i < toAdd; i++) {
      const newSlot: DaySlot = {
        slotId: `pacing_activity_${i}`,
        slotType: 'activity',
        status: 'empty',
        required: true,
        position: insertPoint + i,
        timeWindow: null,
        aiInstruction: 'Find an additional activity (added by pacing override).',
      };
      modified.splice(insertPoint + i, 0, newSlot);
    }
  }

  if (pacing === 'relaxed') {
    const hasUnscheduled = modified.some(s => s.slotType === 'unscheduled');
    if (!hasUnscheduled) {
      const lunchIdx = modified.findIndex(s => s.slotType === 'meal' && s.mealType === 'lunch');
      const dinnerIdx = modified.findIndex(s => s.slotType === 'meal' && s.mealType === 'dinner');
      const insertIdx = lunchIdx >= 0 && dinnerIdx > lunchIdx
        ? Math.floor((lunchIdx + dinnerIdx) / 2) + 1
        : modified.length - 2;

      const freeSlot: DaySlot = {
        slotId: 'pacing_free_time',
        slotType: 'unscheduled',
        status: 'filled',
        required: true,
        position: insertIdx,
        timeWindow: { earliest: '13:00', latest: '17:00', duration: { min: 90, max: 150 } },
        filledData: {
          title: 'Free time to explore at your own pace',
          category: 'free_time',
          startTime: '14:00',
          endTime: '15:30',
          source: 'system',
          notes: 'Unstructured time — wander, rest, or discover something on your own.',
        },
      };
      modified.splice(insertIdx, 0, freeSlot);
    }
  }

  modified = modified.map((slot, idx) => ({ ...slot, position: idx }));

  return modified;
}
