/**
 * Regression: a "Return to Hotel 21:20 → 05:20" overnight wrap is impossible
 * as a single bookend card and MUST be clamped at persist sanity. Observed
 * in trip 5fdba1e8 (Lisbon Day 3, persisted before this guard existed).
 *
 * See plan.md.
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { sanitizeDaySchedule } from "../sanitize-schedule-timing.ts";

Deno.test("schedule-sanity: hotel-return 21:20→05:20 is clamped to 21:20→23:59", () => {
  const acts: any[] = [
    {
      id: "h",
      category: "accommodation",
      title: "Return to Four Seasons Hotel Ritz Lisbon",
      startTime: "21:20",
      endTime: "05:20",
    },
  ];
  const r = sanitizeDaySchedule(acts, { dayNumber: 3 });
  assertEquals(r.invalidEndBeforeStartRepaired, 1);
  assertEquals(acts[0].endTime, "23:59");
});

Deno.test("schedule-sanity: legit late_nightlife_bookend 00:20→00:50 is preserved", () => {
  const acts: any[] = [
    {
      id: "h",
      category: "accommodation",
      title: "Return to Hotel",
      startTime: "00:20",
      endTime: "00:50",
      source: "late_nightlife_bookend",
    },
  ];
  const r = sanitizeDaySchedule(acts, { dayNumber: 2 });
  assertEquals(r.invalidEndBeforeStartRepaired, 0);
  assertEquals(acts[0].endTime, "00:50");
});

Deno.test("schedule-sanity: non-bookend 21:30 nightlife wrap stays untouched when explicitly tagged", () => {
  const acts: any[] = [
    {
      id: "n",
      category: "nightlife",
      title: "Speakeasy Drinks",
      startTime: "22:00",
      endTime: "01:30",
      tags: ["late_nightlife_bookend"],
    },
  ];
  const r = sanitizeDaySchedule(acts, { dayNumber: 2 });
  assertEquals(r.invalidEndBeforeStartRepaired, 0);
});
