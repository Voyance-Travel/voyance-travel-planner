/**
 * Regression tests for the systematic `partial` badge class — the AI schedules
 * a user-selected must-do under a wrapper-style title, transliteration, or
 * shortened venue name, and the exact/alias matcher misses it.
 *
 * See .lovable/plan.md "Add fuzzy venue matching to must-do coverage" and
 * mem://constraints/itinerary/must-do-coverage-injection.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assertMustDoCoverage, __test__ } from "../assert-must-do-coverage.ts";

const days = (acts: any[][]) =>
  acts.map((activities, i) => ({ dayNumber: i + 1, activities }));

// ── Wrapper-style titles ─────────────────────────────────────────────────
Deno.test("fuzzy: 'Dinner at Roscioli' satisfies user-typed 'Eat at Roscioli'", () => {
  const r = assertMustDoCoverage(
    days([[{ id: 'r1', title: 'Dinner at Roscioli', category: 'dining', startTime: '20:00', endTime: '22:00' }]]),
    ['Eat at Roscioli'],
  );
  assertEquals(r.missing, []);
  assertEquals(r.matchedActivityIds?.['Eat at Roscioli'], 'r1');
});

Deno.test("fuzzy: 'Pantheon Visit' satisfies 'Pantheon'", () => {
  const r = assertMustDoCoverage(
    days([[{ id: 'p', title: 'Pantheon Visit', category: 'sightseeing', startTime: '14:00', endTime: '15:00' }]]),
    ['Pantheon'],
  );
  assertEquals(r.missing, []);
});

Deno.test("fuzzy: 'Sagrada Familia Basilica Tour' satisfies 'Sagrada Familia'", () => {
  // Already covered by alias map — confirm fuzzy still agrees if alias removed.
  const r = assertMustDoCoverage(
    days([[{ id: 's', title: 'Skip-the-line Sagrada Familia Tour', category: 'cultural', startTime: '10:00', endTime: '12:00' }]]),
    ['Sagrada Familia'],
  );
  assertEquals(r.missing, []);
});

Deno.test("fuzzy: 'Topkapi' satisfies user-typed 'Topkapi Palace'", () => {
  const r = assertMustDoCoverage(
    days([[{ id: 't', title: 'Topkapi', category: 'museum', startTime: '09:00', endTime: '12:00' }]]),
    ['Topkapi Palace'],
  );
  assertEquals(r.missing, []);
});

// ── Negative cases (false-positive defenses) ─────────────────────────────
Deno.test("fuzzy: 'Galata Bridge Walk' does NOT satisfy 'Galata Tower'", () => {
  const r = assertMustDoCoverage(
    days([[{ id: 'g', title: 'Galata Bridge Walk', category: 'sightseeing', startTime: '10:00', endTime: '11:00' }]]),
    ['Galata Tower'],
  );
  assertEquals(r.missing, ['Galata Tower']);
});

Deno.test("fuzzy: 'Park Ciutadella Walk' does NOT satisfy 'Park Güell'", () => {
  const r = assertMustDoCoverage(
    days([[{ id: 'p', title: 'Park Ciutadella morning walk', category: 'sightseeing', startTime: '09:00', endTime: '10:30' }]]),
    ['Park Güell'],
  );
  assertEquals(r.missing, ['Park Güell']);
});

Deno.test("fuzzy: description prose mentioning landmark does NOT satisfy", () => {
  const r = assertMustDoCoverage(
    days([[{
      id: 'd', title: 'Trastevere wandering', category: 'explore',
      description: 'Stroll cobbled lanes near the Pantheon and admire the Vatican skyline.',
    }]]),
    ['Pantheon'],
  );
  assertEquals(r.missing, ['Pantheon']);
});

Deno.test("fuzzy: transport 'Travel to Roscioli' does NOT satisfy 'Eat at Roscioli'", () => {
  const r = assertMustDoCoverage(
    days([[{ id: 't', title: 'Travel to Roscioli', category: 'transport', startTime: '19:30', endTime: '19:45' }]]),
    ['Eat at Roscioli'],
  );
  assertEquals(r.missing, ['Eat at Roscioli']);
});

// ── Edit-distance transliteration ────────────────────────────────────────
Deno.test("fuzzyVenueMatch: 'Roscioli' ≈ 'Rosciolli' (typo)", () => {
  assertEquals(__test__.fuzzyVenueMatch('Roscioli', 'dinner at rosciolli'), true);
});

Deno.test("fuzzyVenueMatch: distinct landmarks do NOT collide", () => {
  assertEquals(__test__.fuzzyVenueMatch('Galata Tower', 'galata bridge'), false);
  assertEquals(__test__.fuzzyVenueMatch('Park Güell', 'park ciutadella'), false);
});

Deno.test("coreTokens: strips generic wrappers + stop words", () => {
  assertEquals(__test__.coreTokens('Skip-the-line Guided Tour of Sagrada Familia'), ['sagrada', 'familia']);
  assertEquals(__test__.coreTokens('Dinner at Roscioli'), ['roscioli']);
  assertEquals(__test__.coreTokens('Morning Visit to the Pantheon'), ['pantheon']);
});

Deno.test("coreTokens: preserves category nouns (so divergent qualifiers can disagree)", () => {
  // 'tower' / 'bridge' / 'cemetery' stay so single-shared-token matches across
  // multi-core names get rejected by the ≥2-shared rule.
  assertEquals(__test__.coreTokens('Galata Tower'), ['galata', 'tower']);
  assertEquals(__test__.coreTokens('Recoleta Cemetery'), ['recoleta', 'cemetery']);
});

