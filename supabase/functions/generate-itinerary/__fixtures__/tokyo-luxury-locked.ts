/**
 * Tokyo Luxury — 5-day trip, Day 3 (full middle day).
 * Constraints: peanut allergy + 2 locked dinners (Sukiyabashi Jiro + Den).
 * Expectation: locks survive, no peanut/satay in any title, ≥1 Michelin dinner.
 */
import type { FixtureActivity, FixtureDay } from "./assertions.ts";

export const tokyoLuxuryLocked = {
  scenario: "tokyo-luxury-locked",
  destination: "Tokyo",
  dietaryRestrictions: ["peanut allergy"],
  budgetTier: "luxury",
  dayNumber: 3,
  totalDays: 5,
  isFirstDay: false,
  isLastDay: false,
  hasHotel: true,
  hotelName: "Aman Tokyo",
  day: {
    dayNumber: 3,
    activities: [
      { id: "t1", title: "Breakfast at Aman Tokyo Cafe", category: "dining", startTime: "08:00", endTime: "09:00", cost: { amount: 45, currency: "USD" } },
      { id: "t2", title: "TeamLab Borderless", category: "explore", startTime: "10:00", endTime: "12:30", cost: { amount: 30, currency: "USD" } },
      { id: "t3", title: "Lunch at Tsuta Ramen", category: "dining", startTime: "12:45", endTime: "13:45", cost: { amount: 25, currency: "USD" } },
      { id: "t4", title: "Senso-ji Temple", category: "explore", startTime: "14:30", endTime: "16:00", cost: { amount: 0, currency: "USD" } },
      { id: "t5", title: "Return to Hotel", category: "logistics", startTime: "16:15", endTime: "17:00", cost: { amount: 0, currency: "USD" } },
      { id: "t6", title: "Dinner at Sukiyabashi Jiro", category: "dining", startTime: "19:00", endTime: "21:00", cost: { amount: 350, currency: "USD" }, isLocked: true, locked: true, lockedSource: "manual", venue: { name: "Sukiyabashi Jiro" } },
    ] as FixtureActivity[],
  } as FixtureDay,
} as const;
