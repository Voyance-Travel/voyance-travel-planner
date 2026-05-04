// Regression: once the traveler checks out and heads for the airport/station,
// no leisure activity (lunch, stroll, museum) may follow.

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { terminalCleanup } from "./universal-quality-pass.ts";

Deno.test("terminalCleanup: removes leisure activities scheduled after airport transfer", () => {
  const activities: any[] = [
    { id: "1", title: "Breakfast at Hotel", category: "dining", startTime: "08:00", endTime: "09:00" },
    { id: "2", title: "Checkout from Hotel Ritz", category: "accommodation", startTime: "10:00", endTime: "10:30" },
    { id: "3", title: "Transfer to Airport", category: "transport", startTime: "10:45", endTime: "11:30" },
    { id: "4", title: "Stroll along the Seine", category: "activity", startTime: "11:45", endTime: "12:30" },
    { id: "5", title: "Lunch at Café de Flore", category: "dining", startTime: "12:45", endTime: "13:45" },
    { id: "6", title: "Departure Flight", category: "flight", startTime: "15:30", endTime: "17:30" },
  ];

  terminalCleanup(activities, {
    departureTime24: "15:30",
    city: "Paris",
    dayNumber: 5,
    isFirstDay: false,
    isLastDay: true,
  });

  const titles = activities.map((a) => a.title);
  assert(!titles.includes("Stroll along the Seine"), "stroll after airport transfer should be removed");
  assert(!titles.includes("Lunch at Café de Flore"), "lunch after airport transfer should be removed");
  assert(titles.includes("Checkout from Hotel Ritz"), "checkout must remain");
  assert(titles.includes("Transfer to Airport"), "transfer must remain");
  assert(titles.includes("Departure Flight"), "flight must remain");
});

Deno.test("terminalCleanup: removes leisure after generic 'Departure Transfer' card", () => {
  const activities: any[] = [
    { id: "1", title: "Checkout", category: "accommodation", startTime: "11:00", endTime: "11:30" },
    { id: "2", title: "Departure Transfer", category: "transport", startTime: "12:00", endTime: "12:45" },
    { id: "3", title: "Quick gallery visit", category: "activity", startTime: "13:00", endTime: "14:00" },
  ];

  terminalCleanup(activities, {
    departureTime24: "16:00",
    city: "Lisbon",
    dayNumber: 4,
    isFirstDay: false,
    isLastDay: true,
  });

  const titles = activities.map((a) => a.title);
  assert(!titles.includes("Quick gallery visit"), "gallery after departure transfer should be removed");
});

Deno.test("terminalCleanup: never removes user-locked activities", () => {
  const activities: any[] = [
    { id: "1", title: "Checkout", category: "accommodation", startTime: "10:00", endTime: "10:30" },
    { id: "2", title: "Transfer to Airport", category: "transport", startTime: "11:00", endTime: "11:45" },
    { id: "3", title: "Locked goodbye lunch", category: "dining", startTime: "12:00", endTime: "13:00", locked: true },
    { id: "4", title: "Departure Flight", category: "flight", startTime: "15:00", endTime: "17:00" },
  ];

  terminalCleanup(activities, {
    departureTime24: "15:00",
    city: "Rome",
    dayNumber: 3,
    isFirstDay: false,
    isLastDay: true,
  });

  const titles = activities.map((a) => a.title);
  assertEquals(titles.includes("Locked goodbye lunch"), true, "user-locked items must be preserved");
});
