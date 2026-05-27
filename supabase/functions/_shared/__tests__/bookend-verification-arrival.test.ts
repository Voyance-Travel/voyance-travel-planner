/**
 * Regression: bookend verification must NOT treat a Day-1 pre-dawn arrival
 * flight (e.g., Istanbul 03:05–05:05) as the day's chronological tail.
 *
 * Without this guard, the wrap-aware key shifted 05:05 to 29:05 mins, which
 * outranked a real 23:44 hotel-return — causing the verifier to stamp
 * `expected:false, lastTitle:Arrival Flight, reason:terminal_departure_logistics`
 * and skip the bookend invariant entirely.
 *
 * See plan.md and persisted trace on trip 3c2da103-fb9a-47ef-a51e-d26be4680ac7.
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runBookendVerification } from "../bookend-verification.ts";

Deno.test("bookend-verify: Day-1 pre-dawn arrival flight is NOT the chronological tail", async () => {
  const days = [
    {
      dayNumber: 1,
      activities: [
        {
          id: "f", category: "flight", title: "Arrival Flight",
          startTime: "03:05", endTime: "05:05",
          source: "repair-arrival-flight", anchorSource: "arrival-flight",
        },
        {
          id: "d", category: "dining", title: "Dinner: Nicole",
          startTime: "19:00", endTime: "20:15",
        },
        {
          id: "h", category: "accommodation", title: "Return to Four Seasons Istanbul",
          startTime: "23:44", endTime: "23:59",
          source: "bookend-validator",
        },
      ],
      metadata: {},
    },
  ];

  const res = await runBookendVerification(days, { label: "test" });

  // Day 1 has a real terminal hotel-return → must be marked persisted=true,
  // not "isDepartureDay" or "terminal_departure_logistics".
  const trace = (days[0] as any).metadata?.quality?.bookend_trace;
  assertEquals(trace?.persisted, true, "Day-1 return must be recognized as persisted bookend");
  assertEquals(trace?.isDepartureDay, false, "Day 1 with arrival flight is not departure day");
  assertEquals(res.persisted, 1);
  assertEquals(res.missing, 0);
});

Deno.test("bookend-verify: arrival logistics WITHOUT a real bookend correctly flags missing", async () => {
  const days = [
    {
      dayNumber: 1,
      activities: [
        { id: "f", category: "flight", title: "Arrival Flight",
          startTime: "14:00", endTime: "16:00",
          source: "repair-arrival-flight", anchorSource: "arrival-flight" },
        { id: "d", category: "dining", title: "Dinner",
          startTime: "20:00", endTime: "21:30" },
      ],
      metadata: {},
    },
  ];

  await runBookendVerification(days, { label: "test" });
  const trace = (days[0] as any).metadata?.quality?.bookend_trace;
  assertEquals(trace?.isDepartureDay, false);
  assertEquals(trace?.expected, true, "non-departure day with non-terminal last card expects a bookend");
});
