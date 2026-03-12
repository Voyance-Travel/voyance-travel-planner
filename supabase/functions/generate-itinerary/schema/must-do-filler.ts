// ============================================================
// EDGE FUNCTION COPY — Source of truth is in src/
// This file is a copy of src/lib/schema-compiler/must-do-filler.ts with import paths
// adjusted for the Deno edge function environment.
// If you modify this file, also update the src/ version.
// ============================================================

import type { DaySlot, SlotFilledData } from './types.ts';
import {
  extractTimeRange,
  cleanActivityTitle,
  parseTimeToMinutes,
  minutesToTime,
  subtractMinutes,
  addMinutes,
} from './time-parser.ts';
import { SCHEMA_GENERATION_CONFIG } from './feature-flags.ts';

export interface MustDoInput {
  rawTitle: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  cost?: number;
}

export function fillMustDoSlots(
  slots: DaySlot[],
  mustDos: MustDoInput[],
  hotelLocation?: string
): DaySlot[] {
  if (!mustDos || mustDos.length === 0) return slots;

  let modified = [...slots.map(s => ({ ...s }))];

  for (const mustDo of mustDos) {
    modified = fillSingleMustDo(modified, mustDo, hotelLocation);
  }

  modified = modified.map((slot, idx) => ({ ...slot, position: idx }));

  return modified;
}

function fillSingleMustDo(
  slots: DaySlot[],
  mustDo: MustDoInput,
  hotelLocation?: string
): DaySlot[] {
  let startTime = mustDo.startTime || null;
  let endTime = mustDo.endTime || null;

  if (!startTime || !endTime) {
    const extracted = extractTimeRange(mustDo.rawTitle);
    if (extracted) {
      startTime = startTime || extracted.startTime;
      endTime = endTime || extracted.endTime;
    }
  }

  const cleanedTitle = cleanActivityTitle(mustDo.rawTitle);
  const title = cleanedTitle || mustDo.rawTitle;

  const targetSlot = findBestSlotForMustDo(slots, startTime, endTime);

  if (targetSlot === -1) {
    const insertIdx = findInsertionPoint(slots, startTime);
    const mustDoSlot: DaySlot = {
      slotId: `must_do_${cleanedTitle.toLowerCase().replace(/\s+/g, '_').substring(0, 20)}`,
      slotType: 'must_do',
      status: 'filled',
      required: true,
      position: insertIdx,
      timeWindow: startTime && endTime ? {
        earliest: startTime,
        latest: startTime,
        duration: {
          min: parseTimeToMinutes(endTime) - parseTimeToMinutes(startTime),
          max: parseTimeToMinutes(endTime) - parseTimeToMinutes(startTime),
        },
      } : null,
      filledData: {
        title,
        category: 'must_do',
        startTime: startTime || '09:00',
        endTime: endTime || '17:00',
        location: mustDo.location || '',
        cost: mustDo.cost || 0,
        source: 'must_do',
        notes: 'User-specified must-do activity. DO NOT modify.',
      },
    };

    slots.splice(insertIdx, 0, mustDoSlot);
  } else {
    slots[targetSlot] = {
      ...slots[targetSlot],
      slotType: 'must_do',
      status: 'filled',
      required: true,
      filledData: {
        title,
        category: 'must_do',
        startTime: startTime || slots[targetSlot].timeWindow?.earliest || '09:00',
        endTime: endTime || slots[targetSlot].timeWindow?.latest || '17:00',
        location: mustDo.location || '',
        cost: mustDo.cost || 0,
        source: 'must_do',
        notes: 'User-specified must-do activity. DO NOT modify.',
      },
    };
  }

  if (startTime) {
    slots = reverseScheduleTransport(slots, startTime, hotelLocation);
  }

  if (startTime && endTime) {
    slots = handleMealOverlap(slots, startTime, endTime);
  }

  return slots;
}

function findBestSlotForMustDo(
  slots: DaySlot[],
  startTime: string | null,
  endTime: string | null
): number {
  if (!startTime) {
    return slots.findIndex(s => s.slotType === 'activity' && s.status === 'empty');
  }

  const mustDoStart = parseTimeToMinutes(startTime);

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (slot.slotType !== 'activity' || slot.status !== 'empty') continue;

    if (slot.timeWindow) {
      const windowStart = parseTimeToMinutes(slot.timeWindow.earliest);
      const windowEnd = parseTimeToMinutes(slot.timeWindow.latest) + slot.timeWindow.duration.max;
      if (mustDoStart >= windowStart - 60 && mustDoStart <= windowEnd + 60) {
        return i;
      }
    } else {
      return i;
    }
  }

  return -1;
}

function findInsertionPoint(slots: DaySlot[], startTime: string | null): number {
  if (!startTime) return slots.length - 1;

  const mustDoStart = parseTimeToMinutes(startTime);

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (slot.filledData?.startTime) {
      const slotStart = parseTimeToMinutes(slot.filledData.startTime);
      if (slotStart > mustDoStart) return i;
    } else if (slot.timeWindow?.earliest) {
      const slotStart = parseTimeToMinutes(slot.timeWindow.earliest);
      if (slotStart > mustDoStart) return i;
    }
  }

  return slots.length;
}

function reverseScheduleTransport(
  slots: DaySlot[],
  mustDoStartTime: string,
  hotelLocation?: string
): DaySlot[] {
  const transferMinutes = SCHEMA_GENERATION_CONFIG.defaultTransferMinutes;
  const bufferMinutes = SCHEMA_GENERATION_CONFIG.mustDoBufferMinutes;

  const mustDoStart = parseTimeToMinutes(mustDoStartTime);
  const latestDeparture = mustDoStart - transferMinutes - bufferMinutes;
  const departureTime = minutesToTime(Math.max(latestDeparture, 0));

  const mustDoIdx = slots.findIndex(s => s.slotType === 'must_do' && s.status === 'filled');
  if (mustDoIdx === -1) return slots;

  const prevSlotIdx = mustDoIdx - 1;
  if (prevSlotIdx >= 0 && slots[prevSlotIdx].slotType === 'transport') {
    slots[prevSlotIdx] = {
      ...slots[prevSlotIdx],
      status: 'empty',
      aiInstruction: `Transport to must-do activity. MUST DEPART by ${departureTime} to arrive by ${mustDoStartTime}. ${hotelLocation ? `From: ${hotelLocation}` : ''}`,
      timeWindow: {
        earliest: subtractMinutes(departureTime, 15),
        latest: departureTime,
        duration: { min: transferMinutes - 15, max: transferMinutes + 15 },
      },
    };
  } else {
    const transportSlot: DaySlot = {
      slotId: `transport_to_must_do`,
      slotType: 'transport',
      status: 'empty',
      required: true,
      position: mustDoIdx,
      timeWindow: {
        earliest: subtractMinutes(departureTime, 15),
        latest: departureTime,
        duration: { min: transferMinutes - 15, max: transferMinutes + 15 },
      },
      aiInstruction: `Transport to must-do activity. MUST DEPART by ${departureTime} to arrive by ${mustDoStartTime}. ${hotelLocation ? `From: ${hotelLocation}` : ''}`,
    };

    slots.splice(mustDoIdx, 0, transportSlot);
  }

  const transportIdx = slots.findIndex(s => s.slotId === 'transport_to_must_do' || (s.slotType === 'transport' && s.aiInstruction?.includes('MUST DEPART')));

  if (transportIdx > 0) {
    for (let i = 0; i < transportIdx; i++) {
      const slot = slots[i];

      if (slot.timeWindow && slot.status === 'empty') {
        const slotLatestEnd = parseTimeToMinutes(slot.timeWindow.latest) + (slot.timeWindow.duration?.max || 60);
        const departureMinutes = parseTimeToMinutes(departureTime);

        if (slotLatestEnd > departureMinutes) {
          const newLatest = minutesToTime(Math.max(
            parseTimeToMinutes(slot.timeWindow.earliest),
            departureMinutes - (slot.timeWindow.duration?.max || 60) - bufferMinutes
          ));

          slots[i] = {
            ...slot,
            timeWindow: { ...slot.timeWindow, latest: newLatest },
          };
        }
      }

      if (slot.status === 'filled' && slot.filledData) {
        // Store departure constraint as a schema-level hint, NOT in the visible notes field.
        // The notes field flows through to the final output and should only contain user-facing text.
        slots[i] = {
          ...slot,
          departureConstraint: `Must end before ${departureTime}`,
          filledData: {
            ...slot.filledData,
            // Preserve existing notes without injecting system text
          },
        };
      }
    }
  }

  return slots;
}

function handleMealOverlap(
  slots: DaySlot[],
  mustDoStart: string,
  mustDoEnd: string
): DaySlot[] {
  const startMin = parseTimeToMinutes(mustDoStart);
  const endMin = parseTimeToMinutes(mustDoEnd);

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (slot.slotType !== 'meal' || slot.status === 'filled') continue;

    if (slot.timeWindow) {
      const mealEarliest = parseTimeToMinutes(slot.timeWindow.earliest);
      const mealLatest = parseTimeToMinutes(slot.timeWindow.latest);

      if (mealEarliest >= startMin && mealLatest <= endMin) {
        slots[i] = {
          ...slot,
          required: false,
          aiInstruction: `${slot.mealType || 'Meal'} window is covered by the must-do activity (${mustDoStart}-${mustDoEnd}). The traveler will eat at the venue. You may skip this slot or suggest a quick bite at the venue.`,
        };
      } else if (
        (mealEarliest >= startMin && mealEarliest < endMin) ||
        (mealLatest > startMin && mealLatest <= endMin)
      ) {
        const newEarliest = minutesToTime(endMin + 15);
        const newLatest = minutesToTime(endMin + 90);
        slots[i] = {
          ...slot,
          timeWindow: { ...slot.timeWindow, earliest: newEarliest, latest: newLatest },
          aiInstruction: `${slot.aiInstruction || ''} Shifted to after the must-do activity (ends ${mustDoEnd}).`.trim(),
        };
      }
    }
  }

  return slots;
}
