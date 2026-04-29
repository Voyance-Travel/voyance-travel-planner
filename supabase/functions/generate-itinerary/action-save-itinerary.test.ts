/**
 * Anchor-Merge Test Suite — Universal Locking Protocol
 *
 * Tests the pure `applyAnchorsWin` helper extracted from `handleSaveItinerary`.
 * Proves that user-provided anchors (manual additions, chat extracts, hotel
 * pins, multi-city anchors) survive the final-save pass intact.
 *
 * Reference: Universal Locking Protocol (Core memory rule).
 */

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { applyAnchorsWin } from "./action-save-itinerary.ts";

// ---------- helpers ----------
const day = (dayNumber: number, activities: any[]) => ({
  dayNumber,
  date: `2026-05-${String(dayNumber).padStart(2, "0")}`,
  activities,
});
const act = (overrides: Record<string, any> = {}) => ({
  id: `a-${Math.random().toString(36).slice(2, 8)}`,
  title: "Some activity",
  startTime: "10:00",
  endTime: "11:00",
  category: "explore",
  ...overrides,
});

// ----------------------------------------------------------------------------
// 1. No anchors → days returned unchanged
// ----------------------------------------------------------------------------
Deno.test("applyAnchorsWin: no anchors returns days unchanged", () => {
  const days = [day(1, [act({ title: "Louvre" }), act({ title: "Eiffel Tower" })])];
  const result = applyAnchorsWin(days, []);
  assertEquals(result.restored, 0);
  assertEquals(result.reaffirmed, 0);
  assertEquals(result.days[0].activities.length, 2);
  assertEquals(result.days[0].activities[0].title, "Louvre");
});

// ----------------------------------------------------------------------------
// 2. Anchor present + matching activity exists → reaffirms lock,
//    restores drifted title/time
// ----------------------------------------------------------------------------
Deno.test("applyAnchorsWin: matching activity gets lock reaffirmed", () => {
  const days = [
    day(1, [
      act({ title: "Louvre Museum", locked: false, isLocked: false }),
    ]),
  ];
  const anchors = [
    { dayNumber: 1, title: "Louvre Museum", startTime: "10:00", endTime: "13:00", lockedSource: "manual" },
  ];
  const result = applyAnchorsWin(days, anchors);
  assertEquals(result.restored, 0);
  assertEquals(result.reaffirmed, 1);
  const a = result.days[0].activities[0];
  assertEquals(a.locked, true);
  assertEquals(a.isLocked, true);
});

// ----------------------------------------------------------------------------
// 3. Anchor present + activity dropped by AI cleanup → re-injected
// ----------------------------------------------------------------------------
Deno.test("applyAnchorsWin: dropped anchor is re-injected with correct fields", () => {
  // Day 2 anchor → days array must have entries for day 1 and day 2
  const days = [
    day(1, [act({ title: "Day 1 walk" })]),
    day(2, [act({ title: "Generic walk" })]),
  ];
  const anchors = [{
    dayNumber: 2,
    title: "Sukiyabashi Jiro",
    startTime: "19:00",
    endTime: "21:00",
    category: "dining",
    venueName: "Sukiyabashi Jiro",
    lockedSource: "manual",
    source: "chat-extract",
  }];
  const result = applyAnchorsWin(days, anchors);
  assertEquals(result.restored, 1);
  assertEquals(result.reaffirmed, 0);
  const injected = result.days[1].activities.find((a: any) => a.title === "Sukiyabashi Jiro");
  assert(injected, "anchor should be injected");
  assertEquals(injected.locked, true);
  assertEquals(injected.isLocked, true);
  assertEquals(injected.startTime, "19:00");
  assertEquals(injected.endTime, "21:00");
  assertEquals(injected.category, "dining");
  assertEquals(injected.lockedSource, "manual");
  assertEquals(injected.anchorSource, "chat-extract");
});

// ----------------------------------------------------------------------------
// 4. Anchor with dayNumber out of range → silently skipped, no crash
// ----------------------------------------------------------------------------
Deno.test("applyAnchorsWin: out-of-range dayNumber is skipped without crash", () => {
  const days = [day(1, [act()])];
  const anchors = [
    { dayNumber: 99, title: "Nonexistent", lockedSource: "manual" },
    { dayNumber: 0, title: "Also nonexistent", lockedSource: "manual" },
    { dayNumber: -1, title: "Negative", lockedSource: "manual" },
  ];
  const result = applyAnchorsWin(days, anchors);
  assertEquals(result.restored, 0);
  assertEquals(result.reaffirmed, 0);
  assertEquals(result.days[0].activities.length, 1);
});

// ----------------------------------------------------------------------------
// 5. Fingerprint match (lockedSource + title) reaffirms without duplicating
// ----------------------------------------------------------------------------
Deno.test("applyAnchorsWin: fingerprint match prevents duplication", () => {
  const days = [
    day(1, [
      act({
        title: "Le Comptoir",
        locked: true,
        isLocked: true,
        lockedSource: "manual",
      }),
    ]),
  ];
  const anchors = [
    { dayNumber: 1, title: "Le Comptoir", lockedSource: "manual", startTime: "20:00" },
  ];
  const result = applyAnchorsWin(days, anchors);
  assertEquals(result.restored, 0);
  assertEquals(result.reaffirmed, 1);
  assertEquals(result.days[0].activities.length, 1, "must not duplicate");
});

// ----------------------------------------------------------------------------
// 6. Fuzzy title match — anchor "Sukiyabashi Jiro" matches activity
//    "Dinner at Sukiyabashi Jiro" → reaffirms, no duplicate
// ----------------------------------------------------------------------------
Deno.test("applyAnchorsWin: fuzzy title match reaffirms, does not duplicate", () => {
  const days = [
    day(3, [
      act({ title: "Dinner at Sukiyabashi Jiro", category: "dining", startTime: "19:00" }),
    ]),
  ];
  const anchors = [
    { dayNumber: 3, title: "Sukiyabashi Jiro", lockedSource: "manual" },
  ];
  const result = applyAnchorsWin(days, anchors);
  assertEquals(result.restored, 0);
  assertEquals(result.reaffirmed, 1);
  assertEquals(result.days[2 /* index for day 3 */]?.activities?.length ?? result.days[0].activities.length, 1);
  const a = result.days[0].activities[0];
  assertEquals(a.locked, true);
  assertEquals(a.isLocked, true);
});

// ----------------------------------------------------------------------------
// 7. Multiple anchors across multiple days, re-sort by startTime
// ----------------------------------------------------------------------------
Deno.test("applyAnchorsWin: multiple anchors across days, re-sorted by startTime", () => {
  const days = [
    day(1, [act({ title: "Morning walk", startTime: "09:00" })]),
    day(2, [act({ title: "Afternoon museum", startTime: "14:00" })]),
    day(3, [act({ title: "Evening stroll", startTime: "17:00" })]),
  ];
  const anchors = [
    { dayNumber: 1, title: "Cafe breakfast", startTime: "08:00", category: "dining", lockedSource: "manual" },
    { dayNumber: 2, title: "Locked lunch", startTime: "12:00", category: "dining", lockedSource: "manual" },
    { dayNumber: 3, title: "Locked dinner", startTime: "19:30", category: "dining", lockedSource: "manual" },
  ];
  const result = applyAnchorsWin(days, anchors);
  assertEquals(result.restored, 3);
  // Day 1: cafe breakfast (08:00) should be sorted BEFORE morning walk (09:00)
  assertEquals(result.days[0].activities[0].title, "Cafe breakfast");
  assertEquals(result.days[0].activities[1].title, "Morning walk");
  // Day 2: locked lunch (12:00) BEFORE afternoon museum (14:00)
  assertEquals(result.days[1].activities[0].title, "Locked lunch");
  // Day 3: evening stroll (17:00) BEFORE locked dinner (19:30)
  assertEquals(result.days[2].activities[0].title, "Evening stroll");
  assertEquals(result.days[2].activities[1].title, "Locked dinner");
});

// ----------------------------------------------------------------------------
// 8. Drifted title + drifted time both restored
// ----------------------------------------------------------------------------
Deno.test("applyAnchorsWin: drifted title and time restored to anchor values", () => {
  const days = [
    day(1, [
      act({
        title: "Sukiyabashi Jiro Tasting", // drifted title
        startTime: "18:30",                 // drifted time
        endTime: "20:00",
      }),
    ]),
  ];
  const anchors = [
    { dayNumber: 1, title: "Sukiyabashi Jiro", startTime: "19:00", endTime: "21:00", lockedSource: "manual" },
  ];
  const result = applyAnchorsWin(days, anchors);
  assertEquals(result.reaffirmed, 1);
  const a = result.days[0].activities[0];
  assertEquals(a.title, "Sukiyabashi Jiro");
  assertEquals(a.name, "Sukiyabashi Jiro");
  assertEquals(a.startTime, "19:00");
  assertEquals(a.endTime, "21:00");
  assertEquals(a.locked, true);
});
