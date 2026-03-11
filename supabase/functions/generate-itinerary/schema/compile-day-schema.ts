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
  if (input.dayNumber === input.totalDays && input.departureFlight) {
    return 'departure';
  }
  if (input.dayNumber === 1 && input.arrivalFlight) {
    const arrivalHour = parseHour(input.arrivalFlight.arrivalTime);
    if (arrivalHour < 11) return 'morning_arrival';
    if (arrivalHour < 16) return 'midday_arrival';
    return 'latenight_arrival';
  }
  return 'standard';
}

function parseHour(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours + (minutes || 0) / 60;
}
