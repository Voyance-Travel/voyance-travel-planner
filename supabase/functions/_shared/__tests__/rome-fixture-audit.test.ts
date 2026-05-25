// rome-fixture-audit.test.ts — locks the Rome d18b2e8a… pattern as a regression
// fixture. The trip persisted Day 1 with a 00:00 dinner and four duplicate
// hotel returns; the auditor must flag both even though sanitize-schedule-timing
// already covers the new write path.
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { auditTimingViolations } from "../audit-timing.ts";

const ROME_DAY_1 = {
  dayNumber: 1,
  activities: [
    { id: "rome-1", category: "cultural", title: "Walk Trastevere", startTime: "11:00", endTime: "13:00" },
    { id: "rome-2", category: "dining", title: "Lunch: Da Enzo", startTime: "13:30", endTime: "14:30" },
    { id: "rome-3", category: "museum", title: "Pantheon", startTime: "15:00", endTime: "16:30" },
    // The bug — dinner stamped pre-dawn.
    { id: "rome-4", category: "dining", title: "Dinner: Roscioli", startTime: "00:00", endTime: "01:15" },
    // The other bug — four hotel-return rows.
    { id: "rome-5", category: "accommodation", title: "Return to Hotel", startTime: "18:36", endTime: "19:01" },
    { id: "rome-6", category: "accommodation", title: "Return to Hotel", startTime: "20:15", endTime: "20:30" },
    { id: "rome-7", category: "accommodation", title: "Return to Hotel", startTime: "23:00", endTime: "23:15" },
    { id: "rome-8", category: "accommodation", title: "Return to Hotel", startTime: "23:45", endTime: "23:59" },
  ],
};

Deno.test("Rome fixture: predawn dinner + 4 hotel returns flagged", () => {
  const r = auditTimingViolations([ROME_DAY_1]);
  const codes = r.violations.map((v) => v.code);
  assert(codes.includes("INVALID_PREDAWN_MEAL"), `expected INVALID_PREDAWN_MEAL, got ${codes.join(",")}`);
  assert(codes.includes("MULTIPLE_BOOKEND_RETURNS"), `expected MULTIPLE_BOOKEND_RETURNS, got ${codes.join(",")}`);
  // 4 hotel returns → one violation collapsing all 4 ids
  const mbr = r.violations.find((v) => v.code === "MULTIPLE_BOOKEND_RETURNS");
  assertEquals(mbr?.activityIds.length, 4);
});

Deno.test("Rome fixture: JSON_TABLE_PARITY fires when table has 5 rows but JSON has 8", () => {
  const r = auditTimingViolations([ROME_DAY_1], { tableActivityCountsByDay: { 1: 5 } });
  const codes = r.violations.map((v) => v.code);
  assert(codes.includes("JSON_TABLE_PARITY"));
  assertEquals(r.parityDelta, 3);
});
