/**
 * Tests for the unified scrubActivity boundary. Covers the 4 blocker classes:
 *   (a) cross-city venue → downgrade
 *   (b) prompt-artifact in title → strip
 *   (c) reservation-urgency body leak → strip
 *   (d) bookend / meal suffix / fragments → covered via composed helpers
 */
import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { scrubActivity, opsHadChange, formatOps } from "../scrub-activity.ts";

Deno.test("scrubActivity: strips Reservation Urgency body leak", () => {
  const a: any = {
    title: "Dinner at Quadri",
    description: "Reservation Urgency: . Beautiful canal-side spot.",
  };
  const ops = scrubActivity(a, { destination: "Venice, Italy" });
  assert(opsHadChange(ops));
  assertEquals(ops.bodyLeak, 1);
  assert(!a.description.includes("Reservation Urgency"));
});

Deno.test("scrubActivity: strips title prompt leak", () => {
  const a: any = { title: "Reservation Urgency: ." };
  const ops = scrubActivity(a, { destination: "Venice, Italy" });
  assertEquals(ops.titleLeak, 1);
  assert(a.title === "Activity" || !/reservation urgency/i.test(a.title));
});

Deno.test("scrubActivity: strips meal suffix from venue name", () => {
  const a: any = {
    title: "Lunch at Trattoria",
    location: { name: "Trattoria al Gatto Nero (Lunch)" },
  };
  const ops = scrubActivity(a, { destination: "Venice, Italy" });
  assertEquals(ops.mealSuffix, 1);
  assert(!a.location.name.includes("(Lunch)"));
});

Deno.test("scrubActivity: downgrades wrong-city dining venue", () => {
  const a: any = {
    title: "Dinner at Tartine",
    category: "dining",
    location: { name: "Tartine Bakery", address: "600 Guerrero St, San Francisco, CA 94110, USA" },
    cost: { amount: 50, perPerson: 50 },
  };
  const ops = scrubActivity(a, { destination: "Venice, Italy" });
  // Either crossCity (city scan) or countryMismatch (country scan) fires.
  assert(ops.crossCity + ops.countryMismatch >= 1);
  assertEquals(ops.downgraded, 1);
  assertEquals(a.cost.amount, 0);
});

Deno.test("scrubActivity: leaves clean Venice venue alone", () => {
  const a: any = {
    title: "Dinner at Da Ivo",
    category: "dining",
    location: { name: "Ristorante Da Ivo", address: "Calle dei Fuseri, 30124 Venezia VE, Italy" },
    cost: { amount: 120, perPerson: 120 },
  };
  const ops = scrubActivity(a, { destination: "Venice, Italy" });
  assert(!opsHadChange(ops));
  assertEquals(a.cost.amount, 120);
});

Deno.test("scrubActivity: drops sentence fragment 'spot for together'", () => {
  const a: any = {
    title: "Dinner",
    description: "Romantic dinner overlooking the canal. spot for together.",
  };
  const ops = scrubActivity(a, { destination: "Venice, Italy" });
  assertEquals(ops.fragment, 1);
  assert(!/spot for together/.test(a.description));
});

Deno.test("formatOps: empty bag renders {none}", () => {
  assertEquals(formatOps({ titleLeak:0,bodyLeak:0,fragment:0,mealSuffix:0,crossCity:0,countryMismatch:0,mealLabel:0,downgraded:0,phantomRef:0,degenerate:0 }), "{none}");
});

Deno.test("scrubActivity: blanks degenerate description 'The.'", () => {
  const a: any = { title: "Coastal Bike Exploration", description: "The." };
  const ops = scrubActivity(a, { destination: "Monaco" });
  assertEquals(ops.degenerate, 1);
  assertEquals(a.description, "");
});

Deno.test("scrubActivity: blanks degenerate description 'A.' / 'It.' / 'The'", () => {
  for (const stub of ["A.", "It.", "The", "Here.", "  this. "]) {
    const a: any = { title: "X", description: stub };
    scrubActivity(a, { destination: "Monaco" });
    assertEquals(a.description, "", `failed for stub="${stub}"`);
  }
});

Deno.test("scrubActivity: preserves legitimate 35-char description", () => {
  const desc = "Order the truffle pasta — house specialty.";
  const a: any = { title: "Trattoria", description: desc };
  const ops = scrubActivity(a, { destination: "Venice, Italy" });
  assertEquals(ops.degenerate, 0);
  assertEquals(a.description, desc);
});

Deno.test("scrubActivity: blanks notes/tips/summary degenerate stubs too", () => {
  const a: any = { title: "X", description: "Long enough description with detail.", notes: "The.", tips: "A.", summary: "It." };
  scrubActivity(a, { destination: "Monaco" });
  assertEquals(a.notes, "");
  assertEquals(a.tips, "");
  assertEquals(a.summary, "");
});

