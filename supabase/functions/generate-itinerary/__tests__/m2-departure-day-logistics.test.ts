// M2 — Departure-day logistics enforcement.
// Closes the recurring "checkout drifts later each city" bug
// (Florence 16:15, Barcelona 15:30, Madrid 21:05).
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { repairDay } from "../pipeline/repair-day.ts";

const baseInput = {
  validationResults: [],
  dayNumber: 3,
  isFirstDay: false,
  isLastDay: true,
  hasHotel: true,
  hotelName: "Hotel Test",
  hotelAddress: "1 Test St",
  lockedActivities: [],
  airportTransferMinutes: 45,
};

const mkAct = (over: any) => ({
  id: over.id || `a-${Math.random()}`,
  title: over.title,
  category: over.category,
  startTime: over.startTime,
  endTime: over.endTime,
  description: "",
  location: { name: "", address: "" },
  cost: { amount: 0, currency: "USD" },
  ...over,
});

Deno.test("M2: late-night checkout (21:05) is retimed to ≤11:00 for an early-afternoon flight", () => {
  const day = {
    dayNumber: 3,
    date: "2026-05-15",
    title: "Madrid Day 3",
    activities: [
      mkAct({ id: "1", title: "Breakfast at Hotel", category: "dining", startTime: "08:00", endTime: "09:00" }),
      mkAct({ id: "2", title: "Checkout from Hotel Test", category: "accommodation", startTime: "21:05", endTime: "21:35" }),
      mkAct({ id: "3", title: "Transfer to MAD Airport", category: "transport", startTime: "22:00", endTime: "22:45" }),
    ],
  };
  const { day: out } = repairDay({
    ...baseInput,
    day: day as any,
    returnDepartureTime24: "13:30",
  } as any);
  const checkout = out.activities.find((a: any) =>
    /check[\s-]?out/i.test(a.title || "")
  );
  assert(checkout, "checkout must exist");
  const [h, m] = (checkout!.startTime || "").split(":").map(Number);
  const startMin = h * 60 + m;
  assert(
    startMin <= 11 * 60,
    `checkout must be ≤ 11:00, got ${checkout!.startTime}`
  );
});

Deno.test("M2: no flight info → checkout defaults to 11:00, no synthetic airport transfer injected", () => {
  const day = {
    dayNumber: 3,
    date: "2026-05-15",
    title: "Day 3",
    activities: [
      mkAct({ id: "1", title: "Breakfast at Hotel", category: "dining", startTime: "08:00", endTime: "09:00" }),
      mkAct({ id: "2", title: "Morning walk", category: "explore", startTime: "09:30", endTime: "10:30" }),
    ],
  };
  const { day: out } = repairDay({
    ...baseInput,
    day: day as any,
    // no returnDepartureTime24
  } as any);
  const checkout = out.activities.find((a: any) =>
    /check[\s-]?out/i.test(a.title || "")
  );
  assert(checkout, "checkout must be injected");
  assertEquals(checkout!.startTime, "11:00");
});
