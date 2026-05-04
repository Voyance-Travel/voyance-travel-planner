/**
 * Pipeline Types — Foundation for the deterministic generation pipeline.
 *
 * Phase 0: These types are defined but NOT consumed by any generation code yet.
 * They will be wired in during Phase 2 (compilers) and Phase 3 (validators).
 *
 * Design principle: hard rules live in code (via these types), creativity lives
 * in the AI prompt. The AI fills slots; it does not invent structure.
 */

// =============================================================================
// FAILURE CODES — Typed taxonomy for every known generation defect
// =============================================================================

export const FAILURE_CODES = {
  // Structural
  PHANTOM_HOTEL:      'PHANTOM_HOTEL',
  LOGISTICS_SEQUENCE: 'LOGISTICS_SEQUENCE',
  CHRONOLOGY:         'CHRONOLOGY',
  TIME_OVERLAP:       'TIME_OVERLAP',
  MISSING_SLOT:       'MISSING_SLOT',

  // Meals
  MEAL_ORDER:         'MEAL_ORDER',
  MEAL_MISSING:       'MEAL_MISSING',
  MEAL_DUPLICATE:     'MEAL_DUPLICATE',

  // Venue quality
  GENERIC_VENUE:      'GENERIC_VENUE',
  CHAIN_RESTAURANT:   'CHAIN_RESTAURANT',
  DUPLICATE_CONCEPT:  'DUPLICATE_CONCEPT',
  FABRICATED_HOTEL:   'FABRICATED_HOTEL',

  // Text quality
  TITLE_LABEL_LEAK:   'TITLE_LABEL_LEAK',
  CJK_ARTIFACT:       'CJK_ARTIFACT',
  SCHEMA_LEAK:        'SCHEMA_LEAK',
  BOOKING_URGENCY:    'BOOKING_URGENCY',

  // Budget
  BUDGET_EXCEEDED:    'BUDGET_EXCEEDED',

  // Personalization
  WEAK_PERSONALIZATION: 'WEAK_PERSONALIZATION',
  MISSING_MUST_DO:      'MISSING_MUST_DO',
} as const;

export type FailureCode = typeof FAILURE_CODES[keyof typeof FAILURE_CODES];

// =============================================================================
// VALIDATION RESULT — Structured output from validate-day
// =============================================================================

export type ValidationSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ValidationResult {
  code: FailureCode;
  severity: ValidationSeverity;
  message: string;
  /** Index of the offending activity, if applicable */
  activityIndex?: number;
  /** The field on the activity that failed, if applicable */
  field?: string;
  /** Whether a deterministic repair can fix this */
  autoRepairable: boolean;
}

// =============================================================================
// DAY FACTS — Deterministic truth compiled from trip data (Phase 2)
// =============================================================================

export type DayMode =
  | 'full_exploration'
  | 'late_arrival'
  | 'midday_arrival'
  | 'morning_arrival'
  | 'early_departure'
  | 'midday_departure'
  | 'afternoon_departure'
  | 'late_departure'
  | 'transition_day'
  | 'full_day_event'
  | 'constrained_half_day';

export type RequiredMealType = 'breakfast' | 'lunch' | 'dinner';

export interface DayFacts {
  tripId: string;
  dayNumber: number;
  totalDays: number;
  date: string;
  destination: string;
  destinationCountry?: string;

  // Day classification
  dayMode: DayMode;
  isFirstDay: boolean;
  isLastDay: boolean;
  isTransitionDay: boolean;

  // Time boundaries
  earliestStart: string;   // HH:MM — earliest usable time
  latestEnd: string;       // HH:MM — latest usable time
  usableHours: number;

  // Flight truth
  hasArrivalFlight: boolean;
  arrivalTime24?: string;
  arrivalAirport?: string;
  hasDepartureFlight: boolean;
  departureTime24?: string;
  departureAirport?: string;

  // Hotel truth
  hasHotel: boolean;
  hotelName?: string;
  hotelAddress?: string;
  hotelNeighborhood?: string;
  hotelCheckIn?: string;
  hotelCheckOut?: string;
  isHotelChange?: boolean;
  previousHotelName?: string;

  // Meals
  requiredMeals: RequiredMealType[];
  mealInstructionText: string;

  // Must-dos and pre-booked
  mustDoActivities: string[];
  preBookedSlots: PreBookedSlot[];

  // Budget
  dailyBudgetPerPerson?: number;
  budgetTier?: string;
  currency: string;

  // Multi-city
  cityName?: string;
  isFirstDayInCity?: boolean;
  isLastDayInCity?: boolean;
  nextCityName?: string;
}

export interface PreBookedSlot {
  title: string;
  startTime?: string;
  endTime?: string;
  category?: string;
  isLocked: boolean;
}

// =============================================================================
// LOCKED ACTIVITY — Activities the user has locked in place
// =============================================================================

export interface LockedActivity {
  id: string;
  title: string;
  name?: string;
  description?: string;
  category?: string;
  startTime: string;
  endTime: string;
  durationMinutes?: number;
  location?: { name?: string; address?: string };
  cost?: { amount: number; currency: string };
  isLocked: boolean;
  tags?: string[];
  bookingRequired?: boolean;
  tips?: string;
  photos?: unknown;
  transportation?: unknown;
  [key: string]: unknown;
}

// =============================================================================
// COMPILED FACTS — Return type of compileDayFacts()
// =============================================================================

export interface CompiledFacts {
  // Transition context
  resolvedIsTransitionDay: boolean;
  resolvedTransitionFrom: string;
  resolvedTransitionTo: string;
  resolvedTransportMode: string;
  resolvedTransportDetails: any;
  resolvedNextLegTransport: string;
  resolvedNextLegCity: string;
  resolvedNextLegTransportDetails: any;
  resolvedHotelOverride: any;
  resolvedIsMultiCity: boolean;
  resolvedIsLastDayInCity: boolean;
  resolvedDestination: string;
  resolvedCountry: string;

  // Locked activities
  lockedActivities: LockedActivity[];
  lockedSlotsInstruction: string;

  // Flight/hotel (with overrides applied)
  flightContext: any;
  isFirstDay: boolean;
  isLastDay: boolean;

  // Split-stay: hotel changed from previous day within same city
  resolvedIsHotelChange: boolean;
  resolvedPreviousHotelName: string | undefined;
  resolvedPreviousHotelAddress: string | undefined;

  // Transport preferences
  transportPreferencePrompt: string;
  resolvedTransportModes: string[];
  resolvedPrimaryTransport: string | undefined;
  resolvedHasRentalCar: boolean;

  // Pre-resolved for schema compiler (avoids DB calls in pure function)
  arrivalAirportDisplay: string;
  airportTransferMinutes: number;
}

// =============================================================================
// COMPILED SCHEMA — Return type of compileDaySchema()
// =============================================================================

export interface CompiledSchema {
  dayConstraints: string;
  /** Possibly modified flightContext (e.g. stripped return flight for non-flight departures) */
  flightContext: any;
}

export interface DaySchemaInput {
  isFirstDay: boolean;
  isLastDay: boolean;
  dayNumber: number;
  totalDays: number;
  destination: string;
  flightContext: any;
  resolvedIsLastDayInCity: boolean;
  resolvedIsMultiCity: boolean;
  resolvedNextLegTransport: string;
  resolvedNextLegCity: string;
  resolvedNextLegTransportDetails: any;
  resolvedHotelOverride: any;
  resolvedIsTransitionDay: boolean;
  paramIsFirstDayInCity: boolean;
  paramIsTransitionDay: boolean;
  mustDoEventItems: any[];
  arrivalAirportDisplay: string;
  airportTransferMinutes: number;
  /** Archetype tier (Curator, Achiever, Explorer, Connector, Restorer). Optional — used for Grand Entrance gating. */
  archetypeTier?: string;
  /** Specific archetype identity (e.g. "The Luxury Luminary"). Optional — used for Grand Entrance gating. */
  archetypeIdentity?: string;
}

// =============================================================================
// DAY SCHEMA — Slot-based structure the AI must fill (Phase 2)
// =============================================================================

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
  | 'pre_booked'
  | 'unscheduled';

export type SlotStatus = 'locked' | 'ai_fillable' | 'optional';

export interface DaySchema {
  dayNumber: number;
  date: string;
  destination: string;
  dayMode: DayMode;

  // Time boundaries
  earliestStart: string;
  latestEnd: string;

  // Ordered slots for the AI to fill
  slots: DaySlot[];

  // Constraints the AI must respect
  constraints: DayConstraints;
}

export interface DaySlot {
  slotId: string;
  slotType: SlotType;
  status: SlotStatus;
  position: number;

  // Time window (null = AI decides within day bounds)
  timeWindow: SlotTimeWindow | null;

  // Meal-specific
  mealType?: RequiredMealType;

  // Pre-filled data (for locked slots)
  filledData?: SlotFilledData;

  // Instruction to AI for this slot
  aiInstruction?: string;
}

export interface SlotTimeWindow {
  earliest: string;  // HH:MM
  latest: string;    // HH:MM
  durationMin: number; // minutes
  durationMax: number; // minutes
}

export interface SlotFilledData {
  title: string;
  category: string;
  startTime: string;
  endTime: string;
  location?: string;
  notes?: string;
  source: 'flight_data' | 'hotel_data' | 'must_do' | 'user_preference' | 'pre_booked';
}

export interface DayConstraints {
  maxActivitySlots: number;
  bufferMinutes: number;
  mealWeight: 'fuel' | 'standard' | 'experience';
  /** Activities from prior days to avoid duplicating */
  priorDayTitles: string[];
  /** Budget ceiling for the day (per person, USD) */
  budgetCeiling?: number;
}

// =============================================================================
// STAGE ARTIFACTS — What gets logged at each pipeline stage
// =============================================================================

export interface StageArtifacts {
  /** Compiled facts from trip data */
  dayFacts?: DayFacts;
  /** Compiled schema sent to AI */
  daySchema?: DaySchema;
  /** The prompt payload sent to the AI (or a hash/summary) */
  promptSummary?: string;
  /** Raw AI response (truncated if large) */
  rawAIResponse?: unknown;
  /** Validation results */
  validationResults?: ValidationResult[];
  /** Which repairs were applied */
  repairsApplied?: RepairAction[];
  /** Timing for each stage */
  timing?: StageTiming;
}

export interface RepairAction {
  code: FailureCode;
  activityIndex?: number;
  action: string;         // e.g. "reassigned_meal_time", "stripped_phantom_hotel"
  before?: unknown;
  after?: unknown;
}

export interface StageTiming {
  compileFacts_ms?: number;
  compileSchema_ms?: number;
  aiCall_ms?: number;
  validation_ms?: number;
  repair_ms?: number;
  total_ms?: number;
}
