import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  ensureDiningDescription,
  ensureDayDiningDescriptions,
  isDiningActivity,
  isTemplatedDiningDescription,
} from "../dining-description-backfill.ts";

Deno.test("isTemplatedDiningDescription detects meal-guard leak", () => {
  assertEquals(
    isTemplatedDiningDescription("Lunch at Gruuthuse Hof — a real local spot worth visiting"),
    true,
  );
  assertEquals(
    isTemplatedDiningDescription("Dinner at Refter — a real local spot worth visiting"),
    true,
  );
  // Plain "Dinner at X." also templated (no insider value).
  assertEquals(isTemplatedDiningDescription("Dinner at Refter."), true);
  // Real blurb with verb is NOT templated.
  assertEquals(
    isTemplatedDiningDescription("Order the cod cheeks and ask for a window table at sunset."),
    false,
  );
});

Deno.test("templated leak with no inline match → deterministic venue template (never blank)", () => {
  const act: any = {
    category: "dining",
    title: "Dinner at Refter",
    location: { name: "Refter" },
    description: "Dinner at Refter — a real local spot worth visiting",
  };
  const r = ensureDiningDescription(act, "Bruges");
  // No inline DB hit → falls through to deterministic venueTemplate.
  assertEquals(r.changed, true);
  assertEquals(r.source, "venueTemplate");
  assertEquals(typeof act.description, "string");
  assertEquals(act.description.length >= 30, true);
  // Must mention venue and contain an actionable verb.
  assertEquals(/Refter/.test(act.description), true);
  assertEquals(/(book|ask|order|try|request|don'?t miss|pick)/i.test(act.description), true);
});

Deno.test("dining card with empty description + venue in inline DB → filled from inline DB", () => {
  const act: any = {
    category: "dining",
    title: "Dinner at Septime",
    location: { name: "Septime", address: "80 Rue de Charonne, Paris" },
    description: "",
    personalization: { whyThisFits: "Some why" },
  };
  const r = ensureDiningDescription(act, "Paris");
  assertEquals(r.source, "fallback");
  assertEquals(r.changed, true);
  assertEquals(typeof act.description, "string");
  assertEquals(act.description.length > 20, true);
});

Deno.test("dining card with empty description + venue NOT in inline DB + whyThisFits → filled from whyThisFits", () => {
  const act: any = {
    category: "dining",
    title: "Dinner at Random Tiny Bistro That Does Not Exist Anywhere",
    location: { name: "Random Tiny Bistro That Does Not Exist Anywhere" },
    description: "",
    personalization: {
      whyThisFits:
        "Hand-picked because the traveler loves natural-wine bars in quiet corners.",
    },
  };
  const r = ensureDiningDescription(act, "Paris");
  assertEquals(r.source, "whyThisFits");
  assertEquals(r.changed, true);
  assertEquals(
    act.description,
    "Hand-picked because the traveler loves natural-wine bars in quiet corners.",
  );
});

Deno.test("dining card with empty description + nothing else → deterministic template (never blank)", () => {
  const act: any = {
    category: "dining",
    title: "Dinner at Mystery Spot",
    description: "",
  };
  const r = ensureDiningDescription(act, "Paris");
  assertEquals(r.source, "venueTemplate");
  assertEquals(r.changed, true);
  assertEquals(act.description.length >= 30, true);
  assertEquals(/Mystery Spot/.test(act.description), true);
});

Deno.test("dining card with no venue at all → deterministic template still actionable", () => {
  const act: any = {
    category: "dining",
    title: "Lunch",
    description: "",
  };
  const r = ensureDiningDescription(act, "Lisbon");
  assertEquals(r.source, "venueTemplate");
  assertEquals(act.description.length >= 30, true);
  assertEquals(/lunch/i.test(act.description), true);
});

Deno.test("non-dining activity is untouched even with empty description", () => {
  const act: any = {
    category: "museum",
    title: "Visit the Louvre",
    description: "",
    personalization: { whyThisFits: "Loves art." },
  };
  const r = ensureDiningDescription(act, "Paris");
  assertEquals(r.source, "noop");
  assertEquals(r.changed, false);
  assertEquals(act.description, "");
});

Deno.test("dining card with existing good description is untouched", () => {
  const original =
    "Beloved corner bistro with handwritten menus and natural wine.";
  const act: any = {
    category: "dining",
    title: "Dinner at Septime",
    description: original,
    personalization: { whyThisFits: "Different why text." },
  };
  const r = ensureDiningDescription(act, "Paris");
  assertEquals(r.source, "noop");
  assertEquals(r.changed, false);
  assertEquals(act.description, original);
});

Deno.test("isDiningActivity matches title-based meals without category", () => {
  assertEquals(
    isDiningActivity({ title: "Lunch at Le Comptoir" }),
    true,
  );
  assertEquals(isDiningActivity({ title: "Walk to the Eiffel Tower" }), false);
});

Deno.test("ensureDayDiningDescriptions returns counters", () => {
  const acts: any[] = [
    {
      category: "dining",
      title: "Dinner at Septime",
      location: { name: "Septime" },
      description: "",
    },
    {
      category: "dining",
      title: "Lunch at Unknown Place",
      description: "",
      personalization: {
        whyThisFits: "Picked because traveler wanted casual lunches.",
      },
    },
    { category: "museum", title: "Louvre", description: "" },
  ];
  const c = ensureDayDiningDescriptions(acts, "Paris");
  assertEquals(c.scanned, 2);
  assertEquals(c.fallback, 1);
  assertEquals(c.whyThisFits, 1);
});
