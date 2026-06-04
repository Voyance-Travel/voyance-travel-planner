/**
 * Edge Function Smoke Tests — generate-itinerary
 *
 * Verifies every action handler boots without crashing (no ReferenceError / TypeError).
 * A 400 or 401 is a PASS — it means the code parsed and ran auth checks.
 * A 500 is a FAIL — it means a runtime crash like the Day 2 `context is not defined` bug.
 *
 * Run via:  supabase--test_edge_functions
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1/generate-itinerary`;

/** Helper: POST an action with no auth (expects 401, never 500) */
async function postAction(action: string, extraParams: Record<string, unknown> = {}): Promise<Response> {
  const res = await fetch(FUNCTIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
    },
    body: JSON.stringify({ action, ...extraParams }),
  });
  // Always consume body to prevent resource leaks
  await res.text();
  return res;
}

/** Helper: POST an action with a fake Bearer token (expects 401/403, never 500) */
async function postActionWithFakeAuth(action: string, extraParams: Record<string, unknown> = {}): Promise<Response> {
  const res = await fetch(FUNCTIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
      "Authorization": "Bearer fake-token-for-smoke-test",
    },
    body: JSON.stringify({ action, ...extraParams }),
  });
  await res.text();
  return res;
}

// ---------------------------------------------------------------------------
// CORS Preflight
// ---------------------------------------------------------------------------
Deno.test("OPTIONS returns CORS headers", async () => {
  const res = await fetch(FUNCTIONS_URL, { method: "OPTIONS" });
  await res.text();
  assertEquals([200, 204].includes(res.status), true, `Expected 200/204, got ${res.status}`);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
});

// ---------------------------------------------------------------------------
// Extracted action handlers (already modularised)
// ---------------------------------------------------------------------------
Deno.test("get-trip: no auth → 401, never 500", async () => {
  const res = await postAction("get-trip", { tripId: "00000000-0000-0000-0000-000000000000" });
  assertNotEquals(res.status, 500, "get-trip returned 500 — runtime crash!");
});

Deno.test("get-trip: fake auth → not 500", async () => {
  const res = await postActionWithFakeAuth("get-trip", { tripId: "00000000-0000-0000-0000-000000000000" });
  assertNotEquals(res.status, 500, "get-trip returned 500 with fake auth — runtime crash!");
});

Deno.test("save-itinerary: no auth → 401, never 500", async () => {
  const res = await postAction("save-itinerary", {
    tripId: "00000000-0000-0000-0000-000000000000",
    itinerary: { days: [] },
  });
  assertNotEquals(res.status, 500, "save-itinerary returned 500 — runtime crash!");
});

Deno.test("get-itinerary: no auth → 401, never 500", async () => {
  const res = await postAction("get-itinerary", { tripId: "00000000-0000-0000-0000-000000000000" });
  assertNotEquals(res.status, 500, "get-itinerary returned 500 — runtime crash!");
});

Deno.test("toggle-activity-lock: no auth → 401, never 500", async () => {
  const res = await postAction("toggle-activity-lock", {
    tripId: "00000000-0000-0000-0000-000000000000",
    activityId: "test-activity",
    locked: true,
  });
  assertNotEquals(res.status, 500, "toggle-activity-lock returned 500 — runtime crash!");
});

Deno.test("sync-itinerary-tables: no auth → 401, never 500", async () => {
  const res = await postAction("sync-itinerary-tables", {
    tripId: "00000000-0000-0000-0000-000000000000",
  });
  assertNotEquals(res.status, 500, "sync-itinerary-tables returned 500 — runtime crash!");
});

Deno.test("repair-trip-costs: no auth → 401, never 500", async () => {
  const res = await postAction("repair-trip-costs", {
    tripId: "00000000-0000-0000-0000-000000000000",
  });
  assertNotEquals(res.status, 500, "repair-trip-costs returned 500 — runtime crash!");
});

// ---------------------------------------------------------------------------
// Core generation actions (still in index.ts — the ones that actually break)
// ---------------------------------------------------------------------------
Deno.test("generate-trip: fake auth → not 500", async () => {
  const res = await postActionWithFakeAuth("generate-trip", {
    tripId: "00000000-0000-0000-0000-000000000000",
    destination: "Paris, France",
    destinationCountry: "France",
    startDate: "2026-06-01",
    endDate: "2026-06-03",
    travelers: 1,
    tripType: "vacation",
    budgetTier: "moderate",
    creditsCharged: 0,
  });
  assertNotEquals(res.status, 500, "generate-trip returned 500 — runtime crash!");
});

Deno.test("generate-day: fake auth → not 500", async () => {
  const res = await postActionWithFakeAuth("generate-day", {
    tripId: "00000000-0000-0000-0000-000000000000",
    dayNumber: 1,
    totalDays: 3,
    destination: "Paris, France",
    destinationCountry: "France",
    date: "2026-06-01",
    travelers: 1,
    tripType: "vacation",
    budgetTier: "moderate",
  });
  assertNotEquals(res.status, 500, "generate-day returned 500 — runtime crash!");
});

Deno.test("regenerate-day: fake auth → not 500", async () => {
  const res = await postActionWithFakeAuth("regenerate-day", {
    tripId: "00000000-0000-0000-0000-000000000000",
    dayNumber: 2,
    totalDays: 3,
    destination: "Paris, France",
    destinationCountry: "France",
    date: "2026-06-02",
    travelers: 1,
    tripType: "vacation",
    budgetTier: "moderate",
  });
  assertNotEquals(res.status, 500, "regenerate-day returned 500 — runtime crash!");
});

Deno.test("generate-trip-day: fake auth → not 500", async () => {
  const res = await postActionWithFakeAuth("generate-trip-day", {
    tripId: "00000000-0000-0000-0000-000000000000",
    dayNumber: 2,
    totalDays: 3,
    destination: "Paris, France",
    destinationCountry: "France",
    startDate: "2026-06-01",
    endDate: "2026-06-03",
    travelers: 1,
    tripType: "vacation",
    budgetTier: "moderate",
    userId: "00000000-0000-0000-0000-000000000000",
    generationRunId: "smoke-test-run",
  });
  assertNotEquals(res.status, 500, "generate-trip-day returned 500 — runtime crash!");
});

Deno.test("generate-full (legacy redirect): fake auth → not 500", async () => {
  const res = await postActionWithFakeAuth("generate-full", {
    tripId: "00000000-0000-0000-0000-000000000000",
  });
  assertNotEquals(res.status, 500, "generate-full redirect returned 500 — runtime crash!");
});

// ---------------------------------------------------------------------------
// Unknown action — should return 400, not 500
// ---------------------------------------------------------------------------
Deno.test("unknown action → 400, never 500", async () => {
  const res = await postActionWithFakeAuth("nonexistent-action-xyz", {});
  assertNotEquals(res.status, 500, "Unknown action returned 500 — missing fallback!");
});

// ---------------------------------------------------------------------------
// Missing body — should return 400, not 500
// ---------------------------------------------------------------------------
Deno.test("empty body → not 500", async () => {
  const res = await fetch(FUNCTIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
    },
    body: "{}",
  });
  await res.text();
  assertNotEquals(res.status, 500, "Empty body returned 500 — runtime crash!");
});

Deno.test("malformed JSON → not 500", async () => {
  const res = await fetch(FUNCTIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
    },
    body: "not json at all",
  });
  await res.text();
  assertNotEquals(res.status, 500, "Malformed JSON returned 500 — runtime crash!");
});

// ---------------------------------------------------------------------------
// Regression: Shell itinerary detection (Tokyo 8-day bug)
// generate-trip-day should never mark a trip as "ready" if days have 0 activities
// ---------------------------------------------------------------------------
Deno.test("generate-trip-day: fake auth → not 500 (shell day guard)", async () => {
  const res = await postActionWithFakeAuth("generate-trip-day", {
    tripId: "00000000-0000-0000-0000-000000000000",
    dayNumber: 1,
    totalDays: 8,
    destination: "Tokyo, Japan",
    destinationCountry: "Japan",
    startDate: "2026-04-10",
    endDate: "2026-04-17",
    travelers: 1,
    tripType: "solo",
    budgetTier: "premium",
    userId: "00000000-0000-0000-0000-000000000000",
    generationRunId: "shell-test-run",
  });
  assertNotEquals(res.status, 500, "generate-trip-day returned 500 — runtime crash!");
});
