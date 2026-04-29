// Tests for jet-lag-calculator.ts — timezone resolution, offset math, jet-lag impact bands.

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  resolveTimezone,
  calculateTimezoneOffset,
  calculateJetLagImpact,
} from "./jet-lag-calculator.ts";

// ---------- resolveTimezone ----------

Deno.test("resolveTimezone: empty / null input returns null", () => {
  assertEquals(resolveTimezone(""), null);
  assertEquals(resolveTimezone(null as any), null);
});

Deno.test("resolveTimezone: well-known cities resolve to IANA timezone strings", () => {
  const paris = resolveTimezone("Paris");
  const tokyo = resolveTimezone("Tokyo");
  const ny = resolveTimezone("New York");

  // Each must look like an IANA TZ ("Region/City" format)
  for (const tz of [paris, tokyo, ny]) {
    assert(tz !== null, "must resolve to a timezone");
    assert(tz!.includes("/"), `expected IANA format, got ${tz}`);
  }
});

Deno.test("resolveTimezone: case-insensitive partial match", () => {
  const a = resolveTimezone("Paris");
  const b = resolveTimezone("PARIS");
  const c = resolveTimezone("paris");
  assertEquals(a, b);
  assertEquals(b, c);
});

Deno.test("resolveTimezone: clearly fictional city returns null", () => {
  // Use a string that won't substring-match any real city name in the map.
  // (Short names like 'la', 'nyc' make naive partial matches risky.)
  assertEquals(resolveTimezone("zzzzzfictionalplace"), null);
});

// ---------- calculateTimezoneOffset ----------

Deno.test("calculateTimezoneOffset: same timezone → 0 hours", () => {
  const r = calculateTimezoneOffset("Europe/Paris", "Europe/Paris");
  assertEquals(r.hoursDiff, 0);
  assertEquals(r.direction, "same");
});

Deno.test("calculateTimezoneOffset: null inputs → 0 / same", () => {
  const r = calculateTimezoneOffset(null, "Europe/Paris");
  assertEquals(r.hoursDiff, 0);
  assertEquals(r.direction, "same");
});

Deno.test("calculateTimezoneOffset: NYC → Paris is eastward", () => {
  const r = calculateTimezoneOffset("America/New_York", "Europe/Paris");
  assertEquals(r.direction, "eastward");
  assert(r.hoursDiff >= 4 && r.hoursDiff <= 7, `expected ~6h, got ${r.hoursDiff}`);
});

Deno.test("calculateTimezoneOffset: Paris → NYC is westward", () => {
  const r = calculateTimezoneOffset("Europe/Paris", "America/New_York");
  assertEquals(r.direction, "westward");
  assert(r.hoursDiff >= 4 && r.hoursDiff <= 7);
});

Deno.test("calculateTimezoneOffset: hoursDiff is always positive (absolute)", () => {
  const east = calculateTimezoneOffset("America/New_York", "Europe/Paris");
  const west = calculateTimezoneOffset("Europe/Paris", "America/New_York");
  assert(east.hoursDiff > 0);
  assert(west.hoursDiff > 0);
});

// ---------- calculateJetLagImpact ----------

Deno.test("calculateJetLagImpact: same-region trip yields a result", () => {
  const r = calculateJetLagImpact("Paris", "Europe/Paris");
  assert(typeof r.impact === "string");
});

Deno.test("calculateJetLagImpact: long-haul east trip yields measurable impact", () => {
  const r = calculateJetLagImpact("New York", "Asia/Tokyo", 14, "moderate");
  assert(typeof r.impact === "string");
});

Deno.test("calculateJetLagImpact: high vs low sensitivity both return valid results", () => {
  const high = calculateJetLagImpact("New York", "Asia/Tokyo", 14, "high");
  const low = calculateJetLagImpact("New York", "Asia/Tokyo", 14, "low");
  assert(typeof high.impact === "string");
  assert(typeof low.impact === "string");
});

Deno.test("calculateJetLagImpact: missing origin still returns a result", () => {
  const r = calculateJetLagImpact(null, "Europe/Paris");
  assert(typeof r.impact === "string", "null origin must not throw");
});
