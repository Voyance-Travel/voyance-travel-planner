/**
 * Durable trip-level generation trace (ring buffer in `trips.metadata.generation_trace`).
 *
 * Edge function `console.log` output is unreliable for diagnosing post-mortem
 * failures (waitUntil tasks can be dropped, log shipping can be lossy, the
 * function id can rotate). This writes every interesting boundary directly to
 * the trip row so we can always answer "what happened to this paid trip?"
 * from the DB alone.
 *
 * Keep entries SMALL — no full payloads, no AI text, no errors >300 chars.
 */

export const TRACE_BUFFER_CAP = 80;

export type TracePhase =
  | 'launcher_received'
  | 'launcher_metadata_init'
  | 'launcher_background_started'
  | 'launcher_background_failed'
  | 'day_started'
  | 'day_ai_done'
  | 'day_validated'
  | 'day_persisted_tables'
  | 'day_persisted_json'
  | 'day_chain_dispatched'
  | 'day_chain_failed'
  | 'day_failed'
  | 'persist_gate_checked'
  | 'persist_gate_blocked'
  | 'persist_regression_blocked'
  | 'persist_frozen_blocked'
  | 'persist_written'
  | 'chain_finalized'
  | 'recovery_promoted'
  | 'recovery_backfilled';

export type TraceStatus = 'ok' | 'warn' | 'fail';

export interface TraceEvent {
  at: string;                     // ISO timestamp
  action: string;                 // e.g. 'generate-trip', 'generate-trip-day', 'save-itinerary'
  phase: TracePhase;
  status: TraceStatus;
  dayNumber?: number;
  durationMs?: number;
  expectedTotalDays?: number;
  jsonDayCount?: number;
  tableDayCount?: number;
  activityCount?: number;
  errorCode?: string;
  errorMessage?: string;          // truncated to 300 chars
  extra?: Record<string, string | number | boolean | null>;
}

function trim(msg: unknown, max = 300): string | undefined {
  if (msg == null) return undefined;
  const s = typeof msg === 'string' ? msg : (() => {
    try { return JSON.stringify(msg); } catch { return String(msg); }
  })();
  return s.length > max ? s.slice(0, max) + '…' : s;
}

/**
 * Append a single trace event to `trips.metadata.generation_trace`.
 * Best-effort: never throws, never blocks generation.
 *
 * Also emits a single-line console sentinel `[GENTRACE]` so concurrent log
 * shipping picks it up. The console line is the redundant copy; the DB row
 * is the source of truth.
 */
export async function appendGenerationTrace(
  supabase: any,
  tripId: string,
  partial: Omit<TraceEvent, 'at'> & { errorMessage?: unknown },
): Promise<void> {
  const event: TraceEvent = {
    at: new Date().toISOString(),
    ...partial,
    errorMessage: trim(partial.errorMessage),
  };

  // Console copy — single line, greppable.
  try {
    // eslint-disable-next-line no-console
    console.log(
      `[GENTRACE] trip=${tripId} action=${event.action} phase=${event.phase} ` +
      `status=${event.status}` +
      (event.dayNumber != null ? ` day=${event.dayNumber}` : '') +
      (event.durationMs != null ? ` ms=${event.durationMs}` : '') +
      (event.errorCode ? ` code=${event.errorCode}` : '') +
      (event.errorMessage ? ` err="${event.errorMessage.replace(/"/g, '\'')}"` : '')
    );
  } catch { /* never let logging crash generation */ }

  try {
    const { data, error: readErr } = await supabase
      .from('trips')
      .select('metadata')
      .eq('id', tripId)
      .maybeSingle();
    if (readErr) return;
    const meta = ((data?.metadata as Record<string, unknown>) || {}) as Record<string, any>;
    const prior = Array.isArray(meta.generation_trace) ? (meta.generation_trace as TraceEvent[]) : [];
    const next = [...prior, event].slice(-TRACE_BUFFER_CAP);
    await supabase
      .from('trips')
      .update({ metadata: { ...meta, generation_trace: next } })
      .eq('id', tripId);
  } catch {
    /* swallow — never let trace writes break the chain */
  }
}

/**
 * Compact summary snapshot — write once at terminal states.
 * Stored at `trips.metadata.generation_health`.
 */
export interface GenerationHealthSnapshot {
  finalStatus: string;
  expectedTotalDays: number;
  jsonDays: number;
  jsonRealDays: number;
  tableDays: number;
  tableRealDays: number;
  activityRows: number;
  failedDayNumbers: number[];
  persistGateCodes: string[];
  lastGoodPhase?: TracePhase;
  at: string;
}

export async function writeGenerationHealth(
  supabase: any,
  tripId: string,
  snapshot: Omit<GenerationHealthSnapshot, 'at'>,
): Promise<void> {
  try {
    const { data } = await supabase
      .from('trips')
      .select('metadata')
      .eq('id', tripId)
      .maybeSingle();
    const meta = ((data?.metadata as Record<string, unknown>) || {}) as Record<string, any>;
    await supabase
      .from('trips')
      .update({
        metadata: {
          ...meta,
          generation_health: { ...snapshot, at: new Date().toISOString() },
        },
      })
      .eq('id', tripId);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[GENTRACE] writeGenerationHealth failed:', err);
  }
}
