// Locks the launcher self-duplicate bypass contract.
//
// The outer launcher in handleGenerateTrip stamps itinerary_status='generating'
// + a fresh heartbeat + a generation_run_id, then kicks off
// handleGenerateTripBackground via EdgeRuntime.waitUntil. Without the run-id
// match below, the background's own duplicate guard sees the fresh stamp and
// short-circuits, leaving the trip stuck on "Crafting Day 1".
//
// We don't import handleGenerateTripBackground here (it pulls a huge module
// graph requiring live env). Instead we replicate the exact guard predicate
// and assert behavior in three scenarios.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

type GuardOutcome = "bypass" | "skip" | "restart_stale" | "proceed";

function evaluateDuplicateGuard(opts: {
  status: string | null;
  heartbeatISO: string | null;
  metaRunId: string | null;
  ourRunId: string | null;
  isBackgroundLaunch: boolean;
  nowMs: number;
}): GuardOutcome {
  if (opts.status !== "generating") return "proceed";
  const heartbeat = opts.heartbeatISO ? new Date(opts.heartbeatISO).getTime() : null;
  const isStale = !heartbeat || (opts.nowMs - heartbeat > 5 * 60 * 1000);
  const isOwn = opts.isBackgroundLaunch && !!opts.ourRunId && opts.metaRunId === opts.ourRunId;
  if (isOwn) return "bypass";
  if (!isStale) return "skip";
  return "restart_stale";
}

Deno.test("background continuation with matching runId bypasses guard", () => {
  const runId = crypto.randomUUID();
  const out = evaluateDuplicateGuard({
    status: "generating",
    heartbeatISO: new Date().toISOString(),
    metaRunId: runId,
    ourRunId: runId,
    isBackgroundLaunch: true,
    nowMs: Date.now(),
  });
  assertEquals(out, "bypass");
});

Deno.test("foreign second click with fresh heartbeat is still skipped", () => {
  const out = evaluateDuplicateGuard({
    status: "generating",
    heartbeatISO: new Date().toISOString(),
    metaRunId: crypto.randomUUID(),
    ourRunId: crypto.randomUUID(),
    isBackgroundLaunch: false,
    nowMs: Date.now(),
  });
  assertEquals(out, "skip");
});

Deno.test("background launch with mismatched runId is still skipped (foreign tab)", () => {
  const out = evaluateDuplicateGuard({
    status: "generating",
    heartbeatISO: new Date().toISOString(),
    metaRunId: crypto.randomUUID(),
    ourRunId: crypto.randomUUID(),
    isBackgroundLaunch: true,
    nowMs: Date.now(),
  });
  assertEquals(out, "skip");
});

Deno.test("stale heartbeat (>5min) restarts even for foreign run", () => {
  const out = evaluateDuplicateGuard({
    status: "generating",
    heartbeatISO: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    metaRunId: crypto.randomUUID(),
    ourRunId: crypto.randomUUID(),
    isBackgroundLaunch: false,
    nowMs: Date.now(),
  });
  assertEquals(out, "restart_stale");
});

Deno.test("non-generating status always proceeds", () => {
  const out = evaluateDuplicateGuard({
    status: "not_started",
    heartbeatISO: null,
    metaRunId: null,
    ourRunId: null,
    isBackgroundLaunch: true,
    nowMs: Date.now(),
  });
  assertEquals(out, "proceed");
});
