// Tests for budget-constraints.ts — deriveBudgetIntent decides spend style and
// splurge cadence which feeds the cost-reference table flow.

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  deriveBudgetIntent,
  buildBudgetConstraintsBlock,
  buildSkipListPrompt,
} from "./budget-constraints.ts";

// ---------- deriveBudgetIntent ----------

Deno.test("deriveBudgetIntent: 'moderate' tier normalizes to 'standard'", () => {
  const intent = deriveBudgetIntent("moderate", 0, 0);
  assertEquals(intent.tier, "standard");
});

Deno.test("deriveBudgetIntent: undefined tier defaults to standard", () => {
  const intent = deriveBudgetIntent(undefined, 0, 0);
  assertEquals(intent.tier, "standard");
});

Deno.test("deriveBudgetIntent: returns recognized BudgetTierLevel", () => {
  const tiers = ["budget", "economy", "standard", "comfort", "premium", "luxury"];
  for (const t of tiers) {
    const intent = deriveBudgetIntent(t, 0, 0);
    assertEquals(intent.tier, t);
  }
});

Deno.test("deriveBudgetIntent: high tier + frugal trait detects conflict", () => {
  // luxury + budgetTrait=+8 (frugal) is contradictory
  const intent = deriveBudgetIntent("luxury", 8, 0);
  assertEquals(
    intent.conflict,
    true,
    "luxury tier with frugal trait must flag conflict",
  );
  assert(typeof intent.conflictDetails === "string" && intent.conflictDetails.length > 0);
});

Deno.test("deriveBudgetIntent: low tier + luxury-seeking comfort detects conflict", () => {
  const intent = deriveBudgetIntent("budget", 0, 8);
  assertEquals(intent.conflict, true);
});

Deno.test("deriveBudgetIntent: low tier + splurge budget trait detects conflict", () => {
  // Aspirational budget traveler — was previously unflagged. Patched to surface conflict.
  const intent = deriveBudgetIntent("budget", -8, 0);
  assertEquals(intent.conflict, true);
  assert(
    typeof intent.conflictDetails === "string" &&
      intent.conflictDetails.toLowerCase().includes("splurge"),
  );
});

Deno.test("deriveBudgetIntent: aligned tier + traits reports no conflict", () => {
  const intent = deriveBudgetIntent("luxury", -5, 5);
  assertEquals(intent.conflict, false);
});

Deno.test("deriveBudgetIntent: priceSensitivity is a number", () => {
  const intent = deriveBudgetIntent("standard", 0, 0);
  assertEquals(typeof intent.priceSensitivity, "number");
});

Deno.test("deriveBudgetIntent: avoid + prioritize are arrays", () => {
  const intent = deriveBudgetIntent("luxury", 0, 5);
  assert(Array.isArray(intent.avoid));
  assert(Array.isArray(intent.prioritize));
});

Deno.test("deriveBudgetIntent: splurgeCadence has dinners + experiences counts", () => {
  const intent = deriveBudgetIntent("premium", 0, 0);
  assertEquals(typeof intent.splurgeCadence.dinners, "number");
  assertEquals(typeof intent.splurgeCadence.experiences, "number");
  assert(intent.splurgeCadence.dinners >= 0);
  assert(intent.splurgeCadence.experiences >= 0);
});

// ---------- buildBudgetConstraintsBlock ----------

Deno.test("buildBudgetConstraintsBlock: returns non-empty prompt for any tier", () => {
  const out = buildBudgetConstraintsBlock("standard", 0);
  assertEquals(typeof out, "string");
  assert(out.length > 0);
});

Deno.test("buildBudgetConstraintsBlock: luxury tier mentions premium/upscale concepts", () => {
  const out = buildBudgetConstraintsBlock("luxury", 0).toLowerCase();
  assert(
    /luxur|premium|upscale|fine|michelin|splurge/.test(out),
    "luxury prompt should reference upscale concepts",
  );
});

Deno.test("buildBudgetConstraintsBlock: budget tier mentions affordable concepts", () => {
  const out = buildBudgetConstraintsBlock("budget", 0).toLowerCase();
  assert(
    /budget|cheap|affordable|free|low.cost|inexpensive|value/.test(out),
    "budget prompt should reference value concepts",
  );
});

// ---------- buildSkipListPrompt ----------

Deno.test("buildSkipListPrompt: returns destination-specific prompt", () => {
  const out = buildSkipListPrompt("Paris");
  assertEquals(typeof out, "string");
  assert(out.length > 0);
  assert(out.includes("Paris"));
});
