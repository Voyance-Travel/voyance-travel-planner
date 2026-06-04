// Save-time departure-day enforcement contract tests.
// Locks the meal-policy re-derive cases that action-save-itinerary STEP 2 +
// STEP 2.6 invariant depend on, plus the §15z drop the new STEP 2.65 calls.
// See mem://constraints/itinerary/departure-day-save-time-enforcement
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { deriveMealPolicy } from "../meal-policy.ts";
import { enforceDepartureDayLogistics } from "../pipeline/repair-day.ts";

// Case A: stale cache on afternoon departure.
// Cache built without flight info → midday_departure + [breakfast, lunch].
// Fresh derive with depTime=15:05 → afternoon_departure + [breakfast].
// The save-time reconciliation MUST trust fresh.
Deno.test("Case A: dep 15:05 fresh policy is afternoon_departure / breakfast-only", () => {
  const fresh = deriveMealPolicy({
    dayNumber: 4,
    totalDays: 4,
    isFirstDay: false,
    isLastDay: true,
    departureTime24: "15:05",
  });
  assertEquals(fresh.dayMode, "afternoon_departure");
  assertEquals(fresh.requiredMeals, ["breakfast"]);

  // Cache built without dep info would be:
  const stale = deriveMealPolicy({
    dayNumber: 4,
    totalDays: 4,
    isFirstDay: false,
    isLastDay: true,
  });
  assertEquals(stale.dayMode, "midday_departure");
  assertEquals(stale.requiredMeals, ["breakfast", "lunch"]);

  // Save-time logic compares sorted CSVs; assert they truly disagree so the
  // re-derive branch fires.
  const cachedCsv = stale.requiredMeals.slice().sort().join(",");
  const freshCsv = fresh.requiredMeals.slice().sort().join(",");
  assertEquals(cachedCsv === freshCsv, false, "policies must disagree to trigger re-derive");
});

// Case B: §15z drops manually-added untimed dining card on departure day.
// This is what STEP 2.65 calls into.
Deno.test("Case B: §15z drops untimed dining at save-time net", () => {
  const acts: any[] = [
    { id: "bk", title: "Breakfast at Hotel", category: "dining", startTime: "08:30", endTime: "09:15" },
    { id: "co", title: "Hotel Checkout", category: "accommodation", startTime: "11:00", endTime: "11:30" },
    { id: "floating-lunch", title: "Lunch — find a local spot in Casablanca", category: "dining" }, // no time
  ];
  const res = enforceDepartureDayLogistics({
    activities: acts,
    dayNumber: 4,
    isLastDay: true,
    returnDepartureTime24: "15:05",
    airportTransferMinutes: 45,
    lockedIds: new Set<string>(),
    hotelName: "Casablanca Marriott",
    hotelAddress: "",
  } as any);
  const titles = res.activities.map((a: any) => a.title);
  assertEquals(
    titles.some((t: string) => /find a local spot/.test(t)),
    false,
    "untimed floating lunch must be dropped",
  );
  const drop = res.repairs.find((r: any) => r.action === "final_enforce_dropped_untimed_dining");
  assertEquals(!!drop, true, "repair record present");
});

// Case C: very early departure → empty required meals.
Deno.test("Case C: dep 09:00 fresh policy is early_departure with no meals", () => {
  const fresh = deriveMealPolicy({
    dayNumber: 4,
    totalDays: 4,
    isFirstDay: false,
    isLastDay: true,
    departureTime24: "09:00",
  });
  assertEquals(fresh.dayMode, "early_departure");
  assertEquals(fresh.requiredMeals, []);
});

// Sanity: midday departure stays breakfast-only (12:00–15:00 band).
Deno.test("dep 13:00 fresh policy is midday_departure / breakfast-only", () => {
  const fresh = deriveMealPolicy({
    dayNumber: 4,
    totalDays: 4,
    isFirstDay: false,
    isLastDay: true,
    departureTime24: "13:00",
  });
  assertEquals(fresh.dayMode, "midday_departure");
  assertEquals(fresh.requiredMeals, ["breakfast"]);
});
