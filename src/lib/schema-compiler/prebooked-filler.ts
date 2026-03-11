// src/lib/schema-compiler/prebooked-filler.ts
// Fill pre-booked commitments (confirmed reservations, shows, tours)
// into schema slots. Similar to must-do filling but with meal awareness.

import type { DaySlot } from '@/types/schema-generation';
import { parseTimeToMinutes, subtractMinutes } from './time-parser';
import { SCHEMA_GENERATION_CONFIG } from '@/config/feature-flags';

export interface PreBookedInput {
  title: string;
  startTime: string;       // "HH:MM" — always known for pre-booked
  endTime: string;          // "HH:MM" — always known for pre-booked
  location?: string;
  category?: string;        // "dining", "entertainment", "tour", etc.
  cost?: number;
}

/**
 * Determine if a pre-booked commitment is a dining event.
 * If so, it should replace a meal slot instead of an activity slot.
 */
function isDiningCommitment(commitment: PreBookedInput): boolean {
  if (commitment.category === 'dining') return true;
  const lowerTitle = commitment.title.toLowerCase();
  return (
    lowerTitle.includes('dinner') ||
    lowerTitle.includes('lunch') ||
    lowerTitle.includes('brunch') ||
    lowerTitle.includes('breakfast') ||
    lowerTitle.includes('restaurant') ||
    lowerTitle.includes('reservation') ||
    lowerTitle.includes('dining')
  );
}

/**
 * Determine which meal type a dining commitment replaces based on its time.
 */
function inferMealType(startTime: string): 'breakfast' | 'lunch' | 'dinner' {
  const hour = parseInt(startTime.split(':')[0]);
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  return 'dinner';
}

/**
 * Fill pre-booked commitments into the day's slots.
 *
 * For each commitment:
 * 1. If it's a dining event → replace the matching meal slot
 * 2. If it's not dining → fill an activity slot or insert a new locked slot
 * 3. Add reverse-calculated transport if needed
 */
export function fillPreBookedSlots(
  slots: DaySlot[],
  preBooked: PreBookedInput[],
  hotelLocation?: string
): DaySlot[] {
  if (!preBooked || preBooked.length === 0) return slots;

  let modified = [...slots.map(s => ({ ...s }))];

  // Sort by start time so we process earlier commitments first
  const sorted = [...preBooked].sort(
    (a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime)
  );

  for (const commitment of sorted) {
    if (isDiningCommitment(commitment)) {
      modified = fillDiningCommitment(modified, commitment);
    } else {
      modified = fillActivityCommitment(modified, commitment, hotelLocation);
    }
  }

  // Re-index positions
  modified = modified.map((slot, idx) => ({ ...slot, position: idx }));

  return modified;
}

/**
 * Replace a meal slot with a dining commitment.
 */
function fillDiningCommitment(slots: DaySlot[], commitment: PreBookedInput): DaySlot[] {
  const mealType = inferMealType(commitment.startTime);

  const mealIdx = slots.findIndex(
    s => s.slotType === 'meal' && s.mealType === mealType && s.status === 'empty'
  );

  if (mealIdx >= 0) {
    slots[mealIdx] = {
      ...slots[mealIdx],
      status: 'filled',
      filledData: {
        title: commitment.title,
        category: 'dining',
        startTime: commitment.startTime,
        endTime: commitment.endTime,
        location: commitment.location || '',
        cost: commitment.cost || 0,
        source: 'user_preference',
        notes: 'Pre-booked dining reservation. DO NOT modify.',
      },
    };
  } else {
    const insertIdx = findInsertionPoint(slots, commitment.startTime);
    const newSlot: DaySlot = {
      slotId: `prebooked_${commitment.title.toLowerCase().replace(/\s+/g, '_').substring(0, 20)}`,
      slotType: 'meal',
      mealType: mealType,
      status: 'filled',
      required: true,
      position: insertIdx,
      timeWindow: null,
      filledData: {
        title: commitment.title,
        category: 'dining',
        startTime: commitment.startTime,
        endTime: commitment.endTime,
        location: commitment.location || '',
        cost: commitment.cost || 0,
        source: 'user_preference',
        notes: 'Pre-booked dining reservation. DO NOT modify.',
      },
    };
    slots.splice(insertIdx, 0, newSlot);
  }

  return slots;
}

/**
 * Fill a non-dining commitment into an activity slot.
 */
function fillActivityCommitment(
  slots: DaySlot[],
  commitment: PreBookedInput,
  hotelLocation?: string
): DaySlot[] {
  const startMin = parseTimeToMinutes(commitment.startTime);

  let targetIdx = -1;
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (slot.slotType !== 'activity' || slot.status !== 'empty') continue;

    if (slot.timeWindow) {
      const earliest = parseTimeToMinutes(slot.timeWindow.earliest);
      const latest = parseTimeToMinutes(slot.timeWindow.latest) + (slot.timeWindow.duration?.max || 120);
      if (startMin >= earliest - 60 && startMin <= latest + 60) {
        targetIdx = i;
        break;
      }
    } else {
      targetIdx = i;
      break;
    }
  }

  if (targetIdx >= 0) {
    slots[targetIdx] = {
      ...slots[targetIdx],
      status: 'filled',
      required: true,
      filledData: {
        title: commitment.title,
        category: commitment.category || 'entertainment',
        startTime: commitment.startTime,
        endTime: commitment.endTime,
        location: commitment.location || '',
        cost: commitment.cost || 0,
        source: 'user_preference',
        notes: 'Pre-booked commitment. DO NOT modify.',
      },
    };
  } else {
    const insertIdx = findInsertionPoint(slots, commitment.startTime);
    const newSlot: DaySlot = {
      slotId: `prebooked_${commitment.title.toLowerCase().replace(/\s+/g, '_').substring(0, 20)}`,
      slotType: 'activity',
      status: 'filled',
      required: true,
      position: insertIdx,
      timeWindow: null,
      filledData: {
        title: commitment.title,
        category: commitment.category || 'entertainment',
        startTime: commitment.startTime,
        endTime: commitment.endTime,
        location: commitment.location || '',
        cost: commitment.cost || 0,
        source: 'user_preference',
        notes: 'Pre-booked commitment. DO NOT modify.',
      },
    };
    slots.splice(insertIdx, 0, newSlot);
  }

  const transferMinutes = SCHEMA_GENERATION_CONFIG.defaultTransferMinutes;
  const bufferMinutes = SCHEMA_GENERATION_CONFIG.mustDoBufferMinutes;
  const departureTime = subtractMinutes(commitment.startTime, transferMinutes + bufferMinutes);

  const commitmentIdx = slots.findIndex(
    s => s.status === 'filled' && s.filledData?.title === commitment.title
  );
  if (commitmentIdx > 0) {
    const prevSlot = slots[commitmentIdx - 1];
    if (prevSlot.slotType !== 'transport') {
      const transportSlot: DaySlot = {
        slotId: `transport_to_${commitment.title.toLowerCase().replace(/\s+/g, '_').substring(0, 15)}`,
        slotType: 'transport',
        status: 'empty',
        required: true,
        position: commitmentIdx,
        timeWindow: {
          earliest: subtractMinutes(departureTime, 15),
          latest: departureTime,
          duration: { min: transferMinutes - 15, max: transferMinutes + 15 },
        },
        aiInstruction: `Transport to ${commitment.title}. Must arrive by ${commitment.startTime}. ${hotelLocation ? `From: ${hotelLocation} or previous activity.` : ''}`,
      };
      slots.splice(commitmentIdx, 0, transportSlot);
    }
  }

  const endMin = parseTimeToMinutes(commitment.endTime);
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
          aiInstruction: `${slot.mealType || 'Meal'} window covered by pre-booked commitment "${commitment.title}" (${commitment.startTime}-${commitment.endTime}). Skip or suggest food at the venue.`,
        };
      }
    }
  }

  return slots;
}

function findInsertionPoint(slots: DaySlot[], startTime: string): number {
  const targetMin = parseTimeToMinutes(startTime);
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const slotTime = slot.filledData?.startTime || slot.timeWindow?.earliest;
    if (slotTime && parseTimeToMinutes(slotTime) > targetMin) return i;
  }
  return slots.length;
}
