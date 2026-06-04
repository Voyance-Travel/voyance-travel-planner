/**
 * Golden-Fixture Scenario Tests
 *
 * Composes the rule stack against realistic full-day fixtures to prove that
 * Core memory rules don't conflict when stacked. Each fixture represents a
 * common production shape; each assertion references the exact Core rule
 * it enforces.
 *
 * Pure: no AI, no DB, no network. Fast (<10ms per scenario).
 */

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  expectExactlyOneDinnerAfter18,
  expectThreeMealsOnFullDay,
  expectAllLockedSurvive,
  expectNoActivityWithinDepartureBuffer,
  expectDietaryCompliant,
  expectAllCostsAreNumericOrZero,
  parseTime,
  findDinners,
  type FixtureActivity,
} from "./__fixtures__/assertions.ts";

import { tokyoLuxuryLocked } from "./__fixtures__/tokyo-luxury-locked.ts";
import { parisBudgetVegetarian } from "./__fixtures__/paris-budget-vegetarian.ts";
import { romeArrivalDay } from "./__fixtures__/rome-arrival-day.ts";
import { lisbonDepartureDay } from "./__fixtures__/lisbon-departure-day.ts";
import { barcelonaMultiCity } from "./__fixtures__/barcelona-multicity.ts";

import { isChainRestaurant } from "./day-validation.ts";
import { applyAnchorsWin } from "./action-save-itinerary.ts";

// =============================================================================
// SCENARIO 1: Tokyo Luxury + Locked Dinners + Peanut Allergy
// =============================================================================
Deno.test("scenario [tokyo-luxury-locked]: Meal Rules — exactly one dinner ≥ 18:00", () => {
  expectExactlyOneDinnerAfter18(tokyoLuxuryLocked.day.activities, tokyoLuxuryLocked.scenario);
});

Deno.test("scenario [tokyo-luxury-locked]: Meal Rules — three meals on full day", () => {
  expectThreeMealsOnFullDay(tokyoLuxuryLocked.day.activities, tokyoLuxuryLocked.scenario);
});

Deno.test("scenario [tokyo-luxury-locked]: Universal Locking — locked Sukiyabashi survives applyAnchorsWin", () => {
  // Simulate AI cleanup that drops the locked dinner; anchor must restore it.
  const stripped = tokyoLuxuryLocked.day.activities.filter((a) => !a.isLocked);
  const days = [
    { dayNumber: 1, activities: [] },
    { dayNumber: 2, activities: [] },
    { dayNumber: 3, activities: stripped },
  ];
  const anchors = [{
    dayNumber: 3,
    title: "Dinner at Sukiyabashi Jiro",
    startTime: "19:00",
    endTime: "21:00",
    category: "dining",
    lockedSource: "manual",
    venueName: "Sukiyabashi Jiro",
  }];
  const result = applyAnchorsWin(days, anchors);
  assertEquals(result.restored, 1, "locked dinner must be re-injected");
  expectAllLockedSurvive(
    tokyoLuxuryLocked.day.activities,
    result.days[2].activities,
    tokyoLuxuryLocked.scenario,
  );
});

Deno.test("scenario [tokyo-luxury-locked]: Dietary — no peanut/satay/thai in any title", () => {
  expectDietaryCompliant(
    tokyoLuxuryLocked.day.activities,
    [...tokyoLuxuryLocked.dietaryRestrictions],
    tokyoLuxuryLocked.scenario,
  );
});

Deno.test("scenario [tokyo-luxury-locked]: Cost Integrity — all costs numeric and ≥ 0", () => {
  expectAllCostsAreNumericOrZero(tokyoLuxuryLocked.day.activities, tokyoLuxuryLocked.scenario);
});

Deno.test("scenario [tokyo-luxury-locked]: Believable Human — explicit Return to Hotel before dinner", () => {
  const acts = tokyoLuxuryLocked.day.activities;
  const returnIdx = acts.findIndex((a) => /return to hotel/i.test(a.title));
  const dinnerIdx = acts.findIndex((a) => /dinner/i.test(a.title));
  assert(returnIdx >= 0, "expected explicit Return to Hotel activity");
  assert(returnIdx < dinnerIdx, "Return to Hotel must precede dinner");
});

// =============================================================================
// SCENARIO 2: Paris Budget Vegetarian
// =============================================================================
Deno.test("scenario [paris-budget-vegetarian]: Meal Rules — exactly one dinner ≥ 18:00", () => {
  expectExactlyOneDinnerAfter18(parisBudgetVegetarian.day.activities, parisBudgetVegetarian.scenario);
});

Deno.test("scenario [paris-budget-vegetarian]: Meal Rules — three meals on full day", () => {
  expectThreeMealsOnFullDay(parisBudgetVegetarian.day.activities, parisBudgetVegetarian.scenario);
});

Deno.test("scenario [paris-budget-vegetarian]: Dietary — zero meat/fish/shellfish in titles", () => {
  expectDietaryCompliant(
    parisBudgetVegetarian.day.activities,
    [...parisBudgetVegetarian.dietaryRestrictions],
    parisBudgetVegetarian.scenario,
  );
});

Deno.test("scenario [paris-budget-vegetarian]: Density — at least 5 core activities", () => {
  const core = parisBudgetVegetarian.day.activities.filter(
    (a) => !["transport", "logistics", "flight", "accommodation"].includes((a.category || "").toLowerCase()),
  );
  assert(core.length >= 5, `expected ≥5 core activities, got ${core.length}`);
});

Deno.test("scenario [paris-budget-vegetarian]: No chain restaurants in dining venues", () => {
  const dining = parisBudgetVegetarian.day.activities.filter(
    (a) => (a.category || "").toLowerCase() === "dining",
  );
  for (const d of dining) {
    assert(
      !isChainRestaurant(d.title || ""),
      `[${parisBudgetVegetarian.scenario}] dining "${d.title}" matched chain blocklist`,
    );
  }
});

// =============================================================================
// SCENARIO 3: Rome Arrival Day
// =============================================================================
Deno.test("scenario [rome-arrival-day]: no leisure activities before 15:30 settle buffer", () => {
  const earlyLeisure = romeArrivalDay.day.activities.filter((a) => {
    const cat = (a.category || "").toLowerCase();
    if (["flight", "transport", "logistics"].includes(cat)) return false;
    return parseTime(a.startTime) < 15 * 60 + 30;
  });
  assertEquals(earlyLeisure.length, 0, `[${romeArrivalDay.scenario}] leisure scheduled too early: ${earlyLeisure.map((e) => e.title).join(", ")}`);
});

Deno.test("scenario [rome-arrival-day]: exactly one dinner, no breakfast required", () => {
  expectExactlyOneDinnerAfter18(romeArrivalDay.day.activities, romeArrivalDay.scenario);
  const breakfast = romeArrivalDay.day.activities.filter((a) => /breakfast/i.test(a.title));
  assertEquals(breakfast.length, 0, "arrival day should not have breakfast pre-arrival");
});

Deno.test("scenario [rome-arrival-day]: hotel check-in precedes first leisure activity", () => {
  const acts = romeArrivalDay.day.activities;
  const checkin = acts.findIndex((a) => /check.?in/i.test(a.title));
  const firstLeisure = acts.findIndex((a) =>
    !["flight", "transport", "logistics"].includes((a.category || "").toLowerCase()) &&
    !/check.?in/i.test(a.title)
  );
  assert(checkin >= 0, "expected explicit check-in");
  assert(checkin < firstLeisure, "check-in must precede first leisure activity");
});

// =============================================================================
// SCENARIO 4: Lisbon Departure Day
// =============================================================================
Deno.test("scenario [lisbon-departure-day]: Logistics Protocol — no leisure within 180m flight buffer", () => {
  expectNoActivityWithinDepartureBuffer(
    lisbonDepartureDay.day.activities,
    lisbonDepartureDay.returnDepartureTime24,
    180,
    lisbonDepartureDay.scenario,
  );
});

Deno.test("scenario [lisbon-departure-day]: no dinner on departure day (flight at 19:00)", () => {
  const dinners = findDinners(lisbonDepartureDay.day.activities);
  assertEquals(dinners.length, 0, `expected no dinner, found ${dinners.map((d) => d.title).join(", ")}`);
});

Deno.test("scenario [lisbon-departure-day]: Return to Hotel before transfer to airport", () => {
  const acts = lisbonDepartureDay.day.activities;
  const ret = acts.findIndex((a) => /return to hotel|hotel.*pack/i.test(a.title));
  const transfer = acts.findIndex((a) => /transfer/i.test(a.title));
  assert(ret >= 0, "expected explicit Return to Hotel");
  assert(transfer > ret, "transfer must come after Return to Hotel");
});

// =============================================================================
// SCENARIO 5: Barcelona Multi-City Hotel-Change Day
// =============================================================================
Deno.test("scenario [barcelona-multicity]: old hotel checkout precedes new hotel check-in", () => {
  const acts = barcelonaMultiCity.day.activities;
  const checkout = acts.findIndex((a) => /check.?out/i.test(a.title));
  const checkin = acts.findIndex((a) => /check.?in/i.test(a.title));
  assert(checkout >= 0, "expected explicit checkout");
  assert(checkin >= 0, "expected explicit check-in");
  assert(checkout < checkin, "checkout must precede check-in");
});

Deno.test("scenario [barcelona-multicity]: train transit precedes new-city activities", () => {
  const acts = barcelonaMultiCity.day.activities;
  const train = acts.findIndex((a) => /train.*barcelona/i.test(a.title));
  const newCityActivity = acts.findIndex((a) => /eixample|gracia|cataluna|cervecer/i.test(a.title));
  assert(train >= 0, "expected train activity");
  assert(newCityActivity > train, "new-city activities must come after train arrival");
});

Deno.test("scenario [barcelona-multicity]: Logistics Protocol — no leisure within 120m train buffer", () => {
  // Train at 11:00 → cutoff 09:00. Pre-train activities should all be transport/logistics/dining.
  const cutoff = parseTime("11:00") - 120;
  const violators = barcelonaMultiCity.day.activities.filter((a) => {
    const t = parseTime(a.startTime);
    if (t >= parseTime("11:00")) return false; // post-train OK
    const cat = (a.category || "").toLowerCase();
    if (["transport", "logistics", "flight", "dining"].includes(cat)) return false;
    return t >= cutoff;
  });
  assertEquals(violators.length, 0, `pre-train leisure within buffer: ${violators.map((v) => v.title).join(", ")}`);
});

Deno.test("scenario [barcelona-multicity]: exactly one dinner ≥ 18:00 in new city", () => {
  expectExactlyOneDinnerAfter18(barcelonaMultiCity.day.activities, barcelonaMultiCity.scenario);
});

Deno.test("scenario [barcelona-multicity]: Cost Integrity — all costs numeric and ≥ 0", () => {
  expectAllCostsAreNumericOrZero(barcelonaMultiCity.day.activities, barcelonaMultiCity.scenario);
});
