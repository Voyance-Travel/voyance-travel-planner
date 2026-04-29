// Tests for dietary-rules.ts — allergy / diet matching is a safety issue.
// Verifies fuzzy matching, alias expansion, severity escalation.

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  matchDietaryRule,
  expandDietaryAvoidList,
  getMaxDietarySeverity,
  DIETARY_RULES,
} from "./dietary-rules.ts";

// ---------- matchDietaryRule ----------

Deno.test("matchDietaryRule: exact key match", () => {
  assertEquals(matchDietaryRule("vegan")?.name, DIETARY_RULES.vegan.name);
  assertEquals(matchDietaryRule("halal")?.name, DIETARY_RULES.halal.name);
  assertEquals(matchDietaryRule("kosher")?.name, DIETARY_RULES.kosher.name);
});

Deno.test("matchDietaryRule: case-insensitive", () => {
  assertEquals(matchDietaryRule("VEGAN") !== null, true);
  assertEquals(matchDietaryRule("Vegan") !== null, true);
});

Deno.test("matchDietaryRule: '-free' suffix normalization", () => {
  assertEquals(matchDietaryRule("gluten-free") !== null, true);
  assertEquals(matchDietaryRule("gluten free") !== null, true);
  assertEquals(matchDietaryRule("gluten") !== null, true);
  assertEquals(matchDietaryRule("dairy") !== null, true);
});

Deno.test("matchDietaryRule: 'no X' phrasing normalization", () => {
  assertEquals(matchDietaryRule("no dairy") !== null, true);
  assertEquals(matchDietaryRule("no-gluten") !== null, true);
});

Deno.test("matchDietaryRule: explicit '-free' forms always match", () => {
  // Documented happy path: callers should pass canonical forms like "peanut-free".
  // Free-form phrases like "allergic to peanuts" do NOT currently match
  // (known limitation in the fuzzy matcher).
  assert(matchDietaryRule("peanut-free") !== null);
  assert(matchDietaryRule("shellfish-free") !== null);
  assert(matchDietaryRule("nut-free") !== null);
});

Deno.test("matchDietaryRule: aliases (lactose → dairy-free, celiac → gluten-free)", () => {
  assertEquals(
    matchDietaryRule("lactose intolerant"),
    DIETARY_RULES["dairy-free"],
  );
  assertEquals(matchDietaryRule("celiac"), DIETARY_RULES["gluten-free"]);
  assertEquals(matchDietaryRule("coeliac"), DIETARY_RULES["gluten-free"]);
  assertEquals(matchDietaryRule("plant-based"), DIETARY_RULES["vegan"]);
  assertEquals(matchDietaryRule("muslim"), DIETARY_RULES["halal"]);
  assertEquals(matchDietaryRule("jewish"), DIETARY_RULES["kosher"]);
});

Deno.test("matchDietaryRule: empty / unknown returns null", () => {
  assertEquals(matchDietaryRule(""), null);
  assertEquals(matchDietaryRule("   "), null);
  assertEquals(matchDietaryRule("xyznotreal"), null);
});

// ---------- expandDietaryAvoidList ----------

Deno.test("expandDietaryAvoidList: vegan expands to multiple terms", () => {
  const avoid = expandDietaryAvoidList(["vegan"]);
  assert(avoid.length > 0);
  // vegan should at minimum avoid meat / dairy / eggs in some form
  const joined = avoid.join(" ").toLowerCase();
  assert(
    /meat|beef|chicken|pork|fish|dairy|cheese|egg/.test(joined),
    "vegan avoid list must include animal products",
  );
});

Deno.test("expandDietaryAvoidList: empty input returns empty array", () => {
  assertEquals(expandDietaryAvoidList([]), []);
});

Deno.test("expandDietaryAvoidList: deduplicates across multiple restrictions", () => {
  const single = expandDietaryAvoidList(["vegan"]);
  const doubled = expandDietaryAvoidList(["vegan", "vegan"]);
  assertEquals(single.length, doubled.length, "duplicates must be removed");
});

Deno.test("expandDietaryAvoidList: unknown restrictions silently ignored", () => {
  const out = expandDietaryAvoidList(["xyznotreal", "vegan"]);
  assert(out.length > 0);
});

// ---------- getMaxDietarySeverity ----------

Deno.test("getMaxDietarySeverity: empty → 'none'", () => {
  assertEquals(getMaxDietarySeverity([]), "none");
});

Deno.test("getMaxDietarySeverity: returns highest severity across restrictions", () => {
  // peanut-free rule severity is critical; vegetarian is lower.
  // Mixing them must yield critical.
  const sev = getMaxDietarySeverity(["vegetarian", "peanut-free"]);
  assertEquals(sev, "critical");
});

Deno.test("getMaxDietarySeverity: unknown restrictions don't escalate severity", () => {
  assertEquals(getMaxDietarySeverity(["xyznotreal"]), "none");
});
