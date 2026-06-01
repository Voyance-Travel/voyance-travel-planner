import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { buildPostGenOmitted, mergeOmittedMustDos, type OmittedMustDo } from "../omitted-must-dos-merge.ts";

Deno.test("buildPostGenOmitted: empty inputs return []", () => {
  assertEquals(buildPostGenOmitted({}), []);
  assertEquals(buildPostGenOmitted({ coverageMissing: [], injectionUnscheduled: [] }), []);
});

Deno.test("buildPostGenOmitted: injection failure wins over coverage for same title", () => {
  const out = buildPostGenOmitted({
    coverageMissing: ["Whisky Tasting"],
    injectionUnscheduled: ["Whisky Tasting"],
  });
  assertEquals(out.length, 1);
  assertEquals(out[0].reason, "no_compatible_slot");
});

Deno.test("buildPostGenOmitted: coverage-only emits low_priority_after_anchors", () => {
  const out = buildPostGenOmitted({ coverageMissing: ["Edinburgh Castle"] });
  assertEquals(out.length, 1);
  assertEquals(out[0].reason, "low_priority_after_anchors");
  assertEquals(out[0].mustDoTitle, "Edinburgh Castle");
});

Deno.test("buildPostGenOmitted: dedupes case-insensitively", () => {
  const out = buildPostGenOmitted({
    coverageMissing: ["whisky tasting", "WHISKY TASTING"],
    injectionUnscheduled: ["Whisky Tasting"],
  });
  assertEquals(out.length, 1);
});

Deno.test("mergeOmittedMustDos: planner entry wins on conflict", () => {
  const planner: OmittedMustDo[] = [
    { mustDoTitle: "Whisky Tasting", reason: "not_enough_time", detail: "Planner detail" },
  ];
  const postGen: OmittedMustDo[] = [
    { mustDoTitle: "whisky tasting", reason: "no_compatible_slot", detail: "PostGen detail" },
  ];
  const merged = mergeOmittedMustDos(planner, postGen);
  assertEquals(merged.length, 1);
  assertEquals(merged[0].reason, "not_enough_time");
  assertEquals(merged[0].detail, "Planner detail");
});

Deno.test("mergeOmittedMustDos: unions distinct entries", () => {
  const planner: OmittedMustDo[] = [
    { mustDoTitle: "A", reason: "duplicate" },
  ];
  const postGen: OmittedMustDo[] = [
    { mustDoTitle: "B", reason: "no_compatible_slot" },
  ];
  const merged = mergeOmittedMustDos(planner, postGen);
  assertEquals(merged.length, 2);
  assertEquals(merged.map((e) => e.mustDoTitle), ["A", "B"]);
});

Deno.test("mergeOmittedMustDos: null/undefined safe", () => {
  assertEquals(mergeOmittedMustDos(null, null), []);
  assertEquals(mergeOmittedMustDos(undefined, undefined), []);
  const postGen: OmittedMustDo[] = [{ mustDoTitle: "Only", reason: "other" }];
  assertEquals(mergeOmittedMustDos(null, postGen).length, 1);
});
