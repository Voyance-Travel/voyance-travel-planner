import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { detectMealSlots } from "../day-validation.ts";

Deno.test("detectMealSlots: 'Freshen Up before anniversary dinner' (wellness) → dinner NOT detected", () => {
  const result = detectMealSlots([
    { title: "Freshen Up before anniversary dinner", category: "wellness", startTime: "17:00" },
  ]);
  assertEquals(result.includes("dinner"), false);
});

Deno.test("detectMealSlots: 'Walk to lunch' (transport) → lunch NOT detected", () => {
  const result = detectMealSlots([
    { title: "Walk to lunch", category: "transport", startTime: "12:30" },
  ]);
  assertEquals(result.includes("lunch"), false);
});

Deno.test("detectMealSlots: 'Prep for dinner at hotel' (leisure) → dinner NOT detected", () => {
  const result = detectMealSlots([
    { title: "Prep for dinner at hotel", category: "leisure", startTime: "17:30" },
  ]);
  assertEquals(result.includes("dinner"), false);
});

Deno.test("detectMealSlots: 'Dinner at Da Ivo' (dining, 19:30) → dinner detected", () => {
  const result = detectMealSlots([
    { title: "Dinner at Da Ivo", category: "dining", startTime: "19:30" },
  ]);
  assertEquals(result.includes("dinner"), true);
});

Deno.test("detectMealSlots: 'Cooking class: pasta lunch' (food) → lunch detected", () => {
  const result = detectMealSlots([
    { title: "Cooking class: pasta lunch", category: "food", startTime: "12:00" },
  ]);
  assertEquals(result.includes("lunch"), true);
});

Deno.test("detectMealSlots: 'Heading to brunch at Sant Ambroeus' (transport) → brunch NOT detected", () => {
  const result = detectMealSlots([
    { title: "Heading to brunch at Sant Ambroeus", category: "transport", startTime: "10:30" },
  ]);
  // brunch maps to breakfast slot in MEAL_KEYWORDS; either way, must NOT be detected
  assertEquals(result.includes("breakfast"), false);
  assertEquals(result.includes("lunch"), false);
});
