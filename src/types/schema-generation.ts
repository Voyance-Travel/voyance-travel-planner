// Schema-Driven Generation — Core Type Definitions
// Part of the isolated schema generation system (Fix 22A-E)
// This file has ZERO dependencies on existing generation code.

export interface DaySchema {
  dayNumber: number;
  dayType: DayType;
  patternGroup: PatternGroup;
  archetypeName: string;
  destination: string;
  date: string;
  slots: DaySlot[];
  constraints: DayConstraints;
  travelers: TravelerRef[];
}

export type DayType =
  | 'morning_arrival'
  | 'midday_arrival'
  | 'latenight_arrival'
  | 'standard'
  | 'departure'
  | 'transition';

export type PatternGroup = 'packed' | 'social' | 'balanced' | 'indulgent' | 'gentle';

export type MealWeight = 'fuel' | 'standard' | 'experience';

export type SlotType =
  | 'arrival'
  | 'departure'
  | 'transport'
  | 'hotel_checkin'
  | 'hotel_checkout'
  | 'meal'
  | 'activity'
  | 'evening'
  | 'must_do'
  | 'unscheduled';

export type SlotStatus = 'filled' | 'empty';

export type MealType = 'breakfast' | 'lunch' | 'dinner';

export type FilledSource =
  | 'flight_data'
  | 'hotel_data'
  | 'must_do'
  | 'user_preference'
  | 'system';

export interface DaySlot {
  slotId: string;
  slotType: SlotType;
  status: SlotStatus;
  required: boolean;
  position: number;
  timeWindow: SlotTimeWindow | null;
  mealType?: MealType;
  mealInstruction?: string;
  filledData?: SlotFilledData;
  aiInstruction?: string;
}

export interface SlotTimeWindow {
  earliest: string;
  latest: string;
  duration: {
    min: number;
    max: number;
  };
}

export interface SlotFilledData {
  title: string;
  category: string;
  startTime: string;
  endTime: string;
  location?: string;
  cost?: number;
  notes?: string;
  source: FilledSource;
}

export interface DayConstraints {
  dayStartTime: string;
  dayEndTime: string;
  maxActivitySlots: number;
  mealWeight: MealWeight;
  bufferMinutes: number;
  unscheduledBlocks: number;
  eveningSlots: number;
}

export interface TravelerRef {
  id: string;
  name: string;
}

export interface PatternGroupConfig {
  groupName: PatternGroup;
  displayName: string;
  activitySlots: { min: number; max: number };
  eveningSlots: { min: number; max: number };
  dayStartTime: string;
  dayEndTime: string;
  mealWeight: MealWeight;
  mealInstruction: string;
  bufferMinutes: number;
  unscheduledBlocks: number;
  hotelPriority: 'first' | 'deferred';
  breakfastRequired: boolean;
  mealDuration: { min: number; max: number };
  specialInstructions: string[];
}

export interface ArchetypeGroupMapping {
  archetypeName: string;
  patternGroup: PatternGroup;
}

export interface DayGenerationLog {
  tripId: string;
  dayNumber: number;
  dayType: DayType;
  patternGroup: PatternGroup;
  archetypeName: string;
  compiledSchema: DaySchema;
  aiResponse: unknown;
  validationResults: SlotValidation[];
  overrides: SlotOverride[];
  retries: number;
  timing: {
    compileMs: number;
    aiCallMs: number;
    validationMs: number;
    totalMs: number;
  };
}

export interface SlotValidation {
  slotId: string;
  slotType: SlotType;
  check: string;
  passed: boolean;
  severity: 'low' | 'medium' | 'high';
  message: string;
}

export interface SlotOverride {
  slotId: string;
  field: string;
  originalValue: unknown;
  correctedValue: unknown;
  reason: string;
}
