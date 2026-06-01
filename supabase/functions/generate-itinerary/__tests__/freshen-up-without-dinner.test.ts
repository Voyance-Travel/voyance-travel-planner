// Closes the Lisbon Day-2 class: the LLM places a "Freshen Up" / "Pre-Dinner"
// card in the dinner slot AND emits NO real dining card. The meal-guard must
// detect dinner missing and inject a real dining venue (it must NOT count
// the freshen-up as satisfying the dinner requirement).
//
// This test exercises `enforceRequiredMealsFinalGuard` end-to-end with a
// freshen-up in the 19:00 slot and a non-empty fallback pool — the same
// shape `action-generate-trip-day.ts` passes after the late-stage retry.
//
// Memory: see `[MEAL_FINAL_AUDIT]` sentinels in action-generate-trip-day.ts
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  enforceRequiredMealsFinalGuard,
  detectMealSlots,
} from "../day-validation.ts";

const FALLBACK_POOL = [
  { name: "Cervejaria Ramiro", address: "Av. Almirante Reis 1, Lisbon", mealType: "dinner" },
  { name: "Belcanto", address: "Largo de São Carlos 10, Lisbon", mealType: "dinner" },
  { name: "Time Out Market", address: "Av. 24 de Julho, Lisbon", mealType: "any" },
];

const mkAct = (over: any) => ({
  id: over.id || `a-${Math.random()}`,
  title: over.title,
  category: over.category,
  startTime: over.startTime,
  endTime: over.endTime,
  description: over.description ?? "",
  location: { name: "", address: "" },
  cost: { amount: 0, currency: "USD" },
  ...over,
});

Deno.test("Freshen-up in dinner slot with NO real dinner → guard injects dining card", () => {
  const activities = [
    mkAct({ id: "1", title: "Lunch at Cantinho do Avillez", category: "dining", startTime: "13:00", endTime: "14:30" }),
    mkAct({ id: "2", title: "Bike Tour around Belém", category: "activity", startTime: "15:00", endTime: "18:45" }),
    mkAct({
      id: "3",
      title: "Freshen Up at Hotel",
      category: "accommodation",
      startTime: "19:00",
      endTime: "19:30",
      description: "Exchange bike gear for evening attire.",
    }),
  ];

  // Pre-check: detectMealSlots must NOT see this as having dinner.
  const detectedPre = detectMealSlots(activities);
  assert(
    !detectedPre.includes("dinner"),
    `freshen-up at 19:00 must not satisfy dinner detection (got ${JSON.stringify(detectedPre)})`,
  );
  assert(detectedPre.includes("lunch"), "lunch must be detected");

  // Guard must inject a real dinner card.
  const result = enforceRequiredMealsFinalGuard(
    activities,
    ["lunch", "dinner"],
    2,
    "Lisbon",
    "USD",
    "full",
    FALLBACK_POOL,
    {},
  );

  assert(!result.alreadyCompliant, "guard should have run (dinner was missing)");
  assert(
    result.injectedMeals.includes("dinner"),
    `expected dinner injection, got ${JSON.stringify(result.injectedMeals)}`,
  );

  // Post-check: detectMealSlots must now see dinner.
  const detectedPost = detectMealSlots(result.activities as any[]);
  assert(
    detectedPost.includes("dinner"),
    `post-guard activities must contain a dinner card (got ${JSON.stringify(detectedPost)})`,
  );

  // The freshen-up must NOT have been mutated into a dining card — it remains
  // a separate accommodation row; the new dinner is a NEW activity.
  const freshen = (result.activities as any[]).find((a: any) => a.id === "3");
  assert(freshen, "freshen-up must still exist");
  assertEquals(freshen.category, "accommodation", "freshen-up category preserved");
});

Deno.test("Pre-Dinner Drinks card at 18:30 with no real dinner → guard still injects dinner", () => {
  const activities = [
    mkAct({ id: "1", title: "Breakfast at Manteigaria", category: "dining", startTime: "08:30", endTime: "09:30" }),
    mkAct({ id: "2", title: "Lunch at Time Out Market", category: "dining", startTime: "12:30", endTime: "14:00" }),
    mkAct({
      id: "3",
      title: "Pre-Dinner Drinks at Park Rooftop",
      category: "nightlife",
      startTime: "18:30",
      endTime: "19:30",
      description: "Sunset cocktails before dinner.",
    }),
  ];

  // Pre-check: rooftop drinks at 18:30 must NOT satisfy dinner.
  const detectedPre = detectMealSlots(activities);
  assert(
    !detectedPre.includes("dinner"),
    `pre-dinner drinks at 18:30 must not satisfy dinner detection (got ${JSON.stringify(detectedPre)})`,
  );

  const result = enforceRequiredMealsFinalGuard(
    activities,
    ["breakfast", "lunch", "dinner"],
    2,
    "Lisbon",
    "USD",
    "full",
    FALLBACK_POOL,
    {},
  );

  assert(!result.alreadyCompliant, "guard should fire");
  assert(
    result.injectedMeals.includes("dinner"),
    `expected dinner injection, got ${JSON.stringify(result.injectedMeals)}`,
  );

  const detectedPost = detectMealSlots(result.activities as any[]);
  assert(detectedPost.includes("dinner"), "dinner must be present after guard");
});
