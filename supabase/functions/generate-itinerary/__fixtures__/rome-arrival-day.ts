/**
 * Rome Arrival Day — 3-day trip, Day 1 (flight arrives 14:00).
 * Constraints: arrival 14:00 → 90m settle buffer, hotel check-in, dinner only.
 * Expectation: no activities before 15:30, no breakfast required, exactly 1 dinner.
 */
import type { FixtureActivity, FixtureDay } from "./assertions.ts";

export const romeArrivalDay = {
  scenario: "rome-arrival-day",
  destination: "Rome",
  dietaryRestrictions: [],
  budgetTier: "standard",
  dayNumber: 1,
  totalDays: 3,
  isFirstDay: true,
  isLastDay: false,
  hasHotel: true,
  hotelName: "Hotel Artemide",
  arrivalTime24: "14:00",
  day: {
    dayNumber: 1,
    activities: [
      { id: "r1", title: "Arrival Flight to Rome FCO", category: "flight", startTime: "13:00", endTime: "14:00", cost: { amount: 0, currency: "USD" } },
      { id: "r2", title: "Transfer to Hotel Artemide", category: "transport", startTime: "14:15", endTime: "15:15", cost: { amount: 65, currency: "USD" } },
      { id: "r3", title: "Hotel Check-In & Freshen Up", category: "logistics", startTime: "15:30", endTime: "16:30", cost: { amount: 0, currency: "USD" } },
      { id: "r4", title: "Sunset stroll Trastevere", category: "explore", startTime: "17:00", endTime: "18:30", cost: { amount: 0, currency: "USD" }, freeActivity: true },
      { id: "r5", title: "Dinner at Da Enzo al 29", category: "dining", startTime: "19:30", endTime: "21:30", cost: { amount: 55, currency: "USD" }, venue: { name: "Da Enzo al 29" } },
    ] as FixtureActivity[],
  } as FixtureDay,
} as const;
