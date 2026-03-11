// ============================================================
// EDGE FUNCTION COPY — Source of truth is in src/
// This file is a copy of src/lib/schema-compiler/generation-logger.ts with import paths
// adjusted for the Deno edge function environment.
// If you modify this file, also update the src/ version.
// ============================================================

import type {
  DaySchema,
  DayGenerationLog,
  SlotValidation,
  SlotOverride,
} from './types.ts';

export function buildGenerationLog(params: {
  tripId: string;
  schema: DaySchema;
  aiResponse: unknown;
  validationResults: SlotValidation[];
  overrides: SlotOverride[];
  retries: number;
  timing: {
    compileMs: number;
    aiCallMs: number;
    validationMs: number;
  };
}): DayGenerationLog {
  return {
    tripId: params.tripId,
    dayNumber: params.schema.dayNumber,
    dayType: params.schema.dayType,
    patternGroup: params.schema.patternGroup,
    archetypeName: params.schema.archetypeName,
    compiledSchema: params.schema,
    aiResponse: params.aiResponse,
    validationResults: params.validationResults,
    overrides: params.overrides,
    retries: params.retries,
    timing: {
      ...params.timing,
      totalMs: params.timing.compileMs + params.timing.aiCallMs + params.timing.validationMs,
    },
  };
}

export function formatLogForConsole(log: DayGenerationLog): string {
  const lines: string[] = [];

  lines.push(`\n========== SCHEMA GENERATION LOG ==========`);
  lines.push(`Trip: ${log.tripId}`);
  lines.push(`Day ${log.dayNumber} (${log.dayType}) — ${log.patternGroup} / ${log.archetypeName}`);
  lines.push(`Schema: ${log.compiledSchema.slots.length} slots`);
  lines.push(`Retries: ${log.retries}`);
  lines.push(`Timing: compile=${log.timing.compileMs}ms, ai=${log.timing.aiCallMs}ms, validate=${log.timing.validationMs}ms, total=${log.timing.totalMs}ms`);

  const failed = log.validationResults.filter(v => !v.passed);
  if (failed.length === 0) {
    lines.push(`Validation: ALL PASSED (${log.validationResults.length} checks)`);
  } else {
    lines.push(`Validation: ${failed.length} FAILED of ${log.validationResults.length} checks`);
    for (const f of failed) {
      lines.push(`  [${f.severity.toUpperCase()}] ${f.check}: ${f.message}`);
    }
  }

  if (log.overrides.length > 0) {
    lines.push(`Overrides: ${log.overrides.length} auto-corrections`);
    for (const o of log.overrides) {
      lines.push(`  ${o.slotId}.${o.field}: ${o.originalValue} → ${o.correctedValue} (${o.reason})`);
    }
  }

  lines.push(`============================================\n`);

  return lines.join('\n');
}
