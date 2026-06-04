/**
 * Shared scenario assertion helpers.
 * Each helper enforces one of the Core memory rules and is used across
 * multiple golden-fixture tests in scenario.test.ts.
 */

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { ValidationResult } from "../pipeline/types.ts";
import { matchDietaryRule } from "../dietary-rules.ts";

// Minimal activity shape used in fixtures (subset of StrictActivityMinimal).
export interface FixtureActivity {
  id?: string;
  title: string;
  category: string;
  startTime: string;
  endTime: string;
  venue?: { name?: string };
  cost?: { amount?: number; currency?: string };
  isLocked?: boolean;
  locked?: boolean;
  lockedSource?: string;
  bookingRequired?: boolean;
  freeActivity?: boolean;
}

export interface FixtureDay {
  dayNumber: number;
  activities: FixtureActivity[];
}

// ---------- core helpers ----------

export function parseTime(t?: string): number {
  if (!t) return 0;
  const m = t.match(/(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 0;
}

export function findDinners(activities: FixtureActivity[]): FixtureActivity[] {
  return activities.filter((a) => {
    const cat = (a.category || "").toLowerCase();
    const title = (a.title || "").toLowerCase();
    return (cat === "dining" || cat === "meal") &&
      (title.includes("dinner") || parseTime(a.startTime) >= 18 * 60);
  });
}

// ---------- Meal Rules ----------
export function expectExactlyOneDinnerAfter18(activities: FixtureActivity[], scenario: string) {
  const dinners = findDinners(activities);
  assertEquals(
    dinners.length,
    1,
    `[${scenario}] expected exactly one dinner, found ${dinners.length}: ${dinners.map((d) => d.title).join(", ")}`,
  );
  const minutes = parseTime(dinners[0].startTime);
  assert(
    minutes >= 18 * 60,
    `[${scenario}] dinner "${dinners[0].title}" starts at ${dinners[0].startTime}, expected ≥ 18:00`,
  );
}

export function expectThreeMealsOnFullDay(activities: FixtureActivity[], scenario: string) {
  const titles = activities.map((a) => (a.title || "").toLowerCase());
  const breakfast = titles.some((t) => /breakfast|brunch/.test(t));
  const lunch = titles.some((t) => /lunch/.test(t));
  const dinner = titles.some((t) => /dinner|supper/.test(t));
  assert(breakfast, `[${scenario}] missing breakfast`);
  assert(lunch, `[${scenario}] missing lunch`);
  assert(dinner, `[${scenario}] missing dinner`);
}

// ---------- Universal Locking ----------
export function expectAllLockedSurvive(
  inputActivities: FixtureActivity[],
  outputActivities: FixtureActivity[],
  scenario: string,
) {
  const lockedIn = inputActivities.filter((a) => a.isLocked || a.locked);
  for (const locked of lockedIn) {
    const survived = outputActivities.find(
      (a) =>
        (a.title || "").toLowerCase().includes((locked.title || "").toLowerCase()) ||
        (locked.title || "").toLowerCase().includes((a.title || "").toLowerCase()),
    );
    assert(
      survived,
      `[${scenario}] locked activity "${locked.title}" was dropped from output`,
    );
  }
}

// ---------- Logistics Protocol ----------
export function expectNoActivityWithinDepartureBuffer(
  activities: FixtureActivity[],
  departureTime24: string,
  bufferMinutes: number,
  scenario: string,
) {
  const dep = parseTime(departureTime24);
  const cutoff = dep - bufferMinutes;
  const violators = activities.filter((a) => {
    const cat = (a.category || "").toLowerCase();
    if (cat === "transport" || cat === "logistics" || cat === "flight") return false;
    return parseTime(a.startTime) >= cutoff;
  });
  assertEquals(
    violators.length,
    0,
    `[${scenario}] ${violators.length} activities scheduled within ${bufferMinutes}m of ${departureTime24}: ${violators.map((v) => v.title).join(", ")}`,
  );
}

// ---------- Dietary Enforcement ----------
export function expectDietaryCompliant(
  activities: FixtureActivity[],
  restrictions: string[],
  scenario: string,
) {
  for (const restriction of restrictions) {
    const rule = matchDietaryRule(restriction);
    if (!rule) continue;
    for (const a of activities) {
      const text = `${a.title || ""} ${a.venue?.name || ""}`.toLowerCase();
      // Check no avoidIngredients appear as standalone words
      for (const ing of rule.avoidIngredients) {
        const ingNorm = ing.toLowerCase();
        // word-boundary check to avoid false positives ("ham" in "hamburger" is intentional miss for now)
        const re = new RegExp(`\\b${ingNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        assert(
          !re.test(text),
          `[${scenario}] activity "${a.title}" contains forbidden ingredient "${ing}" for ${restriction}`,
        );
      }
    }
  }
}

// ---------- Cost Integrity ----------
export function expectAllCostsAreNumericOrZero(activities: FixtureActivity[], scenario: string) {
  for (const a of activities) {
    if (a.cost === undefined) continue; // missing is fine; AI estimation is what we forbid
    const amt = a.cost.amount;
    assert(
      typeof amt === "number" && amt >= 0,
      `[${scenario}] activity "${a.title}" has invalid cost: ${JSON.stringify(a.cost)}`,
    );
  }
}

// ---------- Validation result helpers ----------
export function expectNoCriticalErrors(results: ValidationResult[], scenario: string) {
  const critical = results.filter((r) => r.severity === "critical");
  assertEquals(
    critical.length,
    0,
    `[${scenario}] expected no critical validation errors, got: ${critical.map((c) => `${c.code}: ${c.message}`).join("; ")}`,
  );
}

export function expectNoFailureCode(
  results: ValidationResult[],
  code: string,
  scenario: string,
) {
  const matches = results.filter((r) => r.code === code);
  assertEquals(
    matches.length,
    0,
    `[${scenario}] expected no ${code} failures, got: ${matches.map((m) => m.message).join("; ")}`,
  );
}
