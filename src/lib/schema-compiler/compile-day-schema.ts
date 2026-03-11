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
import { resolveConflicts } from './conflict-resolver';

/**
 * Input data needed to compile a day schema.
 * This is gathered from the trip record and user profiles
 * BEFORE the compiler runs.
 */
export interface CompilerInput {
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

  // Step 5: Fill known constraints (flights, hotel)
  // Note: Must-do pre-filling is basic here — full logic is in Fix 22E
  const filledSlots = fillFlightAndHotelSlots(modifiedSlots, input);

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
  // Last day with a departure flight = departure day
  if (input.dayNumber === input.totalDays && input.departureFlight) {
    return 'departure';
  }

  // First day with an arrival flight = arrival day (subtype based on time)
  if (input.dayNumber === 1 && input.arrivalFlight) {
    const arrivalHour = parseHour(input.arrivalFlight.arrivalTime);
    if (arrivalHour < 11) return 'morning_arrival';
    if (arrivalHour < 16) return 'midday_arrival';
    return 'latenight_arrival';
  }

  // Everything else = standard day
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
