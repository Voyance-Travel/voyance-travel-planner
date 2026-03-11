// ============================================================
// EDGE FUNCTION COPY — Source of truth is in src/
// This file is a copy of src/lib/schema-compiler/keep-activities-filler.ts
// with import paths adjusted for the Deno edge function environment.
// If you modify this file, also update the src/ version.
// ============================================================

import type { DaySlot } from './types.ts';
import { parseTimeToMinutes } from './time-parser.ts';

export interface KeptActivity {
  title: string;
  startTime: string;
  endTime: string;
  category: string;
  location?: string;
  cost?: number;
  bookingRequired?: boolean;
  personalization?: string;
  tips?: string;
  suggestedFor?: string;
}

/**
 * Pre-fill kept activities into the schema.
 *
 * Each kept activity is matched to the nearest empty slot by time.
 * If no suitable slot exists, a new locked slot is inserted at the right position.
 * The AI will see these as LOCKED and only fill remaining empty slots.
 */
export function fillKeptActivities(
  slots: DaySlot[],
  keptActivities: KeptActivity[]
): DaySlot[] {
  if (!keptActivities || keptActivities.length === 0) return slots;

  let modified = [...slots.map(s => ({ ...s }))];

  // Sort kept activities by start time
  const sorted = [...keptActivities].sort(
    (a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime)
  );

  for (const kept of sorted) {
    const keptStart = parseTimeToMinutes(kept.startTime);

    // Determine if this is a dining activity (should fill a meal slot)
    const isDining = kept.category === 'dining' ||
      kept.category?.toLowerCase().includes('dining');

    // Try to find a matching slot
    let targetIdx = -1;

    if (isDining) {
      // Try to match to a meal slot at a similar time
      for (let i = 0; i < modified.length; i++) {
        const slot = modified[i];
        if (slot.slotType !== 'meal' || slot.status === 'filled') continue;
        if (slot.timeWindow) {
          const earliest = parseTimeToMinutes(slot.timeWindow.earliest);
          const latest = parseTimeToMinutes(slot.timeWindow.latest) + (slot.timeWindow.duration?.max || 120);
          if (keptStart >= earliest - 60 && keptStart <= latest + 60) {
            targetIdx = i;
            break;
          }
        }
      }
    }

    if (targetIdx === -1) {
      // Try to match to an empty activity slot near this time
      for (let i = 0; i < modified.length; i++) {
        const slot = modified[i];
        if (slot.slotType !== 'activity' || slot.status !== 'empty') continue;
        if (slot.timeWindow) {
          const earliest = parseTimeToMinutes(slot.timeWindow.earliest);
          const latest = parseTimeToMinutes(slot.timeWindow.latest) + (slot.timeWindow.duration?.max || 120);
          if (keptStart >= earliest - 60 && keptStart <= latest + 60) {
            targetIdx = i;
            break;
          }
        } else {
          // No time window — flexible slot, use it
          targetIdx = i;
          break;
        }
      }
    }

    if (targetIdx >= 0) {
      // Fill the existing slot
      modified[targetIdx] = {
        ...modified[targetIdx],
        status: 'filled',
        required: true,
        filledData: {
          title: kept.title,
          category: kept.category,
          startTime: kept.startTime,
          endTime: kept.endTime,
          location: kept.location || '',
          cost: kept.cost || 0,
          source: 'user_preference',
          notes: 'Kept from previous generation. DO NOT modify.',
        },
      };
    } else {
      // Insert a new locked slot at the right position
      const insertIdx = findInsertionPoint(modified, kept.startTime);
      const newSlot: DaySlot = {
        slotId: `kept_${kept.title.toLowerCase().replace(/\s+/g, '_').substring(0, 20)}`,
        slotType: isDining ? 'meal' : 'activity',
        status: 'filled',
        required: true,
        position: insertIdx,
        timeWindow: null,
        filledData: {
          title: kept.title,
          category: kept.category,
          startTime: kept.startTime,
          endTime: kept.endTime,
          location: kept.location || '',
          cost: kept.cost || 0,
          source: 'user_preference',
          notes: 'Kept from previous generation. DO NOT modify.',
        },
      };
      modified.splice(insertIdx, 0, newSlot);
    }
  }

  // Re-index positions
  modified = modified.map((slot, idx) => ({ ...slot, position: idx }));

  return modified;
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
