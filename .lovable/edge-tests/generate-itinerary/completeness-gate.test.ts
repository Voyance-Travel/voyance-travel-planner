/**
 * Final-day completeness gate — the silent-empty-day guarantee (issue #1).
 *
 * Asserts the pure healing primitives: detecting empty days, mapping persisted
 * table rows back to the JSON activity shape, and splicing a recovered day's
 * activities into the merged JSON.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isDayComplete,
  findEmptyDays,
  mapTableRowToActivity,
  mapTableRowsToActivities,
  applyHealedDay,
} from "../../../supabase/functions/generate-itinerary/v2/completeness-gate.ts";

Deno.test("isDayComplete: true only for a non-empty activities array", () => {
  assert(isDayComplete({ dayNumber: 1, activities: [{ title: "x" }] }));
  assertEquals(isDayComplete({ dayNumber: 1, activities: [] }), false);
  assertEquals(isDayComplete({ dayNumber: 1 }), false);
  assertEquals(isDayComplete({ dayNumber: 1, activities: null }), false);
  assertEquals(isDayComplete(undefined), false);
});

Deno.test("findEmptyDays: flags the title-but-empty day (the Day-3 bug)", () => {
  const mergedDays = [
    { dayNumber: 1, activities: [{ title: "Breakfast" }] },
    { dayNumber: 2, activities: [{ title: "Museum" }] },
    { dayNumber: 3, title: "Neighborhood Narratives", activities: [] }, // the bug
    { dayNumber: 4, activities: [{ title: "Departure" }] },
  ];
  assertEquals(findEmptyDays(mergedDays, 4), [3]);
});

Deno.test("findEmptyDays: flags a day missing from the array entirely", () => {
  const mergedDays = [
    { dayNumber: 1, activities: [{ title: "a" }] },
    { dayNumber: 3, activities: [{ title: "c" }] },
  ];
  // Day 2 absent, Day 4 absent
  assertEquals(findEmptyDays(mergedDays, 4), [2, 4]);
});

Deno.test("findEmptyDays: returns [] when every day is complete", () => {
  const mergedDays = [
    { dayNumber: 1, activities: [{ title: "a" }] },
    { dayNumber: 2, activities: [{ title: "b" }] },
  ];
  assertEquals(findEmptyDays(mergedDays, 2), []);
});

Deno.test("findEmptyDays: tolerates snake_case day_number", () => {
  const mergedDays = [
    { day_number: 1, activities: [{ title: "a" }] },
    { day_number: 2, activities: [] },
  ];
  assertEquals(findEmptyDays(mergedDays, 2), [2]);
});

Deno.test("mapTableRowToActivity: snake_case row → camelCase activity", () => {
  const row = {
    id: "11111111-1111-4111-8111-111111111111",
    external_id: "ext-7",
    title: "Lunch at Casa Mingo",
    name: "Casa Mingo",
    description: "Cider house",
    category: "dining",
    start_time: "13:25",
    end_time: "14:40",
    duration_minutes: 75,
    location: "Paseo de la Florida",
    cost: { amount: 30, source: "llm" },
    tags: ["dining", "lunch"],
    is_locked: true,
    booking_required: false,
    walking_distance: "400m",
    walking_time: "5 min",
    viator_product_code: null,
  };
  const a = mapTableRowToActivity(row);
  assertEquals(a.id, "11111111-1111-4111-8111-111111111111");
  assertEquals(a.external_id, "ext-7");
  assertEquals(a.title, "Lunch at Casa Mingo");
  assertEquals(a.category, "dining");
  assertEquals(a.startTime, "13:25");
  assertEquals(a.endTime, "14:40");
  assertEquals(a.durationMinutes, 75);
  assertEquals(a.isLocked, true);
  assertEquals(a.bookingRequired, false);
  assertEquals(a.walkingDistance, "400m");
  assertEquals(a.walkingTime, "5 min");
  // null/absent columns are dropped, not carried as null
  assert(!("viatorProductCode" in a));
});

Deno.test("mapTableRowsToActivities: preserves order, maps each", () => {
  const rows = [
    { title: "Breakfast", category: "dining", start_time: "09:00" },
    { title: "Museum", category: "sightseeing", start_time: "11:00" },
  ];
  const acts = mapTableRowsToActivities(rows);
  assertEquals(acts.length, 2);
  assertEquals(acts[0].startTime, "09:00");
  assertEquals(acts[1].title, "Museum");
});

Deno.test("applyHealedDay: replaces activities on an existing (empty) day in place", () => {
  const mergedDays = [
    { dayNumber: 1, activities: [{ title: "a" }] },
    { dayNumber: 3, title: "Barrios", activities: [] },
  ];
  const healed = [{ title: "Plaza Mayor" }, { title: "Tapas" }];
  applyHealedDay(mergedDays, 3, healed);
  const d3 = mergedDays.find((d) => d.dayNumber === 3)!;
  assertEquals(d3.activities.length, 2);
  assertEquals(d3.title, "Barrios"); // title preserved
  assertEquals(findEmptyDays(mergedDays, 3).includes(3), false);
});

Deno.test("applyHealedDay: inserts + sorts a day missing from the array", () => {
  const mergedDays = [
    { dayNumber: 1, activities: [{ title: "a" }] },
    { dayNumber: 3, activities: [{ title: "c" }] },
  ];
  applyHealedDay(mergedDays, 2, [{ title: "b" }], "2026-07-22");
  assertEquals(mergedDays.map((d) => d.dayNumber), [1, 2, 3]);
  assertEquals(mergedDays[1].activities[0].title, "b");
  assertEquals(mergedDays[1].date, "2026-07-22");
});
