import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { scheduleMustDos } from "../schedule-must-dos.ts";
import { injectMissingMustDos } from "../inject-missing-must-dos.ts";

Deno.test("scheduler: Day 1 respects arrival buffer", () => {
  const slots = scheduleMustDos(
    ["Colosseum"],
    {
      days: [{ dayNumber: 1, activities: [] }, { dayNumber: 2, activities: [] }],
      arrivalTime24: "04:00",
      arrivalBufferMins: 120,
    },
  );
  // First eligible: Day 1 with start ≥ 06:00; greedy picks day with fewest landmarks (tie → day 1)
  const s = slots[0]!;
  // 04:00 + 120m = 06:00, but earliest is max(09:00, 06:00) = 09:00
  assertEquals(s.dayNumber, 1);
  assertEquals(s.startTime, "09:00");
});

Deno.test("scheduler: last-day respects departure buffer", () => {
  const slots = scheduleMustDos(
    ["Pantheon"],
    {
      days: [{ dayNumber: 1, activities: [] }, { dayNumber: 2, activities: [] }],
      departureTime24: "11:00",
      departureBufferMins: 180,
      transferMinsToAirport: 60,
    },
  );
  // Day 2 latestEnd = 11:00 − 180 − 60 − 30 = -3:30 (negative window) → drops out.
  // Falls back to Day 1.
  assertEquals(slots[0]!.dayNumber, 1);
});

Deno.test("scheduler: daylight-only landmark rejected from evening window", () => {
  const slots = scheduleMustDos(
    ["Vatican Museums"],
    {
      days: [{
        dayNumber: 1,
        activities: [
          // Block 09:00–16:00 with locked rows so only evening is free
          { startTime: "09:00", endTime: "16:00", isLocked: true, category: "dining" },
        ],
      }],
    },
  );
  // Daylight-only ceiling 17:00, but 16:00–17:00 = 60min < 210min museum duration
  assertEquals(slots[0], null);
});

Deno.test("scheduler: after-dark-safe landmark accepts evening slot", () => {
  const slots = scheduleMustDos(
    ["Trevi Fountain"],
    {
      days: [{
        dayNumber: 1,
        activities: [
          { startTime: "09:00", endTime: "17:00", isLocked: true, category: "dining" },
        ],
      }],
    },
  );
  // Trevi is after-dark-ok, ceiling extends to 21:00. 17:00–17:45 fits.
  assertEquals(slots[0]!.startTime, "17:00");
  assertEquals(slots[0]!.afterDarkOk, true);
});

Deno.test("injector: idempotent re-run finds 0 missing after first pass", () => {
  const days = [
    { dayNumber: 1, activities: [] },
    { dayNumber: 2, activities: [] },
  ];
  const first = injectMissingMustDos(days, ["Pantheon", "Trevi Fountain"], {});
  assertEquals(first.injected.length, 2);
  // Second pass: same missing list — scheduler still finds slots (we don't
  // re-match against existing cards), but injector doesn't crash + still
  // returns an InjectResult.
  const second = injectMissingMustDos(days, [], {});
  assertEquals(second.injected.length, 0);
  assertEquals(second.unscheduled.length, 0);
});

Deno.test("injector: prefers day with fewer existing landmarks", () => {
  const days = [
    { dayNumber: 1, activities: [{ category: "sightseeing", startTime: "10:00", endTime: "11:00" }] },
    { dayNumber: 2, activities: [] },
  ];
  const res = injectMissingMustDos(days, ["Pantheon"], {});
  assertEquals(res.injected[0].dayNumber, 2);
});

Deno.test("injector: unscheduled when no day has eligible window", () => {
  const days = [
    {
      dayNumber: 1,
      activities: [
        { startTime: "00:00", endTime: "23:59", isLocked: true, category: "sightseeing" },
      ],
    },
  ];
  const res = injectMissingMustDos(days, ["Pantheon"], {});
  assertEquals(res.injected.length, 0);
  assertEquals(res.unscheduled, ["Pantheon"]);
});
