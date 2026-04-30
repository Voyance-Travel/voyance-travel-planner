/**
 * Tests for ledger-check.ts
 *
 * Run with: deno test supabase/functions/generate-itinerary/ledger-check.test.ts
 *
 * Focus: regressions for the Apr-2026 "rule engine collapses after day 1" bug
 * where daily anchors (Return to Hotel, Freshen Up) were being deleted as
 * duplicates on every day after day 1.
 */

import { assertEquals, assert } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { ledgerCheck } from "./ledger-check.ts";

function mkLedger(dayNumber: number, alreadyDoneTitles: string[]) {
  return {
    dayNumber,
    userIntent: [],
    alreadyDone: alreadyDoneTitles.map((t) => ({ title: t, dayNumber: 1 })),
    closures: [],
    forwardState: [],
  } as any;
}

Deno.test("daily anchors (Return to Hotel, Freshen Up, transfers) survive dedup across all days", async () => {
  const days = [
    {
      dayNumber: 1,
      activities: [
        { title: "Travel to Paris Marriott Champs Elysees Hotel", category: "transport" },
        { title: "Freshen Up at Paris Marriott Champs Elysees Hotel", category: "wellness" },
        { title: "Eiffel Tower Visit", category: "sightseeing" },
        { title: "Return to Paris Marriott Champs Elysees Hotel", category: "transport" },
      ],
    },
    {
      dayNumber: 2,
      activities: [
        { title: "Travel to Paris Marriott Champs Elysees Hotel", category: "transport" },
        { title: "Freshen Up at Paris Marriott Champs Elysees Hotel", category: "wellness" },
        { title: "Louvre Museum", category: "sightseeing" },
        { title: "Return to Paris Marriott Champs Elysees Hotel", category: "transport" },
      ],
    },
  ];

  const ledgers = [
    mkLedger(1, []),
    mkLedger(2, [
      "Travel to Paris Marriott Champs Elysees Hotel",
      "Freshen Up at Paris Marriott Champs Elysees Hotel",
      "Return to Paris Marriott Champs Elysees Hotel",
      "Eiffel Tower Visit",
    ]),
  ];

  const res = await ledgerCheck(days, ledgers);

  // Day 2 should still have all 4 activities — anchors must NOT be removed.
  const day2 = res.days.find((d: any) => d.dayNumber === 2);
  assertEquals(day2.activities.length, 4, "all anchors + Louvre must survive on day 2");

  // No anchor-related warnings should fire.
  const anchorWarnings = res.warnings.filter((w) =>
    w.kind === "repeat_already_done" &&
    /(return to|travel to|freshen up).*hotel|marriott/i.test(w.detail)
  );
  assertEquals(anchorWarnings.length, 0, "anchor activities must not produce repeat warnings");
});

Deno.test("non-anchor duplicates ARE still removed (e.g. revisiting same museum)", async () => {
  const days = [
    {
      dayNumber: 2,
      activities: [
        { title: "Louvre Museum", category: "sightseeing" },
        { title: "Lunch: Girafe", category: "dining" },
      ],
    },
  ];

  const ledgers = [
    mkLedger(2, ["Louvre Museum", "Lunch: Girafe"]),
  ];

  const res = await ledgerCheck(days, ledgers);
  assertEquals(res.removed, 2, "non-anchor duplicates must still be removed");
  assertEquals(res.days[0].activities.length, 0);
});

Deno.test("vibe clash auto-mutates tomorrow's splurge dinner when not locked", async () => {
  const days = [
    {
      dayNumber: 4,
      activities: [
        { title: "Dinner at Arpège", cost: { amount: 350, currency: "USD" } },
      ],
    },
    {
      dayNumber: 5,
      activities: [
        { title: "Dinner: Le Cinq", cost: { amount: 400, currency: "USD" } },
      ],
    },
  ];

  const ledgers = [
    {
      dayNumber: 4,
      userIntent: [],
      alreadyDone: [],
      closures: [],
      forwardState: [{ dayNumber: 5, kind: "dinner", title: "Dinner: Le Cinq" }],
    } as any,
    mkLedger(5, []),
  ];

  const res = await ledgerCheck(days, ledgers);
  const day5 = res.days.find((d: any) => d.dayNumber === 5);
  const dinner = day5.activities[0];
  assert(/casual/i.test(dinner.title), `expected casual replacement, got "${dinner.title}"`);
  assertEquals(dinner.needsRecommendation, true);

  const clashWarning = res.warnings.find((w) => w.kind === "vibe_clash");
  assert(clashWarning, "should emit a vibe_clash warning");
});

Deno.test("locked tomorrow dinner is NOT mutated, only warned", async () => {
  const days = [
    { dayNumber: 4, activities: [{ title: "Dinner at Arpège", cost: { amount: 350 } }] },
    {
      dayNumber: 5,
      activities: [
        { title: "Dinner: Le Cinq", cost: { amount: 400 }, locked: true, lockedSource: "user" },
      ],
    },
  ];

  const ledgers = [
    {
      dayNumber: 4,
      userIntent: [],
      alreadyDone: [],
      closures: [],
      forwardState: [{ dayNumber: 5, kind: "dinner", title: "Dinner: Le Cinq" }],
    } as any,
    mkLedger(5, []),
  ];

  const res = await ledgerCheck(days, ledgers);
  const day5 = res.days.find((d: any) => d.dayNumber === 5);
  assertEquals(day5.activities[0].title, "Dinner: Le Cinq", "locked dinner stays");
  const w = res.warnings.find((w) => w.kind === "vibe_clash");
  assert(w && /locked/i.test(w.detail));
});
