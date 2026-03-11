// src/lib/schema-compiler/index.ts
// Public API for the Schema Compiler.
// Import from '@/lib/schema-compiler' to use.

export { compileDaySchema } from './compile-day-schema';
export type { CompilerInput } from './compile-day-schema';
export { serializeSchemaToPrompt } from './schema-to-prompt';
export type { SerializedPrompt, SerializerContext } from './schema-to-prompt';
export { validateAgainstSchema } from './schema-validator';
export type { ValidationResult, AiActivity } from './schema-validator';
export { buildGenerationLog, formatLogForConsole } from './generation-logger';
export {
  normalizeTimeText,
  extractTimeRange,
  cleanActivityTitle,
  parseToHHMM,
} from './time-parser';
export { fillMustDoSlots } from './must-do-filler';
export type { MustDoInput } from './must-do-filler';
export { fillPreBookedSlots } from './prebooked-filler';
export type { PreBookedInput } from './prebooked-filler';
export { applyPacingOverride } from './pacing-override';
export type { PacingLevel } from './pacing-override';
