import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { repairDay } from "../../generate-itinerary/pipeline/repair-day.ts";

// Reconcile-branch coverage for repair-day §3b. Validates that an LLM-emitted
// "Arrival Flight" card at a bogus time is recognized and reconciled to the
// authoritative arrivalTime24 (Istanbul 03:05 → 15:00 pattern) — assertions
// scoped to the §3b contract (repair-action presence + immediate lock/anchor
// stamps + reconcile vs inject branch). Downstream cascades (§16 timing,
// bookend-validator transit injection) may shift exact display times.

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

Deno.test("§3b reconcile: Istanbul — LLM 03:05 card gets reconciled + locked + anchored", () => {
  const acts: any[] = [
    { id: "llm-flight", title: "Arrival Flight", category: "flight", startTime: "03:05", endTime: "05:05", isLocked: false },
    { id: "dinner", title: "Dinner at Nicole", category: "dining", startTime: "19:00", endTime: "20:15" },
  ];
  const { day, repairs } = repairDay(baseInput({
    day: { dayNumber: 1, date: "2027-01-08", activities: acts },
    arrivalTime24: "15:00",
  }));
  const flight = (day.activities as any[]).find((a) => a.id === "llm-flight");
  assert(flight, "reconciled flight should still exist");
  assertEquals(flight.isLocked, true);
  assertEquals(flight.anchorSource, "arrival-flight");
  assertEquals(flight.source, "repair-arrival-flight-reconciled");
  assertEquals(flight.durationMinutes, 120);
  assert(repairs.some((r: any) => r.action === "reconciled_arrival_flight"),
    "must emit reconciled_arrival_flight repair");
  assert(repairs.some((r: any) => r.action === "injected_airport_transfer"),
    "transfer should auto-inject when missing");
});

Deno.test("§3b reconcile: Mexico City — 22:00 LLM card reconciled (action emitted, locked)", () => {
  const acts: any[] = [
    { id: "llm", title: "Arrival Flight to MEX", category: "flight", startTime: "22:00", endTime: "23:00" },
  ];
  const { day, repairs } = repairDay(baseInput({
    day: { dayNumber: 1, date: "2027-01-08", activities: acts },
    arrivalTime24: "10:00",
    arrivalAirport: "MEX",
  }));
  const flight = (day.activities as any[]).find((a) => a.id === "llm");
  assert(flight);
  assertEquals(flight.isLocked, true);
  assertEquals(flight.anchorSource, "arrival-flight");
  assertEquals(flight.source, "repair-arrival-flight-reconciled");
  assert(repairs.some((r: any) => r.action === "reconciled_arrival_flight"));
});

Deno.test("§3b inject: Rome — no LLM card → existing inject path still fires (regression)", () => {
  const { day, repairs } = repairDay(baseInput({
    day: { dayNumber: 1, date: "2027-04-01", activities: [] },
    arrivalTime24: "14:00",
    arrivalAirport: "FCO",
    hotelName: "Hotel de Russie",
  }));
  const flight = (day.activities as any[]).find((a) => a.anchorSource === "arrival-flight");
  assert(flight, "inject path must add an arrival-flight anchor");
  assertEquals(flight.source, "repair-arrival-flight"); // inject, not reconcile
  assertEquals(flight.isLocked, true);
  assert(repairs.some((r: any) => r.action === "injected_arrival_flight"));
  assert(repairs.some((r: any) => r.action === "injected_airport_transfer"));
});

Deno.test("§3b reconcile is mutually exclusive with inject (Buenos Aires: existing LLM flight, no fresh inject)", () => {
  const acts: any[] = [
    { id: "llm", title: "Arrival Flight EZE", category: "flight", startTime: "10:00", endTime: "11:00" },
  ];
  const { repairs } = repairDay(baseInput({
    day: { dayNumber: 1, date: "2027-01-08", activities: acts },
    arrivalTime24: "06:30",
    arrivalAirport: "EZE",
  }));
  assert(repairs.some((r: any) => r.action === "reconciled_arrival_flight"));
  assert(!repairs.some((r: any) => r.action === "injected_arrival_flight"),
    "must not double-inject when reconcile path ran");
});

Deno.test("§3b no-op: no arrivalTime24 → neither branch fires (no reconciled/injected action)", () => {
  const acts: any[] = [
    { id: "llm", title: "Arrival Flight", category: "flight", startTime: "03:05", endTime: "05:05" },
  ];
  const { repairs } = repairDay(baseInput({
    day: { dayNumber: 1, date: "2027-01-08", activities: acts },
    arrivalTime24: undefined,
  }));
  assert(!repairs.some((r: any) =>
    r.action === "reconciled_arrival_flight" ||
    r.action === "injected_arrival_flight"));
});
