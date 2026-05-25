// trace-recorder-withStage.test.ts — locks the withStage contract using NoopTrace.
// NoopTrace passes the fn through unchanged so we can assert ctx mutations,
// nested stages, error propagation, and output capture work as documented.
import { assertEquals, assert, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { noopTrace, withStage } from "../trace-recorder.ts";

Deno.test("withStage returns the fn result", async () => {
  const t = noopTrace();
  const out = await withStage(t, "stage_a", {}, () => 42);
  assertEquals(out, 42);
});

Deno.test("withStage captures outputs + notes from ctx", async () => {
  const t = noopTrace();
  let capturedNotes: string[] = [];
  let capturedOutputs: any = null;
  const out = await withStage(t, "validate_day", { dayNumber: 2, inputs: { activities: 7 } }, (ctx) => {
    ctx.outputs = { codes: ["MEAL_WINDOW"], count: 1 };
    ctx.notes.push("flagged 1 validator code");
    capturedNotes = ctx.notes;
    capturedOutputs = ctx.outputs;
    return ctx.outputs;
  });
  assertEquals(out.count, 1);
  assertEquals(capturedNotes, ["flagged 1 validator code"]);
  assertEquals(capturedOutputs.codes[0], "MEAL_WINDOW");
});

Deno.test("withStage propagates thrown errors", async () => {
  const t = noopTrace();
  await assertRejects(
    () => withStage(t, "boom", {}, () => { throw new Error("nope"); }),
    Error,
    "nope",
  );
});

Deno.test("withStage supports nesting", async () => {
  const t = noopTrace();
  const order: string[] = [];
  await withStage(t, "outer", {}, async () => {
    order.push("outer-in");
    await withStage(t, "inner", { dayNumber: 1 }, () => {
      order.push("inner");
    });
    order.push("outer-out");
  });
  assertEquals(order, ["outer-in", "inner", "outer-out"]);
});

Deno.test("withStage accepts async fn", async () => {
  const t = noopTrace();
  const out = await withStage(t, "async_stage", {}, async (ctx) => {
    await new Promise((r) => setTimeout(r, 1));
    ctx.outputs = { ok: true };
    return "done";
  });
  assertEquals(out, "done");
});

Deno.test("withStage status defaults left to ctx (no behavior coupling)", async () => {
  const t = noopTrace();
  await withStage(t, "stage", {}, (ctx) => {
    ctx.status = "warn";
    assert(ctx.status === "warn");
  });
});
