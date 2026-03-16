/**
 * Edge Function Smoke Tests — get-entitlements
 *
 * Verifies the entitlements/credit balance endpoint boots without crashing.
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertNotEquals, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1/get-entitlements`;

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

Deno.test("OPTIONS returns CORS headers", async () => {
  const res = await fetch(FUNCTIONS_URL, { method: "OPTIONS" });
  await res.text();
  assertEquals([200, 204].includes(res.status), true);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
});

Deno.test("no auth → not 500", async () => {
  const res = await post({});
  assertNotEquals(res.status, 500, "get-entitlements returned 500 without auth — runtime crash!");
});

Deno.test("fake auth → not 500", async () => {
  const res = await post({}, { Authorization: "Bearer fake-token-for-smoke-test" });
  assertNotEquals(res.status, 500, "get-entitlements returned 500 with fake auth — runtime crash!");
});

Deno.test("empty body → not 500", async () => {
  const res = await post({});
  assertNotEquals(res.status, 500, "get-entitlements empty body returned 500 — runtime crash!");
});
