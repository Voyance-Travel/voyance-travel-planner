// ============================================================
// EDGE FUNCTION COPY — Source of truth is in src/
// Re-exports all schema compiler modules for the edge function.
// ============================================================

export { compileDaySchema } from './compile-day-schema.ts';
export type { CompilerInput } from './compile-day-schema.ts';
export { serializeSchemaToPrompt } from './schema-to-prompt.ts';
export type { SerializedPrompt, SerializerContext } from './schema-to-prompt.ts';
export { validateAgainstSchema } from './schema-validator.ts';
export type { ValidationResult, AiActivity } from './schema-validator.ts';
export { buildGenerationLog, formatLogForConsole } from './generation-logger.ts';
export { normalizeTimeText, extractTimeRange, cleanActivityTitle, parseToHHMM } from './time-parser.ts';
export { fillMustDoSlots } from './must-do-filler.ts';
export type { MustDoInput } from './must-do-filler.ts';
export { fillPreBookedSlots } from './prebooked-filler.ts';
export type { PreBookedInput } from './prebooked-filler.ts';
export { USE_SCHEMA_GENERATION, SCHEMA_GENERATION_CONFIG } from './feature-flags.ts';
export { getPatternGroupConfig } from './pattern-group-configs.ts';
export { getPatternGroupForArchetype } from './archetype-group-mapping.ts';
export { applyPacingOverride } from './pacing-override.ts';
export type { PacingLevel } from './pacing-override.ts';
export { fillKeptActivities } from './keep-activities-filler.ts';
export type { KeptActivity } from './keep-activities-filler.ts';
export { detectAndFillGaps } from './gap-filler.ts';
export type { GapFillerConfig, DetectedGap } from './gap-filler.ts';
export { validateDepartureTimeline, buildDepartureConstraints } from './departure-validator.ts';
export type { DepartureConstraints } from './departure-validator.ts';

export type {
  DaySchema,
  DaySlot,
  DayType,
  PatternGroup,
  MealWeight,
  SlotType,
  SlotStatus,
  PatternGroupConfig,
  DayConstraints,
  TravelerRef,
  DayGenerationLog,
  SlotValidation,
  SlotOverride,
} from './types.ts';
