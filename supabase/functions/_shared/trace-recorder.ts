// Trip Generation Flight Recorder
// Single API used across edge functions to persist a structured, queryable
// trace of every trip generation attempt. Pure capture — no behavior change.
//
// Usage:
//   const trace = await startTrace({ tripId, userId, triggerSource, snapshot, profile });
//   await trace.stage('compile-prompt', { dayNumber: 2 }, async () => { ... });
//   await trace.llm({ dayNumber, purpose, model, prompt, response, latencyMs });
//   trace.mutation({ dayNumber, activityId, field, before, after, stage, reason });
//   await trace.finalize({ status: 'ok', matchVerdict });
//
// All writes are best-effort and never throw — instrumentation must never
// break generation.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type AnyJson = unknown;

export interface StartTraceArgs {
  tripId: string;
  userId: string;
  triggerSource?: string;
  attemptNumber?: number;
  userRequestSnapshot?: AnyJson;
  resolvedProfile?: AnyJson;
}

export interface StageArgs {
  dayNumber?: number;
  inputs?: AnyJson;
  outputs?: AnyJson;
  notes?: string[];
  status?: "ok" | "warn" | "error" | "skipped";
}

export interface LlmArgs {
  dayNumber?: number;
  purpose?: string;
  model?: string;
  temperature?: number;
  prompt?: string;
  response?: string;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs?: number;
  finishReason?: string;
  retryCount?: number;
  error?: string;
}

export interface MutationArgs {
  dayNumber?: number;
  activityId?: string;
  activityTitle?: string;
  field: string;
  before?: AnyJson;
  after?: AnyJson;
  stage?: string;
  reason?: string;
}

export interface FinalizeArgs {
  status: string;
  matchVerdict?: AnyJson;
}

const MAX_TEXT = 200_000;   // ~200KB hard cap per LLM call text field
const MAX_JSON = 64_000;    // hard cap on stage inputs/outputs serialized

function truncate(s: string | undefined, max: number): string | undefined {
  if (!s) return s;
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n…[truncated ${s.length - max} chars]`;
}

function clampJson(v: AnyJson): AnyJson {
  if (v == null) return v;
  try {
    const serialized = JSON.stringify(v);
    if (serialized.length <= MAX_JSON) return v;
    return { __truncated: true, preview: serialized.slice(0, MAX_JSON) };
  } catch {
    return { __unserializable: true };
  }
}

class NoopTrace {
  id = "noop";
  enabled = false;
  async stage<T>(_name: string, _args: StageArgs, fn: () => Promise<T> | T): Promise<T> {
    return await fn();
  }
  async llm(_args: LlmArgs): Promise<void> { /* noop */ }
  mutation(_args: MutationArgs): void { /* noop */ }
  async finalize(_args: FinalizeArgs): Promise<void> { /* noop */ }
}

class TraceRecorder {
  id: string;
  enabled = true;
  private client: ReturnType<typeof createClient>;
  private stageOrder = 0;
  private mutationBuffer: MutationArgs[] = [];
  private startedAt: number;

  constructor(id: string, client: ReturnType<typeof createClient>) {
    this.id = id;
    this.client = client;
    this.startedAt = Date.now();
  }

  async stage<T>(name: string, args: StageArgs, fn: () => Promise<T> | T): Promise<T> {
    const order = ++this.stageOrder;
    const t0 = Date.now();
    let status: string = args.status ?? "ok";
    let error: string | undefined;
    let result: T;
    try {
      result = await fn();
    } catch (e) {
      status = "error";
      error = e instanceof Error ? e.message : String(e);
      this.writeStage(name, order, t0, status, args, error).catch(() => {});
      throw e;
    }
    this.writeStage(name, order, t0, status, args, error).catch(() => {});
    return result;
  }

  private async writeStage(
    name: string,
    order: number,
    t0: number,
    status: string,
    args: StageArgs,
    error?: string,
  ): Promise<void> {
    try {
      const dur = Date.now() - t0;
      await this.client.from("trip_generation_stages").insert({
        trace_id: this.id,
        day_number: args.dayNumber ?? null,
        stage_name: name,
        order_index: order,
        started_at: new Date(t0).toISOString(),
        ended_at: new Date().toISOString(),
        duration_ms: dur,
        status,
        inputs: args.inputs != null ? clampJson(args.inputs) : null,
        outputs: args.outputs != null ? clampJson(args.outputs) : null,
        notes: args.notes && args.notes.length ? args.notes : null,
        error: error ?? null,
      });
    } catch (e) {
      console.warn("[trace-recorder] stage write failed", (e as Error).message);
    }
  }

  async llm(args: LlmArgs): Promise<void> {
    try {
      await this.client.from("trip_generation_llm_calls").insert({
        trace_id: this.id,
        day_number: args.dayNumber ?? null,
        call_purpose: args.purpose ?? null,
        model: args.model ?? null,
        temperature: args.temperature ?? null,
        prompt_text: truncate(args.prompt, MAX_TEXT) ?? null,
        response_text: truncate(args.response, MAX_TEXT) ?? null,
        prompt_tokens: args.promptTokens ?? null,
        completion_tokens: args.completionTokens ?? null,
        latency_ms: args.latencyMs ?? null,
        finish_reason: args.finishReason ?? null,
        retry_count: args.retryCount ?? 0,
        error: args.error ?? null,
      });
    } catch (e) {
      console.warn("[trace-recorder] llm write failed", (e as Error).message);
    }
  }

  mutation(args: MutationArgs): void {
    this.mutationBuffer.push(args);
    if (this.mutationBuffer.length >= 50) {
      this.flushMutations().catch(() => {});
    }
  }

  private async flushMutations(): Promise<void> {
    if (this.mutationBuffer.length === 0) return;
    const batch = this.mutationBuffer.splice(0, this.mutationBuffer.length);
    try {
      await this.client.from("trip_generation_mutations").insert(
        batch.map((m) => ({
          trace_id: this.id,
          day_number: m.dayNumber ?? null,
          activity_external_id: m.activityId ?? null,
          activity_title: m.activityTitle ?? null,
          field: m.field,
          before_value: m.before != null ? clampJson(m.before) : null,
          after_value: m.after != null ? clampJson(m.after) : null,
          stage: m.stage ?? null,
          reason: m.reason ?? null,
        })),
      );
    } catch (e) {
      console.warn("[trace-recorder] mutation batch write failed", (e as Error).message);
    }
  }

  async finalize(args: FinalizeArgs): Promise<void> {
    try {
      await this.flushMutations();
      const endedAt = new Date();
      await this.client.from("trip_generation_traces").update({
        ended_at: endedAt.toISOString(),
        total_duration_ms: Date.now() - this.startedAt,
        final_status: args.status,
        match_verdict: args.matchVerdict ?? null,
      }).eq("id", this.id);
    } catch (e) {
      console.warn("[trace-recorder] finalize failed", (e as Error).message);
    }
  }
}

export type Trace = TraceRecorder | NoopTrace;

let warnedNoCreds = false;

export async function startTrace(args: StartTraceArgs): Promise<Trace> {
  // Opt-out for ops emergencies
  if (Deno.env.get("TRACE_RECORDER_DISABLED") === "1") return new NoopTrace();

  const url = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    if (!warnedNoCreds) {
      warnedNoCreds = true;
      console.warn("[trace-recorder] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — traces disabled");
    }
    return new NoopTrace();
  }
  try {
    const client = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await client
      .from("trip_generation_traces")
      .insert({
        trip_id: args.tripId,
        user_id: args.userId,
        trigger_source: args.triggerSource ?? null,
        attempt_number: args.attemptNumber ?? 1,
        user_request_snapshot: args.userRequestSnapshot != null ? clampJson(args.userRequestSnapshot) : null,
        resolved_profile: args.resolvedProfile != null ? clampJson(args.resolvedProfile) : null,
      })
      .select("id")
      .single();
    if (error || !data?.id) {
      console.warn("[trace-recorder] startTrace insert failed", error?.message);
      return new NoopTrace();
    }
    console.log(`[TRACE_STARTED] trace=${data.id} trip=${args.tripId} source=${args.triggerSource ?? "unknown"}`);
    return new TraceRecorder(data.id as string, client);
  } catch (e) {
    console.warn("[trace-recorder] startTrace threw", (e as Error).message);
    return new NoopTrace();
  }
}

export function noopTrace(): Trace {
  return new NoopTrace();
}
