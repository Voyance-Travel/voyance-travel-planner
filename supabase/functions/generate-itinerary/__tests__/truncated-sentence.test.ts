import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { trimToLastSentence } from "../pipeline/repair-day.ts";
import { applyValidationGate } from "../pipeline/validation-gate.ts";
import { FAILURE_CODES } from "../pipeline/types.ts";

Deno.test("trimToLastSentence: trims mid-sentence tail to last terminator", () => {
  const v = "Wander Cannaregio at golden hour and watch the canals shimmer. The light through the";
  const out = trimToLastSentence(v);
  assertEquals(out, "Wander Cannaregio at golden hour and watch the canals shimmer.");
});

Deno.test("trimToLastSentence: returns null when already terminated", () => {
  const v = "Wander Cannaregio at golden hour and watch the light fade.";
  assertEquals(trimToLastSentence(v), null);
});

Deno.test("trimToLastSentence: returns null when no terminator exists at all", () => {
  const v = "Wander Cannaregio at golden hour and watch the canals shimmer";
  assertEquals(trimToLastSentence(v), null);
});

Deno.test("trimToLastSentence: returns null when trimmed sentence < 40 chars", () => {
  const v = "Short sentence. The light through the canals shimmer in the evening";
  // First sentence is only 15 chars — too short, leave fragment alone.
  assertEquals(trimToLastSentence(v), null);
});

Deno.test("trimToLastSentence: handles non-string input", () => {
  assertEquals(trimToLastSentence(undefined), null);
  assertEquals(trimToLastSentence(null), null);
  assertEquals(trimToLastSentence(123), null);
});

Deno.test("validation gate: TRUNCATED_SENTENCE trims field on critical", () => {
  const day: any = {
    activities: [
      {
        id: "a1",
        title: "Wander Cannaregio",
        description: "Wander Cannaregio at golden hour and watch the canals shimmer. The light through the",
      },
    ],
  };
  const results = [
    {
      code: FAILURE_CODES.TRUNCATED_SENTENCE,
      severity: "critical" as const,
      message: "truncated",
      activityIndex: 0,
      field: "description",
      autoRepairable: true,
    },
  ];
  const out = applyValidationGate(day, results, { dayNumber: 1 });
  assertEquals(out.day.activities[0].description, "Wander Cannaregio at golden hour.");
  assertEquals(out.counters.blankedFields, 1);
  assertEquals(out.counters.forcedDowngrades, 1);
  assertEquals(out.verdict, "persist_forced");
});

Deno.test("validation gate: TRUNCATED_SENTENCE leaves field unchanged when no terminator", () => {
  const original = "Wander Cannaregio at golden hour and watch the canals";
  const day: any = {
    activities: [{ id: "a1", title: "Wander", description: original }],
  };
  const results = [
    {
      code: FAILURE_CODES.TRUNCATED_SENTENCE,
      severity: "critical" as const,
      message: "truncated",
      activityIndex: 0,
      field: "description",
      autoRepairable: true,
    },
  ];
  const out = applyValidationGate(day, results, { dayNumber: 1 });
  assertEquals(out.day.activities[0].description, original);
  assertEquals(out.counters.blankedFields, 0);
  // gate ran but did not blank — field preserved
  assert(out.verdict === "persist_forced");
});
