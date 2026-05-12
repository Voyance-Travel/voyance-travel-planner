import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  qualifiesAsLateNightlife,
  isLateNightlikeTail,
  LATE_NIGHTLIFE_TITLE_RE,
} from "../late-nightlife-predicate.ts";

Deno.test("vermutería title qualifies (Mallorca regression)", () => {
  assertEquals(LATE_NIGHTLIFE_TITLE_RE.test("La Rosa Vermutería"), true);
  assertEquals(
    qualifiesAsLateNightlife(
      { title: "Nightcap at La Rosa Vermutería", category: "drinks" },
      21 * 60 + 30,
      15,
    ),
    true,
  );
});

Deno.test("wine bar / bodega / taberna / pub all qualify", () => {
  for (const t of ["Wine Bar Z", "Bodega Salinas", "La Taberna", "The Pub"]) {
    assertEquals(LATE_NIGHTLIFE_TITLE_RE.test(t), true, t);
  }
});

Deno.test("DRINKS category qualifies", () => {
  assertEquals(
    qualifiesAsLateNightlife({ title: "Local spot", category: "DRINKS" }, null, null),
    true,
  );
});

Deno.test("time-anchored: start ≥21:00 + end in [00:00,02:30] qualifies regardless of title", () => {
  assertEquals(isLateNightlikeTail(21 * 60 + 30, 15), true);
  assertEquals(isLateNightlikeTail(22 * 60, 2 * 60 + 30), true);
  assertEquals(
    qualifiesAsLateNightlife(
      { title: "Tasting menu at Mystery Spot", category: "dining" },
      21 * 60,
      0,
    ),
    true,
  );
});

Deno.test("plain dinner ending 22:30 does NOT qualify", () => {
  assertEquals(isLateNightlikeTail(20 * 60, 22 * 60 + 30), false);
  assertEquals(
    qualifiesAsLateNightlife(
      { title: "Dinner at Refter", category: "dining" },
      20 * 60,
      22 * 60 + 30,
    ),
    false,
  );
});

Deno.test("early-evening start (<21:00) does NOT qualify even if end wraps", () => {
  assertEquals(isLateNightlikeTail(19 * 60, 30), false);
});
