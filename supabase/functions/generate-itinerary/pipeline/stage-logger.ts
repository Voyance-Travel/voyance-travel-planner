/**
 * Stage Logger — Persists pipeline artifacts for each day into trip metadata.
 *
 * Phase 0: Created but not wired into the generation pipeline yet.
 * Will be called from action-generate-trip-day.ts in Phase 2+.
 *
 * Artifacts are stored under trip.metadata.pipeline_logs[dayN] so every
 * generation defect is traceable to exactly one pipeline stage.
 */

import type { StageArtifacts, ValidationResult, RepairAction, StageTiming } from './types.ts';

// =============================================================================
// STAGE LOGGER CLASS
// =============================================================================

export class StageLogger {
  private tripId: string;
  private dayNumber: number;
  private supabase: any;
  private artifacts: StageArtifacts = {};
  private startTime: number;

  constructor(supabase: any, tripId: string, dayNumber: number) {
    this.supabase = supabase;
    this.tripId = tripId;
    this.dayNumber = dayNumber;
    this.startTime = Date.now();
    this.artifacts.timing = {};
  }

  // ── Stage recorders ──

  logFacts(dayFacts: StageArtifacts['dayFacts'], durationMs: number): void {
    this.artifacts.dayFacts = dayFacts;
    if (this.artifacts.timing) this.artifacts.timing.compileFacts_ms = durationMs;
  }

  logSchema(daySchema: StageArtifacts['daySchema'], durationMs: number): void {
    this.artifacts.daySchema = daySchema;
    if (this.artifacts.timing) this.artifacts.timing.compileSchema_ms = durationMs;
  }

  logPrompt(promptSummary: string): void {
    // Store a truncated summary, not the full prompt (save space)
    this.artifacts.promptSummary = promptSummary.length > 2000
      ? promptSummary.slice(0, 2000) + '…[truncated]'
      : promptSummary;
  }

  logAIResponse(rawResponse: unknown, durationMs: number): void {
    // Store a truncated version of the raw response
    const serialized = typeof rawResponse === 'string'
      ? rawResponse
      : JSON.stringify(rawResponse);
    this.artifacts.rawAIResponse = serialized.length > 5000
      ? serialized.slice(0, 5000) + '…[truncated]'
      : rawResponse;
    if (this.artifacts.timing) this.artifacts.timing.aiCall_ms = durationMs;
  }

  logValidation(results: ValidationResult[], durationMs: number): void {
    this.artifacts.validationResults = results;
    if (this.artifacts.timing) this.artifacts.timing.validation_ms = durationMs;
  }

  logRepairs(repairs: RepairAction[], durationMs: number): void {
    this.artifacts.repairsApplied = repairs;
    if (this.artifacts.timing) this.artifacts.timing.repair_ms = durationMs;
  }

  // ── Persistence ──

  /**
   * Flush all collected artifacts to trip.metadata.pipeline_logs.
   * Uses a JSON merge so we don't clobber other metadata fields.
   */
  async flush(): Promise<void> {
    if (this.artifacts.timing) {
      this.artifacts.timing.total_ms = Date.now() - this.startTime;
    }

    const logKey = `day_${this.dayNumber}`;

    try {
      // Read current metadata
      const { data: trip } = await this.supabase
        .from('trips')
        .select('metadata')
        .eq('id', this.tripId)
        .single();

      const metadata = trip?.metadata || {};
      const pipelineLogs = metadata.pipeline_logs || {};
      pipelineLogs[logKey] = {
        ...this.artifacts,
        logged_at: new Date().toISOString(),
      };

      await this.supabase
        .from('trips')
        .update({
          metadata: { ...metadata, pipeline_logs: pipelineLogs },
        })
        .eq('id', this.tripId);

      console.log(`[StageLogger] Flushed artifacts for trip=${this.tripId} day=${this.dayNumber} (${this.artifacts.timing?.total_ms}ms total)`);
    } catch (err) {
      // Non-fatal: logging should never break generation
      console.error(`[StageLogger] Failed to flush artifacts for day ${this.dayNumber}:`, err);
    }
  }

  // ── Convenience: summary for console ──

  getSummary(): string {
    const v = this.artifacts.validationResults || [];
    const r = this.artifacts.repairsApplied || [];
    const errors = v.filter(x => x.severity === 'error' || x.severity === 'critical').length;
    const warnings = v.filter(x => x.severity === 'warning').length;
    return `Day ${this.dayNumber}: ${v.length} checks (${errors} errors, ${warnings} warnings), ${r.length} repairs`;
  }
}
