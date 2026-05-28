// Schema-Driven Generation — Shared Type Definitions (Backend Mirror)
// Source of truth: src/types/schema-generation.ts (Fix 22A-E).
// Backend cannot import from `src/`, so this file mirrors the public types
// and is kept in sync by convention. Do not add backend-only fields here.
//
// Naming: backend already has a different `DaySchema` in
// `generate-itinerary/pipeline/types.ts` (returns prompt text). To avoid
// collision, the assembly-line types here are prefixed `Skeleton…`.

export type DayType =
  | 'morning_arrival'
  | 'midday_arrival'
  | 'latenight_arrival'
  | 'standard'
  | 'departure';

export type PatternGroup = 'packed' | 'social' | 'balanced' | 'indulgent' | 'gentle';

export type MealWeight = 'fuel' | 'standard' | 'experience';

export type SkeletonSlotType =
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

export type SkeletonSlotStatus = 'filled' | 'empty';

export type MealType = 'breakfast' | 'lunch' | 'dinner';

export type FilledSource =
  | 'flight_data'
  | 'hotel_data'
  | 'must_do'
  | 'user_preference'
  | 'system';

export interface SkeletonTimeWindow {
  earliest: string; // HH:MM
  latest: string;   // HH:MM
  duration: { min: number; max: number }; // minutes
}

export interface SkeletonFilledData {
  title: string;
  category: string;
  startTime: string;
  endTime: string;
  location?: string;
  cost?: number;
  notes?: string;
  source: FilledSource;
}

export interface SkeletonSlot {
  slotId: string;
  slotType: SkeletonSlotType;
  status: SkeletonSlotStatus;
  required: boolean;
  position: number;
  timeWindow: SkeletonTimeWindow | null;
  mealType?: MealType;
  mealInstruction?: string;
  filledData?: SkeletonFilledData;
  /** Instruction for the Filler LLM when this slot is empty. */
  aiInstruction?: string;
  /** Identifier for a must-do this slot has been pre-allocated to. */
  mustDoRef?: string;
}

export interface SkeletonDayConstraints {
  dayStartTime: string;
  dayEndTime: string;
  maxActivitySlots: number;
  mealWeight: MealWeight;
  bufferMinutes: number;
  unscheduledBlocks: number;
  eveningSlots: number;
}

export interface SkeletonDay {
  dayNumber: number;
  dayType: DayType;
  patternGroup: PatternGroup;
  archetypeName: string;
  destination: string;
  date: string;
  slots: SkeletonSlot[];
  constraints: SkeletonDayConstraints;
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

/** Reason a must-do could not be allocated to a slot. */
export type OmittedReason =
  | 'not_enough_time'
  | 'wrong_day_type'
  | 'no_compatible_slot'
  | 'duplicate';

export interface OmittedMustDo {
  title: string;
  reason: OmittedReason;
  detail?: string;
}
