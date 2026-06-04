/**
 * KEYSTONE test — the protected-meal invariant.
 *
 * Asserts that a guard-guaranteed meal, once stamped, is NOT silently deleted
 * by a strip pass that previously ignored meal protection. Uses
 * pruneNonLogisticsAfterAirportTransfer as the representative deleter (it
 * dropped timeless/after-transfer dining with only an isLocked check).
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isProtectedMeal,
  stampMealProtection,
} from "../../../supabase/functions/_shared/meal-protection.ts";
import {
  pruneNonLogisticsAfterAirportTransfer,
} from "../../../supabase/functions/_shared/post-checkout-prune.ts";

Deno.test("isProtectedMeal recognizes the meal-guard tag", () => {
  assert(isProtectedMeal({ category: "dining", tags: ["dining", "dinner", "meal-guard"] }));
});

Deno.test("isProtectedMeal recognizes injector cost sources", () => {
  assert(isProtectedMeal({ category: "dining", cost: { amount: 30, source: "meal_guard_fallback" } }));
  assert(isProtectedMeal({ category: "dining", cost: { amount: 0, source: "meal_persist_invariant" } }));
});

Deno.test("isProtectedMeal recognizes the explicit metadata flag", () => {
  assert(isProtectedMeal({ category: "dining", metadata: { protectedMeal: true } }));
});

Deno.test("a plain LLM dining card is NOT protected", () => {
  assertEquals(isProtectedMeal({ category: "dining", title: "Dinner at Casa Botín" }), false);
});

Deno.test("stampMealProtection sets the lock_state + flag + tag", () => {
  const a: any = { category: "dining", title: "Dinner — find a local spot" };
  stampMealProtection(a);
  assertEquals(a.lock_state, "locked");
  assertEquals(a.metadata.protectedMeal, true);
  assert(Array.isArray(a.tags) && a.tags.includes("meal-guard"));
  assert(isProtectedMeal(a));
});

Deno.test("KEYSTONE: a protected meal survives the airport-transfer prune; an unprotected one is dropped", () => {
  const protectedDinner: any = { category: "dining", title: "Dinner at Casa Revuelta", startTime: "19:00", endTime: "20:30" };
  stampMealProtection(protectedDinner);

  const activities: any[] = [
    { category: "accommodation", title: "Checkout from Your Hotel", startTime: "07:00", endTime: "07:30" },
    { category: "transport", title: "Transfer to the Airport", startTime: "11:00", endTime: "11:45" },
    protectedDinner, // 19:00 — AFTER the transfer; would be pruned without protection
    { category: "dining", title: "Random Late Snack", startTime: "20:00", endTime: "20:45" }, // unprotected control
  ];

  const res = pruneNonLogisticsAfterAirportTransfer(activities, 4);

  // The protected meal must survive…
  assert(
    activities.some((a) => a.title === "Dinner at Casa Revuelta"),
    "protected meal was wrongly pruned",
  );
  // …while the unprotected after-transfer card is dropped (proves the prune still works).
  assert(
    !activities.some((a) => a.title === "Random Late Snack"),
    "unprotected after-transfer card should have been pruned",
  );
  assertEquals(res.prunedCount, 1);
});
