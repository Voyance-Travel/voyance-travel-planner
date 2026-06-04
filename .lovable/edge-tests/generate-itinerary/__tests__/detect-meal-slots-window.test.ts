// Tests for detectMealSlots out-of-window title-hit guard.
// See plan: "Plug missing-lunch generation holes (Istanbul Day 2 pattern)"

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { detectMealSlots } from "../day-validation.ts";

Deno.test("detectMealSlots: 'Lunch at X' dining card at 15:55 does NOT credit lunch", () => {
  const res = detectMealSlots([
    { title: "Lunch at Binbirdirek", category: "dining", startTime: "15:55" } as any,
  ]);
  assertEquals(res, []);
});

Deno.test("detectMealSlots: 'Lunch at X' dining card at 13:00 credits lunch", () => {
  const res = detectMealSlots([
    { title: "Lunch at Binbirdirek", category: "dining", startTime: "13:00" } as any,
  ]);
  assertEquals(res, ["lunch"]);
});

Deno.test("detectMealSlots: dining card with no meal keyword in title at 13:00 still credits lunch (time-based path)", () => {
  const res = detectMealSlots([
    { title: "Mikla", category: "dining", startTime: "13:00" } as any,
  ]);
  assertEquals(res, ["lunch"]);
});

Deno.test("detectMealSlots: 'Breakfast at X' at 14:00 does NOT credit breakfast (but credits lunch by time)", () => {
  const res = detectMealSlots([
    { title: "Breakfast at Café", category: "dining", startTime: "14:00" } as any,
  ]);
  assertEquals(res, ["lunch"]);
});

Deno.test("detectMealSlots: 'Dinner at X' at 16:00 does NOT credit dinner", () => {
  const res = detectMealSlots([
    { title: "Dinner at Mikla", category: "dining", startTime: "16:00" } as any,
  ]);
  assertEquals(res, []);
});

Deno.test("detectMealSlots: 'Dinner at X' at 19:00 credits dinner", () => {
  const res = detectMealSlots([
    { title: "Dinner at Mikla", category: "dining", startTime: "19:00" } as any,
  ]);
  assertEquals(res, ["dinner"]);
});

Deno.test("detectMealSlots: title-hit with no startTime falls back to title credit (legacy behavior)", () => {
  const res = detectMealSlots([
    { title: "Lunch at X", category: "dining" } as any,
  ]);
  assertEquals(res, ["lunch"]);
});

Deno.test("detectMealSlots: Istanbul Day 2 pattern — Topkapi 10:00 sightseeing + Binbirdirek 'Lunch' 15:55 leaves lunch missing", () => {
  const res = detectMealSlots([
    { title: "Topkapi Palace", category: "culture", startTime: "10:00" } as any,
    { title: "Lunch at Binbirdirek Sarnici", category: "dining", startTime: "15:55" } as any,
  ]);
  assertEquals(res, []);
});
