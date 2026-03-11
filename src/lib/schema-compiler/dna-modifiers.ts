// src/lib/schema-compiler/dna-modifiers.ts
// Apply DNA pattern group modifiers to a base day skeleton.

import type { DaySlot, DayType } from '@/types/schema-generation';
import type { PatternGroupConfig } from '@/types/schema-generation';

/**
 * Apply DNA pattern group modifiers to the base skeleton.
 *
 * This adjusts:
 * - Number of activity slots (add or remove to match group range)
 * - Number of evening slots
 * - Meal timing, duration, and instructions
 * - Breakfast requirement
 * - Buffer time between activities
 * - Unscheduled blocks
 * - Hotel priority on arrival days
 */
export function applyDnaModifiers(
  slots: DaySlot[],
  config: PatternGroupConfig,
  dayType: DayType
): DaySlot[] {
  let modified = [...slots];

  // 1. Adjust meal slots — update duration and instruction
  modified = modified.map(slot => {
    if (slot.slotType === 'meal') {
      return {
        ...slot,
        mealInstruction: config.mealInstruction,
        timeWindow: slot.timeWindow
          ? {
              ...slot.timeWindow,
              duration: { ...config.mealDuration },
            }
          : null,
      };
    }
    return slot;
  });

  // 2. Handle breakfast requirement
  if (!config.breakfastRequired) {
    modified = modified.map(slot => {
      if (slot.slotType === 'meal' && slot.mealType === 'breakfast') {
        return { ...slot, required: false };
      }
      return slot;
    });
  }

  // 3. Adjust activity slot count to match DNA range
  const activitySlots = modified.filter(s => s.slotType === 'activity');
  const currentActivityCount = activitySlots.length;
  const targetMax = config.activitySlots.max;
  const targetMin = config.activitySlots.min;

  // Remove excess activity slots (from the end)
  if (currentActivityCount > targetMax) {
    let removedCount = 0;
    modified = modified.filter(slot => {
      if (slot.slotType === 'activity' && removedCount < currentActivityCount - targetMax) {
        const isExcess = activitySlots.indexOf(slot) >= targetMax;
        if (isExcess) {
          removedCount++;
          return false;
        }
      }
      return true;
    });
  }

  // Mark activity slots below min as required
  const remainingActivities = modified.filter(s => s.slotType === 'activity');
  modified = modified.map(slot => {
    if (slot.slotType === 'activity') {
      const actIdx = remainingActivities.indexOf(slot);
      return { ...slot, required: actIdx < targetMin };
    }
    return slot;
  });

  // 4. Adjust evening slot count
  const eveningSlots = modified.filter(s => s.slotType === 'evening');
  const maxEvening = config.eveningSlots.max;
  const minEvening = config.eveningSlots.min;

  if (eveningSlots.length > maxEvening) {
    let removedCount = 0;
    modified = modified.filter(slot => {
      if (slot.slotType === 'evening' && removedCount < eveningSlots.length - maxEvening) {
        removedCount++;
        return false;
      }
      return true;
    });
  }

  const remainingEvening = modified.filter(s => s.slotType === 'evening');
  modified = modified.map(slot => {
    if (slot.slotType === 'evening') {
      const evIdx = remainingEvening.indexOf(slot);
      return { ...slot, required: evIdx < minEvening };
    }
    return slot;
  });

  // 5. Add unscheduled blocks if DNA requires them
  if (config.unscheduledBlocks > 0 && dayType !== 'departure') {
    const existingUnscheduled = modified.filter(s => s.slotType === 'unscheduled');
    const toAdd = config.unscheduledBlocks - existingUnscheduled.length;

    for (let i = 0; i < toAdd; i++) {
      const lunchIdx = modified.findIndex(s => s.slotType === 'meal' && s.mealType === 'lunch');
      const dinnerIdx = modified.findIndex(s => s.slotType === 'meal' && s.mealType === 'dinner');
      const insertIdx = lunchIdx >= 0 && dinnerIdx > lunchIdx
        ? Math.floor((lunchIdx + dinnerIdx) / 2) + 1
        : modified.length - 2;

      const unscheduledSlot: DaySlot = {
        slotId: `unscheduled_${i}`,
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

      modified.splice(insertIdx, 0, unscheduledSlot);
    }
  }

  // 6. Handle hotel priority on arrival days
  if (dayType.includes('arrival') && config.hotelPriority === 'deferred') {
    const hotelIdx = modified.findIndex(s => s.slotType === 'hotel_checkin');
    const firstActivityIdx = modified.findIndex(s => s.slotType === 'activity');

    if (hotelIdx >= 0 && firstActivityIdx >= 0 && hotelIdx < firstActivityIdx) {
      const [hotel] = modified.splice(hotelIdx, 1);
      const newFirstActivityIdx = modified.findIndex(s => s.slotType === 'activity');
      modified.splice(newFirstActivityIdx + 1, 0, hotel);
    }
  }

  // 7. Adjust time windows based on DNA start/end time
  modified = modified.map(slot => {
    if (slot.slotType === 'meal' && slot.mealType === 'breakfast' && slot.timeWindow) {
      const dnaStartHour = parseInt(config.dayStartTime.split(':')[0]);
      const breakfastEarliest = config.dayStartTime;
      const breakfastLatest = `${Math.min(dnaStartHour + 2, 11)}:00`;
      return {
        ...slot,
        timeWindow: {
          ...slot.timeWindow,
          earliest: breakfastEarliest,
          latest: breakfastLatest,
        },
      };
    }
    return slot;
  });

  // 8. Re-index positions
  modified = modified.map((slot, idx) => ({
    ...slot,
    position: idx,
    slotId: slot.slotId.includes('unscheduled')
      ? slot.slotId
      : `slot_${String(idx).padStart(2, '0')}`,
  }));

  return modified;
}
