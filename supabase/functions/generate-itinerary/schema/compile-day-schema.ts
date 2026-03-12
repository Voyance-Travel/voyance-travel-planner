// ============================================================
// EDGE FUNCTION COPY — Source of truth is in src/
// This file is a copy of src/lib/schema-compiler/compile-day-schema.ts with import paths
// adjusted for the Deno edge function environment.
// If you modify this file, also update the src/ version.
// ============================================================

import type {
  DaySchema,
  DayType,
  DaySlot,
  PatternGroup,
  DayConstraints,
  TravelerRef,
  SlotTimeWindow,
} from './types.ts';
import { getPatternGroupConfig } from './pattern-group-configs.ts';
import { getPatternGroupForArchetype } from './archetype-group-mapping.ts';
import { buildBaseSkeleton } from './day-skeletons.ts';
import { applyDnaModifiers } from './dna-modifiers.ts';
import { fillFlightAndHotelSlots } from './constraint-filler.ts';
import { fillMustDoSlots, type MustDoInput } from './must-do-filler.ts';
import { fillPreBookedSlots } from './prebooked-filler.ts';
import { fillKeptActivities } from './keep-activities-filler.ts';
import { resolveConflicts } from './conflict-resolver.ts';
import { applyPacingOverride } from './pacing-override.ts';

export interface CompilerInput {
  // === EXISTING FIELDS (from Fix 22B) ===
  dayNumber: number;
  totalDays: number;
  destination: string;
  date: string;
  archetypeName: string;
  patternGroup?: PatternGroup;
  arrivalFlight?: {
    arrivalTime: string;
    airportName: string;
    airportCode: string;
  };
  departureFlight?: {
    departureTime: string;
    airportName: string;
    airportCode: string;
    isDomestic: boolean;
  };
  hotel?: {
    name: string;
    address: string;
    checkInTime?: string;
    checkOutTime?: string;
  };
  mustDos?: {
    title: string;
    startTime?: string;
    endTime?: string;
    location?: string;
  }[];
  travelers: TravelerRef[];

  // === NEW FIELDS (Fix 22G — Gap Fixes) ===

  /** Gap 1: User constraints from the "Just Tell Us" chat planner. */
  userConstraints?: string;

  /** Gap 1: Generation rules — blocked time windows, hotel changes, guest changes. */
  generationRules?: {
    blockedWindows?: { start: string; end: string; reason: string }[];
    hotelChanges?: string[];
    guestChanges?: string[];
    otherRules?: string[];
  };

  /** Gap 5: Additional notes / trip purpose. */
  additionalNotes?: string;

  /** Gap 6: Interest categories the user selected. */
  interestCategories?: string[];

  /** Gap 7: Must-haves checklist — things the user wants across the whole trip. */
  mustHaves?: string[];

  /** Gap 3: Is this the traveler's first time visiting this destination? */
  isFirstTimeVisitor?: boolean;

  /** Gap 8: Activities from previous days to avoid duplicates. */
  previousDayActivities?: { title: string; category: string; location?: string }[];

  /** Gap 10: Fallback times from preferences when no flight record exists. */
  preferredArrivalTime?: string;
  preferredDepartureTime?: string;

  /** Gap 4: Pre-booked commitments (shows, reservations, tours with fixed times). */
  preBookedCommitments?: {
    title: string;
    startTime: string;
    endTime: string;
    location?: string;
    category?: string;
    cost?: number;
  }[];

  /** User-selected pacing override (handled in Fix 22H). */
  pacingOverride?: 'relaxed' | 'balanced' | 'packed';

  /** Gap 9: Multi-city trip data */
  isMultiCity?: boolean;
  isTransitionDay?: boolean;
  transitionFrom?: string;
  transitionTo?: string;
  transitionMode?: 'flight' | 'train' | 'drive' | 'ferry';
  transitionDepartureTime?: string;
  transitionArrivalTime?: string;

  /** Hotel in the new city (for transition days) */
  destinationHotel?: {
    name: string;
    address: string;
    checkInTime?: string;
  };

  /** Gap 12: Activities to preserve during regeneration.
   *  These are existing activities the user chose to keep.
   *  They get pre-filled into schema slots as locked entries. */
  keepActivities?: {
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
  }[];
}

export function compileDaySchema(input: CompilerInput): DaySchema {
  const dayType = determineDayType(input);
  const baseSlots = buildBaseSkeleton(dayType);
  const patternGroup = input.patternGroup || getPatternGroupForArchetype(input.archetypeName);
  const groupConfig = getPatternGroupConfig(patternGroup);
  const modifiedSlots = applyDnaModifiers(baseSlots, groupConfig, dayType);

  // Step 4b: Apply user pacing override (if different from DNA default)
  let pacedSlots = modifiedSlots;
  if (input.pacingOverride) {
    pacedSlots = applyPacingOverride(modifiedSlots, input.pacingOverride, groupConfig);
  }

  let filledSlots = fillFlightAndHotelSlots(pacedSlots, input);

  if (input.mustDos && input.mustDos.length > 0) {
    const mustDoInputs: MustDoInput[] = input.mustDos.map(md => ({
      rawTitle: md.title,
      startTime: md.startTime,
      endTime: md.endTime,
      location: md.location,
    }));
    filledSlots = fillMustDoSlots(filledSlots, mustDoInputs, input.hotel?.address);
  }

  // Step 5c: Fill pre-booked commitments (reservations, shows, tours)
  if (input.preBookedCommitments && input.preBookedCommitments.length > 0) {
    filledSlots = fillPreBookedSlots(filledSlots, input.preBookedCommitments, input.hotel?.address);
  }

  // Step 5d: Fill kept activities (from partial regeneration)
  if (input.keepActivities && input.keepActivities.length > 0) {
    filledSlots = fillKeptActivities(filledSlots, input.keepActivities);
  }

  // Step 5e: Enforce blocked windows — remove/shrink empty slots that overlap
  if (input.generationRules?.blockedWindows && input.generationRules.blockedWindows.length > 0) {
    filledSlots = applyBlockedWindows(filledSlots, input.generationRules.blockedWindows);
  }

  const resolvedSlots = resolveConflicts(filledSlots, groupConfig);

  // Sort slots chronologically by actual time
  const sortedSlots = sortSlotsByTime(resolvedSlots);

  const schema: DaySchema = {
    dayNumber: input.dayNumber,
    dayType,
    patternGroup,
    archetypeName: input.archetypeName,
    destination: input.destination,
    date: input.date,
    slots: sortedSlots,
    constraints: {
      dayStartTime: groupConfig.dayStartTime,
      dayEndTime: groupConfig.dayEndTime,
      maxActivitySlots: groupConfig.activitySlots.max,
      mealWeight: groupConfig.mealWeight,
      bufferMinutes: groupConfig.bufferMinutes,
      unscheduledBlocks: groupConfig.unscheduledBlocks,
      eveningSlots: groupConfig.eveningSlots.max,
    },
    travelers: input.travelers,
  };

  return schema;
}

function determineDayType(input: CompilerInput): DayType {
  // Check for transition day FIRST (takes priority)
  if (input.isTransitionDay) {
    return 'transition';
  }

  // Last day with a departure flight or preferred departure time = departure day
  if (input.dayNumber === input.totalDays) {
    if (input.departureFlight || input.preferredDepartureTime) {
      return 'departure';
    }
  }

  // First day with arrival data = arrival day (subtype based on time)
  if (input.dayNumber === 1) {
    const arrivalTime = input.arrivalFlight?.arrivalTime || input.preferredArrivalTime;
    if (arrivalTime) {
      const arrivalHour = parseHour(arrivalTime);
      if (arrivalHour < 11) return 'morning_arrival';
      if (arrivalHour < 16) return 'midday_arrival';
      return 'latenight_arrival';
    }
    return 'midday_arrival';
  }

  return 'standard';
}

function parseHour(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours + (minutes || 0) / 60;
}

function applyBlockedWindows(
  slots: DaySlot[],
  blockedWindows: { start: string; end: string; reason: string }[]
): DaySlot[] {
  let result = slots;

  for (const blocked of blockedWindows) {
    const bStart = parseHour(blocked.start);
    const bEnd = parseHour(blocked.end);

    result = result.reduce<DaySlot[]>((acc, slot) => {
      if (slot.status === 'filled' || !slot.timeWindow) {
        acc.push(slot);
        return acc;
      }

      const sStart = parseHour(slot.timeWindow.earliest);
      const sEnd = parseHour(slot.timeWindow.latest);

      if (sEnd <= bStart || sStart >= bEnd) {
        acc.push(slot);
        return acc;
      }

      if (sStart >= bStart && sEnd <= bEnd) {
        return acc;
      }

      if (sStart < bStart) {
        acc.push({
          ...slot,
          timeWindow: { ...slot.timeWindow, latest: toHHMM(bStart) },
        });
      }
      if (sEnd > bEnd) {
        acc.push({
          ...slot,
          slotId: slot.slotId + '_post',
          timeWindow: { ...slot.timeWindow, earliest: toHHMM(bEnd) },
        });
      }

      return acc;
    }, []);
  }

  return result.map((slot, i) => ({ ...slot, position: i + 1 }));
}

function toHHMM(decimalHour: number): string {
  const h = Math.floor(decimalHour);
  const m = Math.round((decimalHour - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function sortSlotsByTime(slots: DaySlot[]): DaySlot[] {
  const getSlotTime = (slot: DaySlot): number => {
    if (slot.status === 'filled' && slot.filledData?.startTime) {
      return parseHour(slot.filledData.startTime);
    }
    if (slot.timeWindow?.earliest) {
      return parseHour(slot.timeWindow.earliest);
    }
    return 99;
  };

  const sorted = [...slots].sort((a, b) => getSlotTime(a) - getSlotTime(b));
  return sorted.map((slot, idx) => ({ ...slot, position: idx }));
}
