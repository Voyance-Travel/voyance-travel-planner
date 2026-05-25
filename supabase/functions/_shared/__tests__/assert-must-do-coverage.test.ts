import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assertMustDoCoverage, __test__ } from "../assert-must-do-coverage.ts";

const days = (acts: any[][]) => acts.map((activities, i) => ({ dayNumber: i + 1, activities }));

Deno.test("coverage: all must-dos scheduled (Rome happy path)", () => {
  const result = assertMustDoCoverage(
    days([
      [{ title: "Colosseum + Roman Forum tour", category: "sightseeing" }],
      [{ title: "Vatican Museums & Sistine Chapel", category: "museum" }, { title: "St. Peter's Basilica", category: "religious" }],
      [{ title: "Pantheon visit", category: "landmark" }, { title: "Trevi Fountain photo stop", category: "sightseeing" }],
    ]),
    ["Colosseum", "Pantheon", "Trevi Fountain", "Vatican City (St. Peter's Basilica & Vatican Museums)"]
  );
  assertEquals(result.missing.length, 0);
  assertEquals(result.scheduled.length, 4);
});

Deno.test("coverage: Rome bug — 3 of 4 missing", () => {
  const result = assertMustDoCoverage(
    days([
      [{ title: "Welcome dinner at Roscioli", category: "dining" }, { title: "Colosseum at night", category: "sightseeing" }],
      [{ title: "Trastevere food tour", category: "dining" }],
      [{ title: "Prati neighborhood lunch", category: "dining" }],
    ]),
    ["Colosseum", "Pantheon", "Trevi Fountain", "Vatican City"]
  );
  assertEquals(result.scheduled, ["Colosseum"]);
  assertEquals(result.missing.length, 3);
  assertEquals(result.missing.sort(), ["Pantheon", "Trevi Fountain", "Vatican City"].sort());
});

Deno.test("coverage: vatican alias matches St. Peter's", () => {
  const result = assertMustDoCoverage(
    days([[{ title: "St. Peter's Basilica audio tour", category: "religious" }]]),
    ["Vatican City"]
  );
  assertEquals(result.missing, []);
  assertEquals(result.scheduled, ["Vatican City"]);
});

Deno.test("coverage: matches venue field even when title is generic", () => {
  const result = assertMustDoCoverage(
    days([[{ title: "Morning sightseeing", venue: "The Pantheon" }]]),
    ["Pantheon"]
  );
  assertEquals(result.missing, []);
});

Deno.test("coverage: empty mustDos returns total 0", () => {
  const result = assertMustDoCoverage(days([[{ title: "anything" }]]), []);
  assertEquals(result.total, 0);
  assertEquals(result.missing, []);
  assertEquals(result.scheduled, []);
});

// === New tests covering the false-positive class (Rome d18b2e8a) ============

Deno.test("coverage: 'Travel to …' transit prefix does NOT match 'Trevi'", () => {
  const result = assertMustDoCoverage(
    days([[{ title: "Travel to Piazza Navona", category: "transit" }]]),
    ["Trevi Fountain"]
  );
  assertEquals(result.scheduled, []);
  assertEquals(result.missing, ["Trevi Fountain"]);
});

Deno.test("coverage: description mentioning a landmark does NOT count as scheduled", () => {
  const result = assertMustDoCoverage(
    days([[{
      title: "Trastevere wandering",
      category: "explore",
      description: "Stroll cobbled lanes near the Pantheon and admire the Vatican skyline.",
    }]]),
    ["Pantheon", "Vatican City"]
  );
  // Description must NOT satisfy coverage — venue identity only.
  assertEquals(result.scheduled, []);
  assertEquals(result.missing.sort(), ["Pantheon", "Vatican City"].sort());
});

Deno.test("coverage: address mentioning a landmark does NOT count as scheduled", () => {
  const result = assertMustDoCoverage(
    days([[{
      title: "Hotel de Russie luggage drop",
      category: "accommodation",
      location: { name: "Hotel de Russie", address: "Via del Babuino, near the Pantheon" },
    }]]),
    ["Pantheon"]
  );
  assertEquals(result.scheduled, []);
  assertEquals(result.missing, ["Pantheon"]);
});

Deno.test("coverage: Vatican Museums alone satisfies parenthesised Vatican must-do", () => {
  const result = assertMustDoCoverage(
    days([[{ title: "Vatican Museums morning visit", category: "museum" }]]),
    ["Vatican City (St. Peter's Basilica & Vatican Museums)"]
  );
  assertEquals(result.missing, []);
});

Deno.test("coverage: matchedActivityIds returns id on hit, null on miss", () => {
  const result = assertMustDoCoverage(
    days([[
      { id: "act-colosseum-1", title: "Colosseum tour", category: "sightseeing" },
    ]]),
    ["Colosseum", "Pantheon"]
  );
  assertEquals(result.matchedActivityIds?.["Colosseum"], "act-colosseum-1");
  assertEquals(result.matchedActivityIds?.["Pantheon"], null);
});

Deno.test("matchesWord: respects word boundaries", () => {
  assertEquals(__test__.matchesWord("travel to piazza navona", "trevi"), false);
  assertEquals(__test__.matchesWord("trevi fountain photo stop", "trevi"), true);
  assertEquals(__test__.matchesWord("trevi-themed cafe", "trevi"), true); // hyphen = word boundary
  assertEquals(__test__.matchesWord("pantheonic vibes", "pantheon"), false);
});
