// Tests for geographic-coherence.ts — distance, transit estimation, geohash, zone assignment.

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  haversineDistance,
  estimateTravelMinutes,
  generateGeohash,
  assignToZone,
  getCuratedZones,
} from "./geographic-coherence.ts";

// ---------- haversineDistance ----------

Deno.test("haversineDistance: identical points → 0", () => {
  assertEquals(haversineDistance(48.85, 2.35, 48.85, 2.35), 0);
});

Deno.test("haversineDistance: Paris ↔ London ~344km", () => {
  // Paris (48.8566, 2.3522) → London (51.5074, -0.1278)
  const d = haversineDistance(48.8566, 2.3522, 51.5074, -0.1278);
  // expected ~343-345 km in meters
  assert(d > 340_000 && d < 350_000, `expected ~344km, got ${d}m`);
});

Deno.test("haversineDistance: short hop (~1km in Paris)", () => {
  // Louvre to Tuileries — about 500m
  const d = haversineDistance(48.8606, 2.3376, 48.8635, 2.3275);
  assert(d > 400 && d < 1500, `expected sub-kilometer, got ${d}m`);
});

// ---------- estimateTravelMinutes ----------

Deno.test("estimateTravelMinutes: walk mode at 5km/h", () => {
  // 1000m walk at 83.33m/min = ~12 min
  const m = estimateTravelMinutes(1000, "walk");
  assertEquals(m, 12);
});

Deno.test("estimateTravelMinutes: short transit (<1km) uses walking pace", () => {
  // <1km transit treated as walking
  const m = estimateTravelMinutes(500, "transit");
  // 500/83.33 ≈ 6 min
  assert(m >= 5 && m <= 7);
});

Deno.test("estimateTravelMinutes: long transit adds 5min wait + 20km/h", () => {
  // 5km transit: 5min wait + 5000/333.33 ≈ 5+15 = 20min
  const m = estimateTravelMinutes(5000, "transit");
  assert(m >= 18 && m <= 22, `expected ~20min, got ${m}`);
});

// ---------- generateGeohash ----------

Deno.test("generateGeohash: Paris coords yields stable hash", () => {
  const h = generateGeohash(48.8566, 2.3522);
  assertEquals(typeof h, "string");
  assert(h.length > 0);
  // Repeated call yields same hash for same input
  const h2 = generateGeohash(48.8566, 2.3522);
  assertEquals(h, h2);
});

Deno.test("generateGeohash: distinct cities yield different hashes", () => {
  const paris = generateGeohash(48.8566, 2.3522);
  const tokyo = generateGeohash(35.6762, 139.6503);
  assertEquals(paris === tokyo, false);
});

Deno.test("generateGeohash: nearby Paris points share a prefix", () => {
  // Two points within ~1km in Paris should share at least the first few chars
  const a = generateGeohash(48.8566, 2.3522);
  const b = generateGeohash(48.8606, 2.3376);
  // Shared prefix of >=3 chars at default precision
  let shared = 0;
  while (shared < a.length && shared < b.length && a[shared] === b[shared]) shared++;
  assert(shared >= 3, `expected >=3 shared geohash chars, got ${shared} (a=${a} b=${b})`);
});

// ---------- assignToZone (with synthetic zones) ----------

Deno.test("assignToZone: matches by neighborhood name first", () => {
  const zones = [
    {
      id: "marais",
      name: "Le Marais",
      center: { lat: 48.857, lng: 2.359 },
      radiusMeters: 1500,
      neighborhoods: ["marais", "le marais"],
    },
    {
      id: "montmartre",
      name: "Montmartre",
      center: { lat: 48.886, lng: 2.343 },
      radiusMeters: 1500,
      neighborhoods: ["montmartre"],
    },
  ];
  const id = assignToZone(
    { neighborhood: "Le Marais" } as any,
    zones as any,
  );
  assertEquals(id, "marais");
});

Deno.test("assignToZone: falls back to nearest zone by coords", () => {
  const zones = [
    {
      id: "near",
      name: "Near",
      center: { lat: 48.860, lng: 2.337 },
      radiusMeters: 500,
      neighborhoods: [],
    },
    {
      id: "far",
      name: "Far",
      center: { lat: 35.676, lng: 139.650 },
      radiusMeters: 500,
      neighborhoods: [],
    },
  ];
  // Activity at Paris coords, no neighborhood → must pick "near"
  const id = assignToZone(
    { coordinates: { lat: 48.861, lng: 2.336 } } as any,
    zones as any,
  );
  assertEquals(id, "near");
});

Deno.test("assignToZone: returns null if neither neighborhood nor coordinates given", () => {
  const id = assignToZone({} as any, [] as any);
  assertEquals(id, null);
});

// ---------- getCuratedZones ----------

Deno.test("getCuratedZones: unknown destination returns null", () => {
  assertEquals(getCuratedZones("Atlantis"), null);
});

Deno.test("getCuratedZones: strips country suffix when matching", () => {
  // "Paris, France" should normalize to "paris" (function uses .replace(/,.*$/, ''))
  // We accept either an array (if Paris is curated) or null (if not).
  const a = getCuratedZones("Paris, France");
  const b = getCuratedZones("Paris");
  assertEquals(a, b, "country suffix must not affect the lookup");
});
