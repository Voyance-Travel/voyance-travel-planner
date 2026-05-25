import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { sanitizeDaySchedule, sanitizeSchedule } from "../sanitize-schedule-timing.ts";

Deno.test("predawn dinner with no late-nightlife signal gets repaired to 19:30", () => {
  const acts: any[] = [
    { id: "1", category: "dining", title: "Dinner: Roscioli", startTime: "00:00", endTime: "01:15" },
  ];
  const r = sanitizeDaySchedule(acts, { dayNumber: 1 });
  assertEquals(r.predawnMealsRepaired, 1);
  assertEquals(acts[0].startTime, "19:30");
});

Deno.test("locked pre-dawn arrival flight is preserved", () => {
  const acts: any[] = [
    { id: "f", category: "flight", title: "Arrival Flight", startTime: "02:30", endTime: "04:30", isLocked: true, source: "repair-arrival-flight" },
  ];
  const r = sanitizeDaySchedule(acts, { dayNumber: 1 });
  assertEquals(r.predawnMealsRepaired, 0);
  assertEquals(acts[0].startTime, "02:30");
});

Deno.test("duplicate hotel returns collapse to one (keeps last, drops earlier non-locked)", () => {
  const acts: any[] = [
    { id: "a", category: "accommodation", title: "Return to Hotel", startTime: "18:36", endTime: "19:01" },
    { id: "b", category: "accommodation", title: "Return to Hotel", startTime: "23:41", endTime: "23:59" },
    { id: "c", category: "accommodation", title: "Return to Hotel", startTime: "23:59", endTime: "23:59" },
  ];
  const r = sanitizeDaySchedule(acts, { dayNumber: 1 });
  assertEquals(r.duplicateHotelReturnsRemoved, 2);
  assertEquals(acts.length, 1);
  assertEquals(acts[0].id, "c");
});

Deno.test("end_time alias drift gets repaired to the value that yields sane window", () => {
  const acts: any[] = [
    { id: "1", category: "dining", title: "Lunch: Forno", startTime: "11:40", endTime: "12:25", end_time: "12:25" },
    // Drift case
    { id: "2", category: "cultural", title: "Wander Trastevere", startTime: "14:55", endTime: "17:25", end_time: "14:38" },
  ];
  const r = sanitizeDaySchedule(acts, { dayNumber: 1 });
  assertEquals(r.fieldDriftRepaired, 1);
  assertEquals(acts[1].end_time, "17:25");
});

Deno.test("late-nightlife tagged card stays in pre-dawn window", () => {
  const acts: any[] = [
    { id: "1", category: "accommodation", title: "Return to Hotel", startTime: "00:55", endTime: "01:30", source: "late_nightlife_bookend" },
  ];
  const r = sanitizeDaySchedule(acts, { dayNumber: 2 });
  assertEquals(r.predawnMealsRepaired, 0);
  assertEquals(r.predawnNonLockedDropped, 0);
  assertEquals(acts.length, 1);
});

Deno.test("sanitizeSchedule aggregates counters across days", () => {
  const days = [
    { dayNumber: 1, activities: [{ id: "1", category: "dining", title: "Dinner X", startTime: "00:00", endTime: "01:15" }] },
    { dayNumber: 2, activities: [{ id: "2", category: "dining", title: "Lunch Y", startTime: "13:00", endTime: "14:00" }] },
  ];
  const r = sanitizeSchedule(days, { site: "test" });
  assertEquals(r.counters.predawnMealsRepaired, 1);
  assertEquals(r.touchedDays, 1);
});
