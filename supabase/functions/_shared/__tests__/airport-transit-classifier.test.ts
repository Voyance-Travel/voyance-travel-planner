import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isAirportTransitCard,
  enforceAirportTransitMode,
  enforceAirportTransitOnDay,
} from "../airport-transit-classifier.ts";

Deno.test("'Walk to Transfer to Airport' → taxi, ≤45min", () => {
  const card: any = {
    title: "Walk to Transfer to Airport",
    category: "transport",
    startTime: "18:45",
    endTime: "20:31",
    durationMinutes: 106,
    transportation: { method: "walk", duration: "106 min" },
  };
  const mutated = enforceAirportTransitMode(card);
  assertEquals(mutated, true);
  assertEquals(card.transportation.method, "taxi");
  assertEquals(card.durationMinutes, 45);
  assertEquals(card.endTime, "19:30");
  assertEquals(card.title.startsWith("Taxi to"), true);
  assertEquals(card.metadata.airport_transit_classified, true);
  assertEquals(card.subcategory, "airport_transfer");
});

Deno.test("'Walk to airport terminal 2' → taxi", () => {
  const card: any = {
    title: "Walk to airport terminal 2",
    category: "transit",
    startTime: "18:00",
    durationMinutes: 70,
    transportation: { method: "walking" },
  };
  enforceAirportTransitMode(card);
  assertEquals(card.transportation.method, "taxi");
  assertEquals(card.durationMinutes, 45);
});

Deno.test("Flight card is untouched", () => {
  const card: any = {
    title: "Flight to LHR",
    category: "flight",
    startTime: "21:45",
    endTime: "23:45",
    durationMinutes: 120,
    transportation: { method: "flight" },
  };
  assertEquals(isAirportTransitCard(card), false);
  assertEquals(enforceAirportTransitMode(card), false);
  assertEquals(card.durationMinutes, 120);
});

Deno.test("Already-taxi airport transfer keeps shorter user duration", () => {
  const card: any = {
    title: "Taxi to Airport",
    category: "transport",
    subcategory: "airport_transfer",
    startTime: "18:00",
    endTime: "18:25",
    durationMinutes: 25,
    transportation: { method: "taxi", durationMinutes: 25 },
  };
  enforceAirportTransitMode(card);
  // Method unchanged.
  assertEquals(card.transportation.method, "taxi");
  // Duration unchanged (already shorter than 45).
  assertEquals(card.durationMinutes, 25);
});

Deno.test("Non-airport walk (e.g. 'Walk to Sagrada Familia') is untouched", () => {
  const card: any = {
    title: "Walk to Sagrada Familia",
    category: "transport",
    durationMinutes: 12,
    transportation: { method: "walk" },
  };
  assertEquals(isAirportTransitCard(card), false);
  assertEquals(enforceAirportTransitMode(card), false);
  assertEquals(card.transportation.method, "walk");
});

Deno.test("Idempotent — second call mutates nothing", () => {
  const card: any = {
    title: "Walk to airport",
    category: "transport",
    startTime: "18:45",
    durationMinutes: 90,
    transportation: { method: "walk" },
  };
  assertEquals(enforceAirportTransitMode(card), true);
  // Subsequent call: method already taxi, duration already 45, title already rewritten.
  assertEquals(enforceAirportTransitMode(card), false);
});

Deno.test("enforceAirportTransitOnDay skips locked rows except method", () => {
  const activities: any[] = [
    {
      id: "a1",
      title: "Walk to Airport",
      category: "transport",
      startTime: "18:00",
      durationMinutes: 75,
      transportation: { method: "walk" },
      isLocked: true,
    },
    {
      id: "a2",
      title: "Walk to Airport",
      category: "transport",
      startTime: "19:00",
      durationMinutes: 90,
      transportation: { method: "walk" },
    },
  ];
  const count = enforceAirportTransitOnDay(activities);
  assertEquals(count, 2);
  // Locked card: method fixed, duration preserved (75).
  assertEquals(activities[0].transportation.method, "taxi");
  assertEquals(activities[0].durationMinutes, 75);
  // Unlocked card: method + duration clamped.
  assertEquals(activities[1].transportation.method, "taxi");
  assertEquals(activities[1].durationMinutes, 45);
});
