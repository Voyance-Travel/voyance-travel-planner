// Executioner cleanup / refill / audit-code wiring tests.
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  runScheduleExecutioner,
  runExecutionerRefill,
  toExecutionerAuditCodes,
  type ExecutionerContext,
} from "../schedule-executioner.ts";

const baseCtx: ExecutionerContext = {
  dayNumber: 2,
  totalDays: 4,
  isFirstDay: false,
  isLastDay: false,
};

Deno.test("geoDropEnabled=true overrides geoFlagOnly and drops outliers", () => {
  const acts = [
    { id: "a1", title: "Shibuya Sky", neighborhood: "Shibuya", location: { lat: 35.6595, lng: 139.7005 } },
    { id: "a2", title: "Hachiko Statue", neighborhood: "Shibuya", location: { lat: 35.6586, lng: 139.7016 } },
    { id: "out", title: "Senso-ji Temple", neighborhood: "Asakusa", location: { lat: 35.7148, lng: 139.7967 } },
  ];
  const ctx: ExecutionerContext = {
    ...baseCtx, dayTitle: "Shibuya Vibes", geoFlagOnly: true, geoDropEnabled: true,
  };
  const res = runScheduleExecutioner(acts, ctx);
  assertEquals(res.activities.length, 2);
  assert(res.counters.geoOutliersDropped >= 1);
});

Deno.test("toExecutionerAuditCodes emits EXEC_* codes for each non-zero counter", () => {
  const counters = {
    flightAnchorRepaired: 1, midnightSpilloversAllowed: 0, midnightSpilloversDropped: 2,
    bufferRepairs: 1, overlapRepairs: 1, transitRecomputed: 0,
    geoOutliersFlagged: 3, geoOutliersDropped: 2, droppedActivities: 2,
    gapsRefilled: 1, issues: [],
  };
  const codes = toExecutionerAuditCodes(counters, 5);
  const set = new Set(codes.map((c) => c.code));
  assert(set.has("EXEC_FLIGHT_ANCHOR_FIXED"));
  assert(set.has("EXEC_MIDNIGHT_SPILL_TRIMMED"));
  assert(set.has("EXEC_BUFFER_CASCADE_APPLIED"));
  assert(set.has("EXEC_GEO_OUTLIER_DROPPED"));
  assert(set.has("EXEC_GAP_REFILLED"));
  for (const c of codes) assertEquals(c.dayNumber, 5);
});

Deno.test("runExecutionerRefill no-ops when no drops occurred", async () => {
  const result = {
    activities: [
      { id: "a1", title: "A", startTime: "10:00", endTime: "11:00" },
      { id: "a2", title: "B", startTime: "15:00", endTime: "16:00" },
    ],
    counters: {
      flightAnchorRepaired: 0, midnightSpilloversAllowed: 0, midnightSpilloversDropped: 0,
      bufferRepairs: 0, overlapRepairs: 0, transitRecomputed: 0,
      geoOutliersFlagged: 0, geoOutliersDropped: 0, droppedActivities: 0,
      gapsRefilled: 0, issues: [] as any[],
    },
  };
  let called = false;
  await runExecutionerRefill(result, baseCtx, async () => { called = true; return null; });
  assertEquals(called, false);
  assertEquals(result.counters.gapsRefilled, 0);
});

Deno.test("runExecutionerRefill picks the largest >=90min gap and inserts once", async () => {
  const result = {
    activities: [
      { id: "a1", title: "Morning Walk", startTime: "09:00", endTime: "10:00" },
      { id: "a2", title: "Lunch", startTime: "12:00", endTime: "13:00" },
      // 5h gap 13:00 → 18:00 → largest
      { id: "a3", title: "Dinner", startTime: "19:00", endTime: "20:30" },
    ],
    counters: {
      flightAnchorRepaired: 0, midnightSpilloversAllowed: 0, midnightSpilloversDropped: 0,
      bufferRepairs: 0, overlapRepairs: 0, transitRecomputed: 0,
      geoOutliersFlagged: 1, geoOutliersDropped: 1, droppedActivities: 1,
      gapsRefilled: 0, issues: [] as any[],
    },
  };
  let receivedGap: { start: string; end: string } | null = null;
  await runExecutionerRefill(result, baseCtx, async (input) => {
    receivedGap = { start: input.gapStartTime, end: input.gapEndTime };
    return { id: "refill1", title: "Coffee Stop", startTime: "14:00", endTime: "15:00" };
  });
  assertEquals(result.counters.gapsRefilled, 1);
  assertEquals(result.activities.length, 4);
  const inserted = result.activities.find((a: any) => a.id === "refill1") as any;
  assert(inserted);
  assertEquals(inserted.source, "executioner_refill");
  assertEquals(receivedGap?.start, "13:00");
  assertEquals(receivedGap?.end, "19:00");
});

Deno.test("runExecutionerRefill skips when largest gap is < 90 min", async () => {
  const result = {
    activities: [
      { id: "a1", title: "A", startTime: "09:00", endTime: "10:00" },
      { id: "a2", title: "B", startTime: "11:00", endTime: "12:00" }, // 60m gap
    ],
    counters: {
      flightAnchorRepaired: 0, midnightSpilloversAllowed: 0, midnightSpilloversDropped: 0,
      bufferRepairs: 0, overlapRepairs: 0, transitRecomputed: 0,
      geoOutliersFlagged: 0, geoOutliersDropped: 0, droppedActivities: 1,
      gapsRefilled: 0, issues: [] as any[],
    },
  };
  let called = false;
  await runExecutionerRefill(result, baseCtx, async () => { called = true; return { id: "x", title: "x" }; });
  assertEquals(called, false);
  assertEquals(result.counters.gapsRefilled, 0);
});

Deno.test("runExecutionerRefill swallows refill errors (non-blocking)", async () => {
  const result = {
    activities: [
      { id: "a1", title: "A", startTime: "09:00", endTime: "10:00" },
      { id: "a2", title: "B", startTime: "15:00", endTime: "16:00" },
    ],
    counters: {
      flightAnchorRepaired: 0, midnightSpilloversAllowed: 0, midnightSpilloversDropped: 0,
      bufferRepairs: 0, overlapRepairs: 0, transitRecomputed: 0,
      geoOutliersFlagged: 0, geoOutliersDropped: 0, droppedActivities: 1,
      gapsRefilled: 0, issues: [] as any[],
    },
  };
  await runExecutionerRefill(result, baseCtx, async () => { throw new Error("boom"); });
  assertEquals(result.counters.gapsRefilled, 0);
  assertEquals(result.activities.length, 2);
});
