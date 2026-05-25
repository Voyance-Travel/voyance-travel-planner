// audit-timing.test.ts — one case per violation code + clean-trip negative.
// Locks the canonical read/write-time auditor.
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { auditTimingViolations, type AuditCode } from "../audit-timing.ts";

function codes(r: ReturnType<typeof auditTimingViolations>): AuditCode[] {
  return r.violations.map((v) => v.code);
}

Deno.test("clean trip → zero violations", () => {
  const days = [
    {
      dayNumber: 1,
      activities: [
        { id: "1", category: "dining", title: "Breakfast: Cafe", startTime: "08:00", endTime: "09:00" },
        { id: "2", category: "cultural", title: "Walk Trastevere", startTime: "10:00", endTime: "12:00" },
        { id: "3", category: "dining", title: "Lunch: Trattoria", startTime: "13:00", endTime: "14:00" },
        { id: "4", category: "dining", title: "Dinner: Roscioli", startTime: "20:00", endTime: "21:30" },
      ],
    },
  ];
  const r = auditTimingViolations(days, { arrivalTime24: "06:00" });
  assertEquals(r.violations.length, 0);
});

Deno.test("INVALID_PREDAWN_MEAL fires on 00:00 dinner with no nightlife tag", () => {
  const days = [{ dayNumber: 1, activities: [{ id: "x", category: "dining", title: "Dinner", startTime: "00:00", endTime: "01:15" }] }];
  const r = auditTimingViolations(days);
  assert(codes(r).includes("INVALID_PREDAWN_MEAL"));
});

Deno.test("INVALID_PREDAWN_MEAL skipped when source=late_nightlife_bookend", () => {
  const days = [{ dayNumber: 1, activities: [{ id: "x", category: "dining", title: "Nightcap", startTime: "00:30", endTime: "01:30", source: "late_nightlife_bookend" }] }];
  const r = auditTimingViolations(days);
  assert(!codes(r).includes("INVALID_PREDAWN_MEAL"));
});

Deno.test("ARRIVAL_SEQUENCE fires when activity precedes arrival+60min buffer", () => {
  const days = [{ dayNumber: 1, activities: [
    { id: "1", category: "cultural", title: "Museum visit", startTime: "10:00", endTime: "12:00" },
    { id: "2", category: "dining", title: "Dinner", startTime: "20:00", endTime: "21:30" },
  ] }];
  const r = auditTimingViolations(days, { arrivalTime24: "11:30" });
  assert(codes(r).includes("ARRIVAL_SEQUENCE"));
});

Deno.test("MEAL_WINDOW fires on lunch at 16:00 and dinner at 16:00", () => {
  const days = [{ dayNumber: 1, activities: [
    { id: "1", category: "dining", title: "Lunch X", startTime: "16:00", endTime: "17:00" },
    { id: "2", category: "dining", title: "Dinner Y", startTime: "16:30", endTime: "17:30" },
  ] }];
  const r = auditTimingViolations(days);
  const c = codes(r).filter((x) => x === "MEAL_WINDOW");
  assertEquals(c.length, 2);
});

Deno.test("LANDMARK_AFTER_DARK warns on museum at 20:00", () => {
  const days = [{ dayNumber: 1, activities: [{ id: "1", category: "museum", title: "Vatican Museums", startTime: "20:00", endTime: "22:00" }] }];
  const r = auditTimingViolations(days);
  assert(codes(r).includes("LANDMARK_AFTER_DARK"));
});

Deno.test("MULTIPLE_BOOKEND_RETURNS fires with 2 hotel returns same day", () => {
  const days = [{ dayNumber: 1, activities: [
    { id: "a", category: "accommodation", title: "Return to Hotel", startTime: "18:00", endTime: "18:30" },
    { id: "b", category: "accommodation", title: "Return to Hotel", startTime: "22:00", endTime: "23:00" },
  ] }];
  const r = auditTimingViolations(days);
  assert(codes(r).includes("MULTIPLE_BOOKEND_RETURNS"));
});

Deno.test("JSON_TABLE_PARITY fires when table count differs", () => {
  const days = [{ dayNumber: 1, activities: [{ id: "1", category: "dining", title: "Lunch", startTime: "13:00", endTime: "14:00" }] }];
  const r = auditTimingViolations(days, { tableActivityCountsByDay: { 1: 5 } });
  assert(codes(r).includes("JSON_TABLE_PARITY"));
  assertEquals(r.parityDelta, 4);
});

Deno.test("CROSS_DAY_BLEED fires when Day 1 ends 23:00 and Day 2 starts 02:00 non-bookend", () => {
  const days = [
    { dayNumber: 1, activities: [{ id: "a", category: "dining", title: "Dinner", startTime: "21:00", endTime: "23:00" }] },
    { dayNumber: 2, activities: [{ id: "b", category: "cultural", title: "Museum", startTime: "02:00", endTime: "04:00" }] },
  ];
  const r = auditTimingViolations(days);
  assert(codes(r).includes("CROSS_DAY_BLEED"));
});

Deno.test("INVERTED_WINDOW fires on end<start that isn't a legit wrap", () => {
  const days = [{ dayNumber: 1, activities: [{ id: "1", category: "cultural", title: "Walk", startTime: "14:00", endTime: "12:00" }] }];
  const r = auditTimingViolations(days);
  assert(codes(r).includes("INVERTED_WINDOW"));
});

Deno.test("INVERTED_WINDOW NOT fired on legit 22:00→01:30 wrap", () => {
  const days = [{ dayNumber: 1, activities: [{ id: "1", category: "nightlife", title: "Bar", startTime: "22:00", endTime: "01:30" }] }];
  const r = auditTimingViolations(days);
  assert(!codes(r).includes("INVERTED_WINDOW"));
});

Deno.test("MISSING_DINNER warns on day with 3 timed activities but no dinner", () => {
  const days = [{ dayNumber: 1, activities: [
    { id: "1", category: "dining", title: "Breakfast", startTime: "08:00", endTime: "09:00" },
    { id: "2", category: "cultural", title: "Museum", startTime: "10:00", endTime: "12:00" },
    { id: "3", category: "dining", title: "Lunch", startTime: "13:00", endTime: "14:00" },
  ] }];
  const r = auditTimingViolations(days);
  assert(codes(r).includes("MISSING_DINNER"));
});

Deno.test("DUPLICATE_TITLE_SAME_DAY warns on repeated venue", () => {
  const days = [{ dayNumber: 1, activities: [
    { id: "1", category: "cultural", title: "Colosseum", startTime: "10:00", endTime: "12:00" },
    { id: "2", category: "cultural", title: "Colosseum", startTime: "15:00", endTime: "16:00" },
  ] }];
  const r = auditTimingViolations(days);
  assert(codes(r).includes("DUPLICATE_TITLE_SAME_DAY"));
});

Deno.test("Rome-pattern day: predawn dinner + multiple hotel returns → both fire", () => {
  const days = [{ dayNumber: 1, activities: [
    { id: "1", category: "dining", title: "Dinner: Roscioli", startTime: "00:00", endTime: "01:15" },
    { id: "2", category: "accommodation", title: "Return to Hotel", startTime: "01:30", endTime: "02:00" },
    { id: "3", category: "accommodation", title: "Return to Hotel", startTime: "22:00", endTime: "23:00" },
    { id: "4", category: "accommodation", title: "Return to Hotel", startTime: "23:30", endTime: "23:59" },
  ] }];
  const r = auditTimingViolations(days);
  assert(codes(r).includes("INVALID_PREDAWN_MEAL"));
  assert(codes(r).includes("MULTIPLE_BOOKEND_RETURNS"));
});
