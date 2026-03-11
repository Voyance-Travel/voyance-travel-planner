// src/lib/schema-compiler/compile-day-schema.ts
// Schema-Driven Generation — Day Schema Compiler
// Part of the isolated schema generation system (Fix 22A-E)
//
// ISOLATION: This file imports ONLY from:
//   - @/types/schema-generation (Fix 22A types)
//   - @/config/pattern-group-configs (Fix 22A configs)
//   - @/config/archetype-group-mapping (Fix 22A mapping)
//   - Other files in this same directory (schema-compiler/)
//
// It does NOT import from supabase/functions/generate-itinerary/ or any
// existing generation code. It is a pure function: data in → schema out.

import type {
  DaySchema,
  DayType,
  DaySlot,
  PatternGroup,
  DayConstraints,
  TravelerRef,
  SlotTimeWindow,
} from '@/types/schema-generation';
import { getPatternGroupConfig } from '@/config/pattern-group-configs';
import { getPatternGroupForArchetype } from '@/config/archetype-group-mapping';
import { buildBaseSkeleton } from './day-skeletons';
import { applyDnaModifiers } from './dna-modifiers';
import { fillFlightAndHotelSlots } from './constraint-filler';
import { fillMustDoSlots, type MustDoInput } from './must-do-filler';
import { fillPreBookedSlots } from './prebooked-filler';
import { fillKeptActivities } from './keep-activities-filler';
import { resolveConflicts } from './conflict-resolver';
import { applyPacingOverride } from './pacing-override';

/**
 * Input data needed to compile a day schema.
 * This is gathered from the trip record and user profiles
 * BEFORE the compiler runs.
 */
export interface CompilerInput {
  // === EXISTING FIELDS (from Fix 22B) ===
  dayNumber: number;
  totalDays: number;
  destination: string;
  date: string;                        // ISO date string

  // Traveler DNA
  archetypeName: string;               // from profiles.travel_archetype
  patternGroup?: PatternGroup;         // from profiles.pattern_group (may be null for old profiles)

  // Flight data (if available for this day)
  arrivalFlight?: {
    arrivalTime: string;               // "HH:MM" in local destination time
    airportName: string;
    airportCode: string;
  };
  departureFlight?: {
    departureTime: string;             // "HH:MM" in local destination time
    airportName: string;
    airportCode: string;
    isDomestic: boolean;               // domestic = 90 min buffer, international = 120
  };

  // Hotel data (if available)
  hotel?: {
    name: string;
    address: string;
    checkInTime?: string;              // "HH:MM", default "15:00"
    checkOutTime?: string;             // "HH:MM", default "11:00"
  };

  // Must-do activities for this specific day (basic info only in Fix 22B)
  // Full must-do pre-fill logic is in Fix 22E
  mustDos?: {
    title: string;
    startTime?: string;                // "HH:MM" if user specified
    endTime?: string;                  // "HH:MM" if user specified
    location?: string;
  }[];

  // Group trip travelers
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
  preferredArrivalTime?: string;   // "HH:MM" — used if arrivalFlight is missing
  preferredDepartureTime?: string; // "HH:MM" — used if departureFlight is missing

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

/**
 * Compile a DaySchema for a single day.
 *
 * This is the main entry point. It is a PURE FUNCTION:
 * same input → same output, no side effects, no AI calls.
 *
 * Returns a complete DaySchema ready for prompt serialization (Fix 22C)
 * or logging/debugging.
 */
export function compileDaySchema(input: CompilerInput): DaySchema {
  // Step 1: Determine day type
  const dayType = determineDayType(input);

  // Step 2: Load base skeleton
  const baseSlots = buildBaseSkeleton(dayType);

  // Step 3: Look up DNA pattern group
  const patternGroup = input.patternGroup || getPatternGroupForArchetype(input.archetypeName);
  const groupConfig = getPatternGroupConfig(patternGroup);

  // Step 4: Apply DNA modifiers to the skeleton
  const modifiedSlots = applyDnaModifiers(baseSlots, groupConfig, dayType);

  // Step 4b: Apply user pacing override (if different from DNA default)
  let pacedSlots = modifiedSlots;
  if (input.pacingOverride) {
    pacedSlots = applyPacingOverride(modifiedSlots, input.pacingOverride, groupConfig);
  }

  // Step 5: Fill known constraints (flights, hotel)
  let filledSlots = fillFlightAndHotelSlots(pacedSlots, input);

  // Step 5b: Fill must-do activities with reverse scheduling
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

  // Step 6: Resolve conflicts
  const resolvedSlots = resolveConflicts(filledSlots, groupConfig);

  // Step 7: Assemble and return the complete DaySchema
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

/**
 * Step 1: Determine what type of day this is.
 */
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

/**
 * Parse "HH:MM" string into a decimal hour number.
 * "09:30" → 9.5, "14:00" → 14, "23:45" → 23.75
 */
function parseHour(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours + (minutes || 0) / 60;
}
