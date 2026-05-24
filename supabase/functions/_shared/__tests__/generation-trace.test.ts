import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { appendGenerationTrace, TRACE_BUFFER_CAP } from "../generation-trace.ts";

function makeFakeSupabase(initialMeta: Record<string, unknown> = {}) {
  const state: { metadata: Record<string, unknown> } = { metadata: initialMeta };
  const supabase = {
    from(_table: string) {
      return {
        select(_cols: string) {
          return {
            eq(_col: string, _val: string) {
              return {
                async maybeSingle() {
                  return { data: { metadata: state.metadata }, error: null };
                },
                async single() {
                  return { data: { metadata: state.metadata }, error: null };
                },
              };
            },
          };
        },
        update(patch: Record<string, unknown>) {
          return {
            async eq(_col: string, _val: string) {
              Object.assign(state, patch);
              return { error: null };
            },
          };
        },
      };
    },
    _state: state,
  };
  return supabase;
}

Deno.test("appendGenerationTrace appends events to metadata.generation_trace", async () => {
  const supabase = makeFakeSupabase();
  await appendGenerationTrace(supabase as any, "trip-1", {
    action: "generate-trip",
    phase: "launcher_received",
    status: "ok",
    expectedTotalDays: 4,
  });
  const trace = (supabase._state.metadata as any).generation_trace;
  assertEquals(Array.isArray(trace), true);
  assertEquals(trace.length, 1);
  assertEquals(trace[0].phase, "launcher_received");
  assertEquals(trace[0].action, "generate-trip");
  assertEquals(trace[0].status, "ok");
  assertEquals(typeof trace[0].at, "string");
});

Deno.test("appendGenerationTrace caps the ring buffer", async () => {
  const seeded = new Array(TRACE_BUFFER_CAP).fill(0).map((_, i) => ({
    at: new Date(i).toISOString(),
    action: "noop",
    phase: "day_started",
    status: "ok",
    dayNumber: i,
  }));
  const supabase = makeFakeSupabase({ generation_trace: seeded });
  await appendGenerationTrace(supabase as any, "trip-1", {
    action: "generate-trip-day",
    phase: "day_persisted_json",
    status: "ok",
    dayNumber: 999,
  });
  const trace = (supabase._state.metadata as any).generation_trace;
  assertEquals(trace.length, TRACE_BUFFER_CAP);
  assertEquals(trace[trace.length - 1].dayNumber, 999);
  // Oldest entry dropped
  assertEquals(trace[0].dayNumber, 1);
});

Deno.test("appendGenerationTrace truncates long errorMessage", async () => {
  const supabase = makeFakeSupabase();
  await appendGenerationTrace(supabase as any, "trip-1", {
    action: "save-itinerary",
    phase: "persist_gate_blocked",
    status: "fail",
    errorMessage: "x".repeat(1000),
  });
  const trace = (supabase._state.metadata as any).generation_trace;
  assertEquals(trace[0].errorMessage.length <= 301, true);
  assertEquals(trace[0].errorMessage.endsWith("…"), true);
});

Deno.test("appendGenerationTrace never throws on read failure", async () => {
  const supabase = {
    from() {
      return {
        select() { return { eq() { return { async maybeSingle() { throw new Error("boom"); } }; } }; },
        update() { return { async eq() { return { error: null }; } }; },
      };
    },
  };
  // Must not throw
  await appendGenerationTrace(supabase as any, "trip-1", {
    action: "generate-trip",
    phase: "launcher_received",
    status: "ok",
  });
});
