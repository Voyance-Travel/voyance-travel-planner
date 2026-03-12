// src/lib/schema-compiler/must-do-filler.ts
// Pre-fill must-do activities into schema slots and reverse-schedule transport.
// Solves Fix 19 Bug 1 (late arrival) and Bug 2 (Noon not parsed).
//
// ISOLATION: Imports only from schema-generation types and time-parser.

import type { DaySlot, SlotFilledData } from '@/types/schema-generation';
import {
  extractTimeRange,
  cleanActivityTitle,
  parseTimeToMinutes,
  minutesToTime,
  subtractMinutes,
  addMinutes,
} from './time-parser';
import { SCHEMA_GENERATION_CONFIG } from '@/config/feature-flags';

/**
 * Raw must-do input from the user/trip data.
 */
export interface MustDoInput {
  rawTitle: string;          // e.g., "US Open Noon-4:30pm" or "US Open"
  startTime?: string;        // "HH:MM" if already parsed
  endTime?: string;          // "HH:MM" if already parsed
  location?: string;
  cost?: number;
}

/**
 * Pre-fill must-do activities into the day's slots.
 *
 * For each must-do:
 * 1. Parse the time range (including "Noon" handling)
 * 2. Clean the title
 * 3. Find the correct slot to fill
 * 4. Reverse-calculate transport timing
 * 5. Adjust surrounding slots to fit
 *
 * Returns the modified slot array.
 */
export function fillMustDoSlots(
  slots: DaySlot[],
  mustDos: MustDoInput[],
  hotelLocation?: string
): DaySlot[] {
  if (!mustDos || mustDos.length === 0) return slots;

  let modified = [...slots.map(s => ({ ...s }))]; // deep copy

  for (const mustDo of mustDos) {
    modified = fillSingleMustDo(modified, mustDo, hotelLocation);
  }

  // Re-index positions
  modified = modified.map((slot, idx) => ({ ...slot, position: idx }));

  return modified;
}

/**
 * Fill a single must-do into the slot array.
 */
function fillSingleMustDo(
  slots: DaySlot[],
  mustDo: MustDoInput,
  hotelLocation?: string
): DaySlot[] {
  // Step 1: Parse time range
  let startTime = mustDo.startTime || null;
  let endTime = mustDo.endTime || null;

  if (!startTime || !endTime) {
    const extracted = extractTimeRange(mustDo.rawTitle);
    if (extracted) {
      startTime = startTime || extracted.startTime;
      endTime = endTime || extracted.endTime;
    }
  }

  // Step 2: Clean the title
  const cleanedTitle = cleanActivityTitle(mustDo.rawTitle);
  const title = cleanedTitle || mustDo.rawTitle; // fallback if cleaning removes everything

  // Step 3: Find the right slot to place this must-do
  const targetSlot = findBestSlotForMustDo(slots, startTime, endTime);

  if (targetSlot === -1) {
    // No suitable slot found — insert a new one
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
    // Fill the existing slot
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

  // Step 4: Reverse-calculate transport if must-do has a start time
  if (startTime) {
    slots = reverseScheduleTransport(slots, startTime, hotelLocation);
  }

  // Step 5: Check if must-do covers a meal window
  if (startTime && endTime) {
    slots = handleMealOverlap(slots, startTime, endTime);
  }

  return slots;
}

/**
 * Find the best existing slot to place a must-do.
 * Prefers empty activity slots that overlap with the must-do's time window.
 * Returns the slot index, or -1 if no suitable slot found.
 */
function findBestSlotForMustDo(
  slots: DaySlot[],
  startTime: string | null,
  endTime: string | null
): number {
  if (!startTime) {
    // No specific time — find the first empty activity slot
    return slots.findIndex(s => s.slotType === 'activity' && s.status === 'empty');
  }

  const mustDoStart = parseTimeToMinutes(startTime);

  // Find an empty activity slot whose time window contains the must-do start
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
      // No time window — this slot is flexible, use it if nothing better exists
      return i;
    }
  }

  return -1;
}

/**
 * Find the right insertion point for a must-do based on its start time.
 */
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

/**
 * Reverse-schedule transport to arrive at must-do on time.
 * This is the fix for Fix 19 Bug 1: transfers scheduled forward
 * from morning start instead of backward from must-do anchor.
 *
 * If must-do starts at 9:00 AM:
 * - Transfer takes ~45 min (configurable)
 * - Buffer: 15 min
 * - Transfer must depart by 8:00 AM
 * - Everything before the transfer must end by 8:00 AM
 */
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

  // Find the must-do slot index
  const mustDoIdx = slots.findIndex(s => s.slotType === 'must_do' && s.status === 'filled');
  if (mustDoIdx === -1) return slots;

  // Check if there's already a transport slot right before the must-do
  const prevSlotIdx = mustDoIdx - 1;
  if (prevSlotIdx >= 0 && slots[prevSlotIdx].slotType === 'transport') {
    // Update existing transport slot with reverse-calculated time
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
    // Insert a new transport slot before the must-do
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

  // Adjust all slots BEFORE the transport to end before departure time
  const transportIdx = slots.findIndex(s => s.slotId === 'transport_to_must_do' || (s.slotType === 'transport' && s.aiInstruction?.includes('MUST DEPART')));

  if (transportIdx > 0) {
    for (let i = 0; i < transportIdx; i++) {
      const slot = slots[i];

      // Compress time windows for slots before the transport
      if (slot.timeWindow && slot.status === 'empty') {
        const slotLatestEnd = parseTimeToMinutes(slot.timeWindow.latest) + (slot.timeWindow.duration?.max || 60);
        const departureMinutes = parseTimeToMinutes(departureTime);

        if (slotLatestEnd > departureMinutes) {
          // This slot extends past the departure — compress it
          const newLatest = minutesToTime(Math.max(
            parseTimeToMinutes(slot.timeWindow.earliest),
            departureMinutes - (slot.timeWindow.duration?.max || 60) - bufferMinutes
          ));

          slots[i] = {
            ...slot,
            timeWindow: {
              ...slot.timeWindow,
              latest: newLatest,
            },
          };
        }
      }

      // For filled slots before transport, add a note about the time constraint
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

/**
 * Handle cases where a must-do overlaps with a meal window.
 *
 * Examples:
 * - US Open 9am-5pm covers lunch (11:30-2pm) → add "grab food inside the venue" note
 * - Dinner reservation at 8pm IS a meal → fill the dinner slot, don't create a separate dining activity
 */
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

    // Check if the meal's time window falls within the must-do's duration
    if (slot.timeWindow) {
      const mealEarliest = parseTimeToMinutes(slot.timeWindow.earliest);
      const mealLatest = parseTimeToMinutes(slot.timeWindow.latest);

      // Meal window is fully inside the must-do duration
      if (mealEarliest >= startMin && mealLatest <= endMin) {
        // The must-do covers this meal time — mark the meal as covered
        slots[i] = {
          ...slot,
          required: false,
          aiInstruction: `${slot.mealType || 'Meal'} window is covered by the must-do activity (${mustDoStart}-${mustDoEnd}). The traveler will eat at the venue. You may skip this slot or suggest a quick bite at the venue.`,
        };
      }
      // Meal window partially overlaps — shift the meal
      else if (
        (mealEarliest >= startMin && mealEarliest < endMin) ||
        (mealLatest > startMin && mealLatest <= endMin)
      ) {
        // Shift meal to after the must-do
        const newEarliest = minutesToTime(endMin + 15);
        const newLatest = minutesToTime(endMin + 90);
        slots[i] = {
          ...slot,
          timeWindow: {
            ...slot.timeWindow,
            earliest: newEarliest,
            latest: newLatest,
          },
          aiInstruction: `${slot.aiInstruction || ''} Shifted to after the must-do activity (ends ${mustDoEnd}).`.trim(),
        };
      }
    }
  }

  return slots;
}
