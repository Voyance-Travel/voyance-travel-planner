import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assertMustDoCoverage } from "../assert-must-do-coverage.ts";

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
