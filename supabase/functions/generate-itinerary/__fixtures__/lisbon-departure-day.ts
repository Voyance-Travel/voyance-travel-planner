/**
 * Lisbon Departure Day — 4-day trip, Day 4 (flight departs 19:00).
 * Constraints: 180m flight buffer → no activities ≥ 16:00, no dinner.
 * Expectation: clean morning, return to hotel before 16:00, transfer to airport.
 */
import type { FixtureActivity, FixtureDay } from "./assertions.ts";

export const lisbonDepartureDay = {
  scenario: "lisbon-departure-day",
  destination: "Lisbon",
  dietaryRestrictions: [],
  budgetTier: "standard",
  dayNumber: 4,
  totalDays: 4,
  isFirstDay: false,
  isLastDay: true,
  hasHotel: true,
  hotelName: "Memmo Alfama",
  returnDepartureTime24: "19:00",
  day: {
    dayNumber: 4,
    activities: [
      { id: "l1", title: "Breakfast at Manteigaria", category: "dining", startTime: "08:30", endTime: "09:30", cost: { amount: 8, currency: "USD" } },
      { id: "l2", title: "Jeronimos Monastery", category: "explore", startTime: "10:00", endTime: "11:30", cost: { amount: 12, currency: "USD" } },
      { id: "l3", title: "Lunch at Time Out Market", category: "dining", startTime: "12:30", endTime: "13:30", cost: { amount: 18, currency: "USD" } },
      { id: "l4", title: "LX Factory browsing", category: "explore", startTime: "14:00", endTime: "15:30", cost: { amount: 0, currency: "USD" }, freeActivity: true },
      { id: "l5", title: "Return to Hotel & pack", category: "logistics", startTime: "15:45", endTime: "16:00", cost: { amount: 0, currency: "USD" } },
      // Departure buffer = 19:00 - 180m = 16:00. Transport allowed past this.
      { id: "l6", title: "Transfer to Lisbon LIS", category: "transport", startTime: "16:00", endTime: "16:45", cost: { amount: 35, currency: "USD" } },
      { id: "l7", title: "Departure Flight from LIS", category: "flight", startTime: "19:00", endTime: "21:00", cost: { amount: 0, currency: "USD" } },
    ] as FixtureActivity[],
  } as FixtureDay,
} as const;
