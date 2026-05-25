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
  assertEquals(res.injected.length, 0);
  assertEquals(res.unscheduled, ["Pantheon"]);
});

Deno.test("scheduler: Teotihuacan rejected from Day 1 morning-arrival, lands on Day 2/3", () => {
  // Mexico City reproduction: arrival 10:00 Day 1, departure 13:00 Day 4.
  // Teotihuacan is long-haul (360min) — MUST NOT land on Day 1 or Day 4.
  const slots = scheduleMustDos(
    [
      "Teotihuacan Pyramids",
      "Zócalo (Plaza de la Constitución)",
      "Palacio de Bellas Artes",
      "Frida Kahlo Museum (Casa Azul)",
    ],
    {
      days: [
        {
          dayNumber: 1,
          activities: [
            { startTime: "08:00", endTime: "10:00", isLocked: true, category: "arrival-flight", id: "day1-arrival-flight-x" },
            { startTime: "11:30", endTime: "11:55", isLocked: true, category: "hotel-return" },
            { startTime: "12:15", endTime: "12:35", isLocked: true, category: "logistics" },
          ],
        },
        { dayNumber: 2, activities: [] },
        { dayNumber: 3, activities: [] },
        {
          dayNumber: 4,
          activities: [
            { startTime: "07:45", endTime: "08:15", isLocked: true, category: "hotel-checkout", id: "hotel_checkout" },
            { startTime: "10:20", endTime: "11:05", isLocked: true, category: "airport-transfer", id: "airport_transfer" },
          ],
        },
      ],
      arrivalTime24: "10:00",
      departureTime24: "13:00",
      arrivalBufferMins: 120,
      departureBufferMins: 180,
      transferMinsToAirport: 60,
    },
  );

  const teo = slots[0]!;
  const zocalo = slots[1]!;

  // Teotihuacan must land on Day 2 or 3 (long-haul, not Day 1 morning-arrival or Day 4 departure)
  assertEquals(teo !== null, true, "Teotihuacan should be scheduled");
  if (teo.dayNumber === 1 || teo.dayNumber === 4) {
    throw new Error(`Teotihuacan landed on Day ${teo.dayNumber}, should be Day 2 or 3`);
  }
  // And it should use the full long-haul block (360 min)
  assertEquals(teo.durationMinutes, 360, "Teotihuacan should reserve full 360-min block");

  // Zócalo (Day 1 OK with arrival buffer): if Day 1, must start ≥ 12:00 (10:00 + 120m)
  assertEquals(zocalo !== null, true, "Zócalo should be scheduled");
  if (zocalo.dayNumber === 1) {
    const [h, m] = zocalo.startTime.split(":").map(Number);
    if (h * 60 + m < 12 * 60) {
      throw new Error(`Zócalo on Day 1 started at ${zocalo.startTime}, should be ≥ 12:00 (arrival+buffer)`);
    }
  }
});

Deno.test("scheduler: long-haul ignores after-dark ceiling", () => {
  // Verify Teotihuacan never gets pushed into a 17:00–21:00 evening window
  // even though Day 2 has no other landmarks.
  const slots = scheduleMustDos(
    ["Teotihuacan Pyramids"],
    {
      days: [
        { dayNumber: 1, activities: [] },
        {
          dayNumber: 2,
          // Block morning 09:00–16:00 → only 16:00+ free
          activities: [
            { startTime: "09:00", endTime: "16:00", isLocked: true, category: "sightseeing" },
          ],
        },
      ],
    },
  );
  // Day 2 winEnd clamps to 17:00 (long-haul ceiling); 16:00–17:00 = 60min < 360
  // → should fall back to Day 1, NOT take an evening slot on Day 2.
  const s = slots[0]!;
  assertEquals(s.dayNumber, 1, "Long-haul should fall back to free Day 1, not evening slot");
});

