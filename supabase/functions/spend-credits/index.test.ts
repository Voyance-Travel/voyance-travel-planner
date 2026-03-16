/**
 * Edge Function Smoke Tests — spend-credits
 *
 * Verifies the credit spending endpoint boots without crashing.
 * A 400 or 401 is a PASS — it means the code parsed and ran auth checks.
 * A 500 is a FAIL — it means a runtime crash.
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertNotEquals, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1/spend-credits`;

async function post(body: Record<string, unknown>, extraHeaders: Record<string, string> = {}): Promise<Response> {
  const res = await fetch(FUNCTIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  await res.text();
  return res;
}

// CORS
Deno.test("OPTIONS returns CORS headers", async () => {
  const res = await fetch(FUNCTIONS_URL, { method: "OPTIONS" });
  await res.text();
  assertEquals([200, 204].includes(res.status), true);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
});

// No auth → should not 500
Deno.test("no auth → not 500", async () => {
  const res = await post({ action: "check-balance" });
  assertNotEquals(res.status, 500, "spend-credits returned 500 without auth — runtime crash!");
});

// Fake auth → should not 500
Deno.test("fake auth → not 500", async () => {
  const res = await post(
    { action: "check-balance" },
    { Authorization: "Bearer fake-token-for-smoke-test" },
  );
  assertNotEquals(res.status, 500, "spend-credits returned 500 with fake auth — runtime crash!");
});

// Spend action with fake auth → should not 500
Deno.test("spend action with fake auth → not 500", async () => {
  const res = await post(
    {
      action: "spend",
      cost: 10,
      tripId: "00000000-0000-0000-0000-000000000000",
      actionType: "generate_trip",
      idempotencyKey: "smoke-test-key",
    },
    { Authorization: "Bearer fake-token-for-smoke-test" },
  );
  assertNotEquals(res.status, 500, "spend-credits spend action returned 500 — runtime crash!");
});

// Empty body → should not 500
Deno.test("empty body → not 500", async () => {
  const res = await post({});
  assertNotEquals(res.status, 500, "spend-credits empty body returned 500 — runtime crash!");
});

// Malformed JSON → should not 500
Deno.test("malformed JSON → not 500", async () => {
  const res = await fetch(FUNCTIONS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: "not json",
  });
  await res.text();
  assertNotEquals(res.status, 500, "spend-credits malformed JSON returned 500 — runtime crash!");
});
