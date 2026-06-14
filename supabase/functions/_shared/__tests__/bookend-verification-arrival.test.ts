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

  // expectedTotalDays > 1: this fixture models Day-1 of a multi-day trip, so
  // the single-day departure shortcut must stay suppressed (Day 1 is not the
  // trip's departure day).
  const res = await runBookendVerification(days, { label: "test", expectedTotalDays: 2 });

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

  // Day-1 of a multi-day trip (see note above): suppress single-day shortcut.
  await runBookendVerification(days, { label: "test", expectedTotalDays: 2 });
  const trace = (days[0] as any).metadata?.quality?.bookend_trace;
  assertEquals(trace?.isDepartureDay, false);
  assertEquals(trace?.expected, true, "non-departure day with non-terminal last card expects a bookend");
});

// Regression: a 0-night LOCAL day trip (single day, no hotel, no flights) must
// NOT be stamped a departure day. The `days.length === 1` shortcut would
// otherwise force `departure_day` on it and inject return-flight / terminal
// logistics, stripping the real sightseeing into a hotel-transfer shell.
Deno.test("bookend-verify: local day trip (isLocalDayTrip) is NOT a departure day", async () => {
  const days = [
    {
      dayNumber: 1,
      activities: [
        { id: "s1", category: "sightseeing", title: "Centennial Olympic Park",
          startTime: "10:00", endTime: "12:00" },
        { id: "l1", category: "dining", title: "Lunch at Ponce City Market",
          startTime: "13:00", endTime: "14:00" },
        { id: "s2", category: "sightseeing", title: "World of Coca-Cola",
          startTime: "15:00", endTime: "17:00" },
        { id: "d1", category: "dining", title: "Dinner in Midtown",
          startTime: "19:00", endTime: "20:30" },
      ],
      metadata: {},
    },
  ];

  const res = await runBookendVerification(days, {
    label: "test", destination: "Atlanta", expectedTotalDays: 1, isLocalDayTrip: true,
  });

  const trace = (days[0] as any).metadata?.quality?.bookend_trace;
  assertEquals(trace?.isDepartureDay, false, "a local day trip is not a departure day");
  // No phantom hotel-return / departure terminal injected.
  assertEquals(res.injected, 0, "no bookend logistics injected on a no-hotel local day");
  const titles = days[0].activities.map((a: any) => a.title);
  assertEquals(titles.includes("World of Coca-Cola"), true, "real sightseeing must survive");
  assertEquals(
    titles.some((t: string) => /return to .*hotel|departure|airport|check[- ]?out/i.test(t)),
    false,
    "no phantom departure/hotel cards added",
  );
});

// Control: a genuine 1-day trip WITH a flight tail (round-trip same day) is
// still correctly a departure day — the isLocalDayTrip suppression must not
// over-reach and disable departure handling for real same-day flight trips.
Deno.test("bookend-verify: single-day flight trip (no isLocalDayTrip) stays a departure day", async () => {
  const days = [
    {
      dayNumber: 1,
      activities: [
        { id: "s1", category: "sightseeing", title: "City Walk",
          startTime: "10:00", endTime: "12:00" },
        { id: "f", category: "flight", title: "Departure Flight",
          startTime: "18:00", endTime: "20:00",
          source: "repair-departure-flight" },
      ],
      metadata: {},
    },
  ];

  await runBookendVerification(days, { label: "test", expectedTotalDays: 1 });
  const trace = (days[0] as any).metadata?.quality?.bookend_trace;
  assertEquals(trace?.isDepartureDay, true, "a same-day flight trip is still a departure day");
});
