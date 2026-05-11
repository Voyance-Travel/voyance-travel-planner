// startTime normalization: end - durationMinutes fills missing start.
// Closes Bruges Day 3 Bistro Refter bare "→ 1:30 PM" leak.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { fillMissingStartTimes } from "../../_shared/timing-cascade.ts";

Deno.test("fillMissingStartTimes: end − duration fills start", () => {
  const acts: any[] = [
    { id: "a", title: "Bistro Refter", endTime: "13:30", durationMinutes: 60 },
  ];
  const res = fillMissingStartTimes(acts, { dayNumber: 3, path: "test" });
  assertEquals(res.filled, 1);
  assertEquals(acts[0].startTime, "12:30");
  assertEquals(acts[0].start_time, "12:30");
  assertEquals(acts[0].time, "12:30");
});

Deno.test("fillMissingStartTimes: never overwrites an existing start", () => {
  const acts: any[] = [
    { id: "a", startTime: "09:00", endTime: "13:30", durationMinutes: 60 },
  ];
  const res = fillMissingStartTimes(acts);
  assertEquals(res.filled, 0);
  assertEquals(acts[0].startTime, "09:00");
});

Deno.test("fillMissingStartTimes: locked / user-anchored exempt", () => {
  const acts: any[] = [
    { id: "a", endTime: "13:30", durationMinutes: 60, isLocked: true },
    { id: "b", endTime: "14:30", durationMinutes: 60, userAdded: true },
    { id: "c", endTime: "15:30", durationMinutes: 60, isManual: true },
  ];
  const res = fillMissingStartTimes(acts);
  assertEquals(res.filled, 0);
  assertEquals(acts[0].startTime, undefined);
  assertEquals(acts[1].startTime, undefined);
  assertEquals(acts[2].startTime, undefined);
});

Deno.test("fillMissingStartTimes: skips when duration missing or zero", () => {
  const acts: any[] = [
    { id: "a", endTime: "13:30" },
    { id: "b", endTime: "13:30", durationMinutes: 0 },
  ];
  const res = fillMissingStartTimes(acts);
  assertEquals(res.filled, 0);
  assertEquals(res.skipped, 2);
  assertEquals(acts[0].startTime, undefined);
});

Deno.test("fillMissingStartTimes: clamps to 00:00 when duration exceeds end", () => {
  const acts: any[] = [{ id: "a", endTime: "00:30", durationMinutes: 60 }];
  const res = fillMissingStartTimes(acts);
  assertEquals(res.filled, 1);
  assertEquals(acts[0].startTime, "00:00");
});

Deno.test("fillMissingStartTimes: snake_case fallback fields", () => {
  const acts: any[] = [{ id: "a", end_time: "15:00", duration_minutes: 90 }];
  const res = fillMissingStartTimes(acts);
  assertEquals(res.filled, 1);
  assertEquals(acts[0].startTime, "13:30");
});
