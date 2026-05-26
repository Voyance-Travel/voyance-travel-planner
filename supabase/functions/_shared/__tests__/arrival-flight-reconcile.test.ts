import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { repairDay } from "../../generate-itinerary/pipeline/repair-day.ts";

// Reconcile-branch coverage for repair-day §3b. Validates that an LLM-emitted
// "Arrival Flight" card at a bogus time gets overwritten to the authoritative
// arrivalTime24 (Istanbul 03:05 → 15:00 pattern) and that the post-arrival
// collision sweep nudges colliding non-locked activities forward.

function baseInput(overrides: Record<string, any> = {}) {
  return {
    day: { dayNumber: 1, date: "2027-01-08", activities: [] },
    validationResults: [],
    dayNumber: 1,
    isFirstDay: true,
    isLastDay: false,
    hasHotel: true,
    hotelName: "Four Seasons",
    hotelAddress: "Sultanahmet",
    arrivalAirport: "IST",
    lockedActivities: [],
    ...overrides,
  } as any;
}

Deno.test("§3b reconcile: LLM emitted bogus 03:05 → overwritten to 13:00-15:00, locked, moved to index 0 (Istanbul)", () => {
  const acts: any[] = [
    {
      id: "llm-flight",
      title: "Arrival Flight",
      name: "Arrival Flight",
      category: "flight",
      startTime: "03:05",
      endTime: "05:05",
      isLocked: false,
    },
    {
      id: "dinner",
      title: "Dinner at Nicole",
      category: "dining",
      startTime: "19:00",
      endTime: "20:15",
    },
  ];
  const input = baseInput({
    day: { dayNumber: 1, date: "2027-01-08", activities: acts },
    arrivalTime24: "15:00",
  });

  const { day, repairs } = repairDay(input);
  const flight = (day.activities as any[]).find((a) => a.id === "llm-flight");
  assert(flight, "flight should still exist");
  assertEquals(flight.startTime, "13:00");
  assertEquals(flight.endTime, "15:00");
  assertEquals(flight.isLocked, true);
  assertEquals(flight.anchorSource, "arrival-flight");
  assertEquals(flight.source, "repair-arrival-flight-reconciled");
  assertEquals((day.activities as any[])[0].id, "llm-flight");
  // Transfer was missing → injected adjacent to flight
  const transfer = (day.activities as any[]).find((a) => a.anchorSource === "airport-transfer");
  assert(transfer, "transfer should be injected when missing");
  assert(repairs.some((r: any) => r.action === "reconciled_arrival_flight"));
  // Dinner at 19:00 already after transferEnd (15:30 + 45m + 15m buffer = 16:30) → untouched
  const dinner = (day.activities as any[]).find((a) => a.id === "dinner");
  assertEquals(dinner.startTime, "19:00");
});

Deno.test("§3b reconcile: Mexico City — 22:00 LLM card reconciled to 08:00-10:00 with transfer injection", () => {
  const acts: any[] = [{
    id: "llm",
    title: "Arrival Flight to MEX",
    category: "flight",
    startTime: "22:00",
    endTime: "23:00",
  }];
  const { day, repairs } = repairDay(baseInput({
    day: { dayNumber: 1, date: "2027-01-08", activities: acts },
    arrivalTime24: "10:00",
    arrivalAirport: "MEX",
  }));
  const flight = (day.activities as any[]).find((a) => a.id === "llm");
  assertEquals(flight.startTime, "08:00");
  assertEquals(flight.endTime, "10:00");
  assertEquals(flight.isLocked, true);
  assert(repairs.some((r: any) => r.action === "reconciled_arrival_flight"));
  assert(repairs.some((r: any) => r.action === "injected_airport_transfer"));
});

Deno.test("§3b inject: Rome — no LLM card present → existing inject path still runs (regression)", () => {
  const { day, repairs } = repairDay(baseInput({
    day: { dayNumber: 1, date: "2027-04-01", activities: [] },
    arrivalTime24: "14:00",
    arrivalAirport: "FCO",
    hotelName: "Hotel de Russie",
  }));
  const flight = (day.activities as any[]).find((a) => a.anchorSource === "arrival-flight");
  assert(flight);
  assertEquals(flight.startTime, "12:00");
  assertEquals(flight.endTime, "14:00");
  assertEquals(flight.source, "repair-arrival-flight");
  assert(repairs.some((r: any) => r.action === "injected_arrival_flight"));
  assert(repairs.some((r: any) => r.action === "injected_airport_transfer"));
});

Deno.test("§3b collision sweep: LLM flight 03:05 + luggage drop 06:15 → luggage moves past transferEnd+15m", () => {
  const acts: any[] = [
    { id: "llm", title: "Arrival Flight", category: "flight", startTime: "03:05", endTime: "05:05" },
    { id: "lugg", title: "Luggage Drop at Hotel", category: "accommodation", startTime: "06:15", endTime: "06:30" },
  ];
  const { day } = repairDay(baseInput({
    day: { dayNumber: 1, date: "2027-01-08", activities: acts },
    arrivalTime24: "15:00",
  }));
  // Authoritative flight 13:00–15:00, transfer 15:30–16:15, sweep floor = 16:30
  const lugg = (day.activities as any[]).find((a) => a.id === "lugg");
  assert(lugg, "luggage drop should still exist");
  const [h, m] = String(lugg.startTime).split(":").map(Number);
  assert(h * 60 + m >= 16 * 60 + 30, `expected luggage start ≥ 16:30, got ${lugg.startTime}`);
});

Deno.test("§3b no-op: no arrivalTime24 → neither branch fires, activities untouched", () => {
  const acts: any[] = [
    { id: "llm", title: "Arrival Flight", category: "flight", startTime: "03:05", endTime: "05:05" },
  ];
  const { day, repairs } = repairDay(baseInput({
    day: { dayNumber: 1, date: "2027-01-08", activities: acts },
    arrivalTime24: undefined,
  }));
  const flight = (day.activities as any[]).find((a) => a.id === "llm");
  assertEquals(flight.startTime, "03:05");
  assertEquals(flight.endTime, "05:05");
  assert(!repairs.some((r: any) =>
    r.action === "reconciled_arrival_flight" ||
    r.action === "injected_arrival_flight"));
});
