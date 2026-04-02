/**
 * GenerationTimer — Lightweight performance instrumentation for itinerary generation.
 * 
 * Tracks phase-level timing, per-day breakdowns, and errors.
 * Persists to the generation_logs table for real-time progress polling and admin diagnostics.
 * 
 * CRITICAL: All operations are wrapped in try/catch. Logging failures must NEVER break generation.
 */

export class GenerationTimer {
  private tripId: string;
  private logId: string | null = null;
  private initFailed: boolean = false;
  private startTime: number;
  private phases: Record<string, number> = {};
  private dayTimings: Array<{ day: number; total_ms: number; ai_ms: number; enrich_ms: number; activities: number; categories?: Record<string, number> }> = [];
  private errors: Array<{ phase: string; error: string; timestamp: string }> = [];
  private currentPhase: string = 'init';
  private phaseStart: number;
  private supabaseClient: any;
  private destination: string = '';
  private numDays: number = 0;
  private numGuests: number = 0;
  private totalPromptTokens: number = 0;
  private totalCompletionTokens: number = 0;
  private modelsUsed: Set<string> = new Set();

  constructor(tripId: string, supabaseClient: any) {
    this.tripId = tripId;
    this.supabaseClient = supabaseClient;
    this.startTime = Date.now();
    this.phaseStart = this.startTime;
  }

  /** Create the initial log row. Call once at generation start. */
  async init(destination: string, numDays: number, numGuests: number): Promise<string | null> {
    this.destination = destination;
    this.numDays = numDays;
    this.numGuests = numGuests;

    try {
      const { data, error } = await this.supabaseClient
        .from('generation_logs')
        .insert({
          trip_id: this.tripId,
          status: 'started',
          current_phase: 'init',
          progress_pct: 0,
          num_days: numDays,
          num_guests: numGuests,
          destination: destination,
        })
        .select('id')
        .single();

      if (data) {
        this.logId = data.id;
        console.log(`[perf-logger] Log row created: ${data.id}`);
      }
      if (error) {
        this.initFailed = true;
        console.error('[perf-logger] Failed to create log row:', JSON.stringify({
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        }));
      }
    } catch (e) {
      this.initFailed = true;
      console.error('[perf-logger] Init failed (exception):', e);
    }
    return this.logId;
  }

  /** Reconstruct timer from an existing logId (for chained calls). */
  async resume(logId: string, destination: string, numDays: number, numGuests: number) {
    this.logId = logId;
    this.destination = destination;
    this.numDays = numDays;
    this.numGuests = numGuests;

    try {
      const { data } = await this.supabaseClient
        .from('generation_logs')
        .select('phase_timings, day_timings, errors')
        .eq('id', logId)
        .single();

      if (data) {
        this.phases = (data.phase_timings as Record<string, number>) || {};
        this.dayTimings = (data.day_timings as any[]) || [];
        this.errors = (data.errors as any[]) || [];
      }
    } catch (e) {
      console.warn('[perf-logger] Resume failed (non-blocking):', e);
    }
  }

  /** Start a new named phase. Closes the previous phase automatically. */
  startPhase(name: string) {
    try {
      if (this.currentPhase && this.currentPhase !== 'init') {
        this.phases[this.currentPhase] = Date.now() - this.phaseStart;
      }
      this.currentPhase = name;
      this.phaseStart = Date.now();
      console.log(`[perf] ▶ ${name}`);
    } catch (e) {
      // Never break generation
    }
  }

  /** Close the current phase and record its duration. */
  endPhase(name?: string) {
    try {
      const phaseName = name || this.currentPhase;
      if (phaseName) {
        this.phases[phaseName] = Date.now() - this.phaseStart;
        console.log(`[perf] ✓ ${phaseName}: ${this.phases[phaseName]}ms`);
      }
    } catch (e) {
      // Never break generation
    }
  }

  /** Record per-day timing breakdown with optional category counts, meals, transport, validation, and LLM diagnostics. */
  addDayTiming(
    day: number, totalMs: number, aiMs: number, enrichMs: number, activityCount: number,
    categories?: Record<string, number>,
    meals?: { required: string[]; found: string[]; guardFired: boolean; injected?: string[] },
    transport?: { isTransitionDay: boolean; mode?: string | null; hadInterCityTravel?: boolean; fallbackInjected?: boolean },
    validation?: { totalChecks?: number; errors?: number; warnings?: number; repairsApplied?: number },
    llm?: { model: string; promptTokens: number; completionTokens: number },
  ) {
    try {
      const entry: any = { day, total_ms: totalMs, ai_ms: aiMs, enrich_ms: enrichMs, activities: activityCount };
      if (categories && Object.keys(categories).length > 0) {
        entry.categories = categories;
      }
      if (meals) entry.meals = meals;
      if (transport) entry.transport = transport;
      if (validation) entry.validation = validation;
      if (llm) entry.llm = llm;
      // Upsert by day number to prevent duplicate entries when timer is resumed
      const existingIdx = this.dayTimings.findIndex(d => d.day === day);
      if (existingIdx >= 0) {
        this.dayTimings[existingIdx] = entry;
        console.log(`[perf-logger] Replaced existing timing for day ${day}`);
      } else {
        this.dayTimings.push(entry);
      }
    } catch (e) {
      // Never break generation
    }
  }

  /** Accumulate token usage from an AI response. */
  addTokenUsage(promptTokens: number, completionTokens: number, model?: string) {
    try {
      this.totalPromptTokens += promptTokens || 0;
      this.totalCompletionTokens += completionTokens || 0;
      if (model) this.modelsUsed.add(model);
    } catch (e) {
      // Never break generation
    }
  }

  /** Record an error that occurred during a phase. */
  addError(phase: string, error: string) {
    try {
      this.errors.push({ phase, error, timestamp: new Date().toISOString() });
      console.error(`[perf] ✗ Error in ${phase}: ${error}`);
    } catch (e) {
      // Never break generation
    }
  }

  /** Update progress in DB for real-time UI polling. Fire-and-forget. */
  async updateProgress(phase: string, pct: number) {
    if (!this.logId) return;
    try {
      await this.supabaseClient
        .from('generation_logs')
        .update({
          current_phase: phase,
          progress_pct: Math.min(100, Math.max(0, pct)),
          status: 'in_progress',
          phase_timings: this.phases,
          day_timings: this.dayTimings,
          errors: this.errors,
        })
        .eq('id', this.logId);
    } catch (e) {
      // Don't let logging failures break generation
    }
  }

  /** Finalize and save all timing data. Call in both success and error paths. */
  async finalize(status: 'completed' | 'failed' = 'completed') {
    try {
      // Close any open phase
      if (this.currentPhase && this.currentPhase !== 'init') {
        this.phases[this.currentPhase] = Date.now() - this.phaseStart;
      }

      const totalMs = Date.now() - this.startTime;

      console.log(`\n[perf] ========== GENERATION ${status.toUpperCase()} ==========`);
      console.log(`[perf] Total: ${(totalMs / 1000).toFixed(1)}s (${this.destination}, ${this.numDays} days)`);
      console.log(`[perf] Phase breakdown:`);
      for (const [phase, ms] of Object.entries(this.phases)) {
        const pct = totalMs > 0 ? ((ms / totalMs) * 100).toFixed(1) : '0';
        console.log(`[perf]   ${phase}: ${(ms / 1000).toFixed(1)}s (${pct}%)`);
      }
      if (this.dayTimings.length > 0) {
        console.log(`[perf] Per-day breakdown:`);
        for (const d of this.dayTimings) {
          const catStr = (d as any).categories ? ` | ${JSON.stringify((d as any).categories)}` : '';
          const modelStr = (d as any).llm?.model ? ` | model=${(d as any).llm.model}` : '';
          console.log(`[perf]   Day ${d.day}: ${(d.total_ms / 1000).toFixed(1)}s total, AI ${(d.ai_ms / 1000).toFixed(1)}s, enrich ${(d.enrich_ms / 1000).toFixed(1)}s, ${d.activities} activities${catStr}${modelStr}`);
        }
      }
      if (this.totalPromptTokens > 0 || this.totalCompletionTokens > 0) {
        console.log(`[perf] Tokens: ${this.totalPromptTokens} prompt + ${this.totalCompletionTokens} completion = ${this.totalPromptTokens + this.totalCompletionTokens} total`);
        console.log(`[perf] Models used: ${Array.from(this.modelsUsed).join(', ') || 'unknown'}`);
      }
      if (this.errors.length > 0) {
        console.log(`[perf] Errors: ${this.errors.length}`);
        for (const e of this.errors) {
          console.log(`[perf]   ${e.phase}: ${e.error}`);
        }
      }

      const finalPayload = {
        status,
        total_duration_ms: totalMs,
        phase_timings: this.phases,
        day_timings: this.dayTimings,
        errors: this.errors,
        current_phase: status === 'completed' ? 'done' : 'failed',
        progress_pct: status === 'completed' ? 100 : Math.round((this.dayTimings.length / Math.max(1, this.numDays)) * 100),
        model_used: Array.from(this.modelsUsed).join(', ') || null,
        prompt_token_count: this.totalPromptTokens || null,
        completion_token_count: this.totalCompletionTokens || null,
      };

      if (this.logId) {
        await this.supabaseClient
          .from('generation_logs')
          .update(finalPayload)
          .eq('id', this.logId);
      } else if (this.initFailed) {
        // Fallback: init failed earlier, try inserting a summary row now
        console.warn('[perf-logger] init failed earlier — attempting fallback insert in finalize()');
        const { error: fallbackErr } = await this.supabaseClient
          .from('generation_logs')
          .insert({
            trip_id: this.tripId,
            destination: this.destination,
            num_days: this.numDays,
            num_guests: this.numGuests,
            ...finalPayload,
          });
        if (fallbackErr) {
          console.error('[perf-logger] Fallback insert also failed:', JSON.stringify({
            message: fallbackErr.message,
            code: fallbackErr.code,
            details: fallbackErr.details,
            hint: fallbackErr.hint,
          }));
        } else {
          console.log('[perf-logger] Fallback insert succeeded');
        }
      }
    } catch (e) {
      console.error('[perf-logger] Failed to save final log:', e);
    }
  }

  /** Get the current logId for passing to chained calls. */
  getLogId(): string | null {
    return this.logId;
  }
}
