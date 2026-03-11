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
import { resolveConflicts } from './conflict-resolver.ts';

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
}

export function compileDaySchema(input: CompilerInput): DaySchema {
  const dayType = determineDayType(input);
  const baseSlots = buildBaseSkeleton(dayType);
  const patternGroup = input.patternGroup || getPatternGroupForArchetype(input.archetypeName);
  const groupConfig = getPatternGroupConfig(patternGroup);
  const modifiedSlots = applyDnaModifiers(baseSlots, groupConfig, dayType);
  let filledSlots = fillFlightAndHotelSlots(modifiedSlots, input);

  if (input.mustDos && input.mustDos.length > 0) {
    const mustDoInputs: MustDoInput[] = input.mustDos.map(md => ({
      rawTitle: md.title,
      startTime: md.startTime,
      endTime: md.endTime,
      location: md.location,
    }));
    filledSlots = fillMustDoSlots(filledSlots, mustDoInputs, input.hotel?.address);
  }

  const resolvedSlots = resolveConflicts(filledSlots, groupConfig);

  const schema: DaySchema = {
    dayNumber: input.dayNumber,
    dayType,
    patternGroup,
    archetypeName: input.archetypeName,
    destination: input.destination,
    date: input.date,
    slots: resolvedSlots,
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
    // No arrival data at all — default to midday arrival (safest default)
    return 'midday_arrival';
  }

  return 'standard';
}

function parseHour(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours + (minutes || 0) / 60;
}
