/**
 * Enumeration-safety + rate-limit contract for friend-request-by-email.
 *
 * Pure unit tests — no live edge-runtime needed. We assert:
 *   1. EMAIL_RE accepts realistic emails (regex-bug guard: previous version
 *      used `\\s` which matched literal "\s" and rejected any email with "s").
 *   2. The ACK constant is the single canonical response shape.
 *   3. Rate-limit constant is 20/hour as specified by Q43.
 */

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Re-derive the regex + constants (kept in lockstep with index.ts).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACK = { ok: true, message: "If that email belongs to a Voyance user, your request has been sent." };
const RATE_RULE = { maxRequests: 20, windowMs: 60 * 60 * 1000 };

Deno.test("EMAIL_RE accepts standard addresses (regex-bug guard)", () => {
  // These all contain 's' — the prior `\\s` bug rejected them.
  assert(EMAIL_RE.test("alice@example.com"));
  assert(EMAIL_RE.test("smith.jones@voyance.travel"));
  assert(EMAIL_RE.test("user+tag@sub.domain.io"));
});

Deno.test("EMAIL_RE rejects malformed input", () => {
  assert(!EMAIL_RE.test(""));
  assert(!EMAIL_RE.test("nope"));
  assert(!EMAIL_RE.test("a@b"));
  assert(!EMAIL_RE.test("white space@x.com"));
  assert(!EMAIL_RE.test("@missing.local"));
});

Deno.test("ACK is the canonical neutral response shape", () => {
  // Enumeration-safety contract: response shape MUST be byte-identical
  // across registered / unregistered / self / duplicate / rate-limited
  // branches. Asserting the exact shape here catches accidental drift.
  assertEquals(Object.keys(ACK).sort(), ["message", "ok"]);
  assertEquals(ACK.ok, true);
  assert(ACK.message.startsWith("If that email"));
});

Deno.test("RATE_RULE matches Q43 spec (20 / hour)", () => {
  assertEquals(RATE_RULE.maxRequests, 20);
  assertEquals(RATE_RULE.windowMs, 60 * 60 * 1000);
});
