// Tests for geographic-coherence.ts — distance, transit estimation, geohash, zone assignment.

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  haversineDistance,
  estimateTravelMinutes,
  generateGeohash,
  assignToZone,
  getCuratedZones,
  reorderDayByProximity,
  retimeAndComputeLegTimes,
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

// ---------- reorderDayByProximity + retimeAndComputeLegTimes ----------
// Reproduces the reported Barcelona trip 6e087c7f Day 2 zig-zag and verifies the
// fix: flexible stops cluster by proximity, meals stay in their time slots,
// locked activities never move, and every leg gets a consistent travel time.

const BCN = {
  granjaViader: { lat: 41.3829, lng: 2.1697 },   // El Raval (breakfast)
  bodega1900: { lat: 41.3795, lng: 2.1610 },      // Sant Antoni (lunch)
  gracia: { lat: 41.4036, lng: 2.1564 },          // Gràcia — far NORTH outlier
  slowSpa: { lat: 41.3920, lng: 2.1640 },         // Eixample (wellness)
  quimet: { lat: 41.3741, lng: 2.1640 },          // Poble Sec — far SOUTH (dinner)
  laConfiteria: { lat: 41.3766, lng: 2.1670 },    // Sant Antoni (cocktail bar)
  hotel: { lat: 41.3900, lng: 2.1650 },           // Eixample anchor
};

function makeBarcelonaDay2(): any[] {
  return [
    { id: "a1", title: "Breakfast at Granja Viader", category: "dining", startTime: "09:00", endTime: "10:00", durationMinutes: 60, location: { name: "Granja Viader", coordinates: BCN.granjaViader }, transportation: { method: "walking", duration: "" } },
    { id: "a2", title: "Lunch at Bodega 1900", category: "dining", startTime: "13:00", endTime: "14:30", durationMinutes: 90, location: { name: "Bodega 1900", coordinates: BCN.bodega1900 }, transportation: { method: "walking", duration: "15m" } },
    { id: "a3", title: "Explore Gràcia District", category: "sightseeing", startTime: "15:00", endTime: "16:30", durationMinutes: 90, location: { name: "Gràcia", coordinates: BCN.gracia }, transportation: { method: "transit", duration: "25m" } },
    { id: "a4", title: "Slow Spa", category: "wellness", startTime: "17:00", endTime: "18:30", durationMinutes: 90, location: { name: "Slow Spa", coordinates: BCN.slowSpa }, transportation: { method: "walking", duration: "15 min" } },
    { id: "a5", title: "Dinner at Quimet & Quimet", category: "dining", startTime: "20:00", endTime: "21:30", durationMinutes: 90, location: { name: "Quimet & Quimet", coordinates: BCN.quimet }, transportation: { method: "taxi", duration: "10 min" } },
    { id: "a6", title: "Cocktails at La Confiteria", category: "nightlife", startTime: "22:00", endTime: "23:00", durationMinutes: 60, location: { name: "La Confiteria", coordinates: BCN.laConfiteria }, transportation: { method: "walking", duration: "15m" } },
  ];
}

function totalPathKm(acts: any[]): number {
  let d = 0;
  for (let i = 1; i < acts.length; i++) {
    const a = acts[i - 1]?.location?.coordinates;
    const b = acts[i]?.location?.coordinates;
    if (a && b) d += haversineDistance(a.lat, a.lng, b.lat, b.lng) / 1000;
  }
  return d;
}

Deno.test("reorderDayByProximity: never regresses the path (Barcelona day is already meal-locally optimal)", () => {
  // With breakfast/lunch/dinner pinned at Raval / Sant Antoni / Poble Sec, the
  // non-meal ordering is already near-optimal — the residual zig-zag is driven by
  // the spread of the *meals* themselves. The optimizer must therefore not make it
  // worse (a greedy nearest-neighbor walk would, by stranding the Gràcia outlier).
  const original = makeBarcelonaDay2();
  const { activities, reordered } = reorderDayByProximity(original, { hotelCoords: BCN.hotel });
  assert(reordered, "expected the day to be processed");
  assert(
    totalPathKm(activities) <= totalPathKm(original) + 1e-6,
    `must not regress: got ${totalPathKm(activities).toFixed(2)}km vs ${totalPathKm(original).toFixed(2)}km`,
  );
});

Deno.test("reorderDayByProximity: shortens a zig-zag among flexible stops", () => {
  // Three sightseeing stops on an east–west line, delivered by the AI in a
  // back-and-forth order between two pinned meals. The optimizer should straighten
  // them out (west → mid → east) and cut total travel.
  const day = [
    { id: "m1", title: "Breakfast", category: "dining", startTime: "09:00", endTime: "10:00", location: { name: "Cafe", coordinates: { lat: 41.39, lng: 2.10 } } },
    { id: "f1", title: "Museum East", category: "sightseeing", startTime: "11:00", endTime: "12:00", location: { name: "East", coordinates: { lat: 41.39, lng: 2.20 } } },
    { id: "f2", title: "Park West", category: "sightseeing", startTime: "12:15", endTime: "13:00", location: { name: "West", coordinates: { lat: 41.39, lng: 2.11 } } },
    { id: "f3", title: "Gallery Mid", category: "sightseeing", startTime: "13:15", endTime: "14:00", location: { name: "Mid", coordinates: { lat: 41.39, lng: 2.15 } } },
    { id: "m2", title: "Dinner", category: "dining", startTime: "20:00", endTime: "21:30", location: { name: "Resto", coordinates: { lat: 41.39, lng: 2.21 } } },
  ];
  const before = totalPathKm(day);
  const { activities } = reorderDayByProximity(day, { hotelCoords: { lat: 41.39, lng: 2.10 } });
  assert(
    totalPathKm(activities) < before,
    `expected the zig-zag straightened: got ${totalPathKm(activities).toFixed(3)}km vs ${before.toFixed(3)}km`,
  );
  // Pinned meals keep their endpoints.
  assertEquals(activities[0].id, "m1");
  assertEquals(activities[activities.length - 1].id, "m2");
});

Deno.test("reorderDayByProximity: meals stay in their original time slots", () => {
  const { activities } = reorderDayByProximity(makeBarcelonaDay2(), { hotelCoords: BCN.hotel });
  const byId = (id: string) => activities.find((a) => a.id === id)!;
  assertEquals(byId("a1").startTime, "09:00"); // breakfast
  assertEquals(byId("a2").startTime, "13:00"); // lunch
  assertEquals(byId("a5").startTime, "20:00"); // dinner
  const idx = (id: string) => activities.findIndex((a) => a.id === id);
  assert(idx("a1") < idx("a2") && idx("a2") < idx("a5"), "meal order must be preserved");
});

Deno.test("reorderDayByProximity: locked activity keeps its position", () => {
  const day = makeBarcelonaDay2();
  day[2].isLocked = true; // lock the Gràcia outlier in slot index 2
  const { activities } = reorderDayByProximity(day, { hotelCoords: BCN.hotel, lockedIds: new Set(["a3"]) });
  assertEquals(activities[2].id, "a3", "locked Gràcia must stay at its original index");
});

Deno.test("retimeAndComputeLegTimes: uniform travel times, first stop cleared, ascending", () => {
  const { activities } = reorderDayByProximity(makeBarcelonaDay2(), { hotelCoords: BCN.hotel });
  const timed = retimeAndComputeLegTimes(activities, { destination: "Barcelona" });

  // First stop has no inbound travel — stale placeholder cleared.
  assertEquals(timed[0].transportation?.duration, "");

  // Every later stop has a uniform "{n} min" travel time (no '15m'/'25m'/blank).
  for (let i = 1; i < timed.length; i++) {
    const dur = timed[i].transportation?.duration;
    assert(
      typeof dur === "string" && /^\d+ min$/.test(dur),
      `leg ${i} (${timed[i].title}) non-uniform duration: ${JSON.stringify(dur)}`,
    );
  }

  // Times stay non-decreasing so the downstream chronology sort can't revert the reorder.
  for (let i = 1; i < timed.length; i++) {
    assert(timed[i].startTime >= timed[i - 1].startTime, `times not ascending at ${i}`);
  }
});

Deno.test("reorderDayByProximity: no-op on a transition/arrival day (<2 flexible)", () => {
  const day = [
    { id: "t1", title: "Arrival Flight", category: "flight", startTime: "10:00", endTime: "12:00", location: { name: "BCN Airport", coordinates: { lat: 41.2974, lng: 2.0833 } } },
    { id: "t2", title: "Transfer to Hotel", category: "transport", startTime: "12:30", endTime: "13:15", location: { name: "Hotel", coordinates: BCN.hotel } },
    { id: "t3", title: "Lunch at Bodega 1900", category: "dining", startTime: "14:00", endTime: "15:30", location: { name: "Bodega 1900", coordinates: BCN.bodega1900 } },
  ];
  const { reordered, flexibleCount } = reorderDayByProximity(day, { hotelCoords: BCN.hotel });
  assertEquals(flexibleCount, 0);
  assertEquals(reordered, false);
});

// ---------- V2-chain wiring regression ----------
// generate-trip-day-v2.ts (the LIVE production path) composes
// reorderDayByProximity → retimeAndComputeLegTimes after the Schedule
// Executioner, exactly as the V1 paths do. The reported prod symptom was
// "Day 1 all legs 15m" — a uniform placeholder that survives because the
// executioner only retimes explicit transit CARDS, never the per-leg
// transportation.duration field. This locks in that the wired pair writes
// real, distance-proportional leg times (a long city-crossing hop must read
// longer than a short neighbourhood hop), not a single placeholder value.
Deno.test("V2 wiring: legs reflect real distance, not a uniform 15m placeholder", () => {
  // Three stops on an east–west line: a long hop then a short hop, all delivered
  // with the same "15m" placeholder the AI tends to emit.
  const day = [
    { id: "m1", title: "Breakfast", category: "dining", startTime: "09:00", endTime: "10:00", durationMinutes: 60, location: { name: "Cafe", coordinates: { lat: 41.39, lng: 2.10 } }, transportation: { method: "walking", duration: "15m" } },
    { id: "f1", title: "Museum Far East", category: "sightseeing", startTime: "11:00", endTime: "12:00", durationMinutes: 60, location: { name: "FarEast", coordinates: { lat: 41.39, lng: 2.25 } }, transportation: { method: "transit", duration: "15m" } },
    { id: "f2", title: "Gallery Just East", category: "sightseeing", startTime: "12:30", endTime: "13:30", durationMinutes: 60, location: { name: "JustEast", coordinates: { lat: 41.39, lng: 2.26 } }, transportation: { method: "walking", duration: "15m" } },
  ];
  const reorder = reorderDayByProximity(day, { hotelCoords: { lat: 41.39, lng: 2.10 } });
  const timed = retimeAndComputeLegTimes(reorder.activities, { destination: "Barcelona" });

  const parseMin = (t: unknown) => {
    const m = typeof t === "string" ? t.match(/^(\d+) min$/) : null;
    return m ? Number(m[1]) : NaN;
  };
  // First stop's inbound leg is cleared; the long hop (m1→f1, ~12km) must read
  // materially longer than the short hop (f1→f2, ~800m).
  assertEquals(timed[0].transportation?.duration, "");
  const longHop = parseMin(timed[1].transportation?.duration);
  const shortHop = parseMin(timed[2].transportation?.duration);
  assert(Number.isFinite(longHop) && Number.isFinite(shortHop), `legs must be "{n} min": got ${JSON.stringify([timed[1].transportation?.duration, timed[2].transportation?.duration])}`);
  assert(longHop > shortHop, `long hop (${longHop}m) must exceed short hop (${shortHop}m) — placeholder not replaced with real distance`);
  // And the values are not all the stale 15-minute placeholder.
  assert(longHop !== 15 || shortHop !== 15, "legs still read as the 15m placeholder");
});
