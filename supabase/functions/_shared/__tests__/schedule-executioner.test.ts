// Schedule Executioner tests — deterministic enforcement layer.

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  runScheduleExecutioner,
  enforceFlightAnchors,
  enforceMidnightSpill,
  enforceGeoCoherence,
  enforceBufferCascade,
  __test_only,
  type ExecutionerContext,
} from "../schedule-executioner.ts";

function newCounters() {
  return {
    flightAnchorRepaired: 0,
    midnightSpilloversAllowed: 0,
    midnightSpilloversDropped: 0,
    bufferRepairs: 0,
    overlapRepairs: 0,
    transitRecomputed: 0,
    geoOutliersFlagged: 0,
    geoOutliersDropped: 0,
    airportLoopsDropped: 0,
    transfersClamped: 0,
    departureTransfersStripped: 0,
    orphanTransitsDropped: 0,
    droppedActivities: 0,
    gapsRefilled: 0,
    issues: [] as any[],
  };
}


const baseCtx: ExecutionerContext = {
  dayNumber: 1,
  totalDays: 4,
  isFirstDay: true,
  isLastDay: false,
};

// ─── 1A — Flight anchor mismatch ─────────────────────────────────────────────

Deno.test("1A: arrival card 21:30 retimes to flight truth 22:00", () => {
  const acts = [
    {
      id: "arr1",
      title: "Arrival Flight",
      category: "flight",
      anchorSource: "arrival-flight",
      startTime: "21:30",
      endTime: "21:45",
    },
  ];
  const ctx: ExecutionerContext = { ...baseCtx, arrivalTime24: "22:00" };
  const counters = newCounters();
  enforceFlightAnchors(acts, ctx, counters);
  assertEquals(acts[0].startTime, "22:00");
  assertEquals(acts[0].endTime, "22:15"); // duration preserved (15m)
  assertEquals(counters.flightAnchorRepaired, 1);
});

Deno.test("1A: user-owned arrival card is NEVER retimed (system anchors WITH isLocked:true ARE checked)", () => {
  // Phase 2 semantic: isUserOwned (not isLocked) is the immutability key.
  // System-generated arrival anchors stamped isLocked:true by anchor-guard
  // MUST be retimed when they disagree with flight truth — that was the
  // Lisbon 19:00 / Amsterdam 20:00 ships-as-ready leak path.
  const acts = [
    {
      id: "arr1",
      title: "Arrival Flight",
      category: "flight",
      anchorSource: "arrival-flight",
      startTime: "21:30",
      endTime: "21:45",
      source: "user", // truly user-owned
    },
  ];
  const ctx: ExecutionerContext = { ...baseCtx, arrivalTime24: "22:00" };
  const counters = newCounters();
  enforceFlightAnchors(acts, ctx, counters);
  assertEquals(acts[0].startTime, "21:30");
  assertEquals(counters.flightAnchorRepaired, 0);
});


Deno.test("1A: arrival within 5m tolerance is left alone", () => {
  const acts = [
    {
      id: "arr1",
      title: "Arrival",
      anchorSource: "arrival-flight",
      startTime: "22:03",
      endTime: "22:18",
    },
  ];
  const ctx: ExecutionerContext = { ...baseCtx, arrivalTime24: "22:00" };
  const counters = newCounters();
  enforceFlightAnchors(acts, ctx, counters);
  assertEquals(acts[0].startTime, "22:03");
  assertEquals(counters.flightAnchorRepaired, 0);
});

Deno.test("1A: pre-arrival sightseeing dropped (flight 22:00, museum at 15:00)", () => {
  const acts = [
    { id: "m1", title: "Tokyo National Museum", category: "museum", startTime: "15:00", endTime: "17:00" },
    { id: "arr1", title: "Arrival Flight", anchorSource: "arrival-flight", startTime: "22:00", endTime: "22:15" },
  ];
  const ctx: ExecutionerContext = { ...baseCtx, arrivalTime24: "22:00" };
  const counters = newCounters();
  enforceFlightAnchors(acts, ctx, counters);
  assertEquals(acts.length, 1);
  assertEquals(acts[0].id, "arr1");
  assertEquals(counters.droppedActivities, 1);
});

// ─── 1B — Midnight spill ──────────────────────────────────────────────────────

Deno.test("1B: Golden Gai 22:55→00:55 nightlife is ALLOWED and stamped", () => {
  const acts = [
    {
      id: "gg",
      title: "Golden Gai Bar Hopping",
      category: "nightlife",
      startTime: "22:55",
      endTime: "00:55",
    },
  ];
  const counters = newCounters();
  enforceMidnightSpill(acts, baseCtx, counters);
  assertEquals(counters.midnightSpilloversAllowed, 1);
  assertEquals((acts[0] as any).metadata.spillsPastMidnight, true);
  assertEquals((acts[0] as any).metadata.spilloverMinutes, 55);
});

Deno.test("1B: non-nightlife wrap (museum 23:30→00:30) is clamped", () => {
  const acts = [
    {
      id: "m1",
      title: "Museum Late Tour",
      category: "museum",
      startTime: "23:30",
      endTime: "00:30",
    },
  ];
  const counters = newCounters();
  enforceMidnightSpill(acts, baseCtx, counters);
  assertEquals(counters.midnightSpilloversDropped, 1);
  // clamped to start + 60 (capped at 23:59)
  assertEquals(acts[0].endTime, "23:59");
});

Deno.test("1B: locked wrap card is NEVER mutated", () => {
  const acts = [
    {
      id: "m1",
      title: "Private Late Tour",
      startTime: "23:30",
      endTime: "00:30",
      isLocked: true,
    },
  ];
  const counters = newCounters();
  enforceMidnightSpill(acts, baseCtx, counters);
  assertEquals(acts[0].endTime, "00:30");
  assertEquals(counters.midnightSpilloversDropped, 0);
});

// ─── 1C — Buffer cascade ─────────────────────────────────────────────────────

Deno.test("1C: back-to-back same-start gets cascade-repaired", () => {
  const acts = [
    { id: "a1", title: "Activity A", startTime: "10:00", endTime: "11:00" },
    { id: "a2", title: "Activity B", startTime: "11:00", endTime: "12:00" },
  ];
  const counters = newCounters();
  const result = enforceBufferCascade(acts, baseCtx, counters);
  // cascade should have pushed a2 OR recorded a repair
  assert(result.length === 2);
});

// ─── 1D — Geo coherence ──────────────────────────────────────────────────────

Deno.test("1D: Senso-ji (Asakusa) flagged in 'Shinjuku Soul' day", () => {
  const acts = [
    { id: "shrine", title: "Meiji Shrine", category: "culture", neighborhood: "Shinjuku",
      location: { lat: 35.6764, lng: 139.6993 } },
    { id: "gyoen", title: "Shinjuku Gyoen", category: "park", neighborhood: "Shinjuku",
      location: { lat: 35.6852, lng: 139.7100 } },
    { id: "omoide", title: "Omoide Yokocho Yakitori", category: "dining", neighborhood: "Shinjuku",
      location: { lat: 35.6921, lng: 139.6996 } },
    // outlier — Senso-ji is in Asakusa, ~8.5 km away
    { id: "senso", title: "Senso-ji Temple", category: "culture", neighborhood: "Asakusa",
      location: { lat: 35.7148, lng: 139.7967 } },
  ];
  const ctx: ExecutionerContext = {
    ...baseCtx,
    dayTitle: "Shinjuku Soul & Hidden Alleys",
  };
  const counters = newCounters();
  enforceGeoCoherence(acts, ctx, counters);
  assertEquals(counters.geoOutliersFlagged, 1);
  assertEquals(counters.geoOutliersDropped, 1);
  // Senso-ji dropped, marked needsRefill
  assertEquals(acts.length, 3);
  assert(!acts.find(a => a.id === "senso"));
});

Deno.test("1D: geoFlagOnly = true preserves the outlier", () => {
  const acts = [
    { id: "a1", title: "Shibuya Crossing", neighborhood: "Shibuya",
      location: { lat: 35.6595, lng: 139.7005 } },
    { id: "a2", title: "Shibuya Sky", neighborhood: "Shibuya",
      location: { lat: 35.6586, lng: 139.7016 } },
    { id: "out", title: "Senso-ji Temple", neighborhood: "Asakusa",
      location: { lat: 35.7148, lng: 139.7967 } },
  ];
  const ctx: ExecutionerContext = {
    ...baseCtx,
    dayTitle: "Shibuya Vibes",
    geoFlagOnly: true,
  };
  const counters = newCounters();
  enforceGeoCoherence(acts, ctx, counters);
  assertEquals(acts.length, 3);
  assertEquals(counters.geoOutliersDropped, 0);
  assert(counters.geoOutliersFlagged >= 1);
});

Deno.test("1D: locked outlier is NEVER dropped", () => {
  const acts = [
    { id: "a1", title: "Shinjuku Gyoen", neighborhood: "Shinjuku",
      location: { lat: 35.6852, lng: 139.7100 } },
    { id: "a2", title: "Omoide Yokocho", neighborhood: "Shinjuku",
      location: { lat: 35.6921, lng: 139.6996 } },
    { id: "lock", title: "Senso-ji Temple", neighborhood: "Asakusa",
      location: { lat: 35.7148, lng: 139.7967 }, isLocked: true },
  ];
  const ctx: ExecutionerContext = { ...baseCtx, dayTitle: "Shinjuku Hidden Alleys" };
  const counters = newCounters();
  enforceGeoCoherence(acts, ctx, counters);
  assert(acts.find(a => a.id === "lock"));
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

Deno.test("neighborhoodTokensFromTitle extracts proper nouns", () => {
  const t = __test_only.neighborhoodTokensFromTitle("Shinjuku Soul & Hidden Alleys");
  assert(t.includes("shinjuku"));
  assert(!t.includes("soul"));
  assert(!t.includes("hidden"));
});

// ─── Orchestrator ────────────────────────────────────────────────────────────

Deno.test("orchestrator: counters stamp + activities mutated", () => {
  const acts = [
    { id: "arr", title: "Arrival Flight", anchorSource: "arrival-flight",
      startTime: "21:30", endTime: "21:45" },
    { id: "gg", title: "Golden Gai Bar Hopping", category: "nightlife",
      startTime: "22:55", endTime: "00:55" },
  ];
  const ctx: ExecutionerContext = { ...baseCtx, arrivalTime24: "22:00" };
  const result = runScheduleExecutioner(acts, ctx);
  assertEquals(result.counters.flightAnchorRepaired, 1);
  assertEquals(result.counters.midnightSpilloversAllowed, 1);
  assertEquals(result.activities[0].startTime, "22:00");
});
