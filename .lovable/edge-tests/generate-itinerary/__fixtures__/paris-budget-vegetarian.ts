/**
 * Paris Budget Vegetarian — 4-day trip, Day 2 (full middle day, dense schedule).
 * Constraints: vegetarian + budget tier.
 * Expectation: zero meat/fish/steakhouse, dense 5+ activities, no chains.
 */
import type { FixtureActivity, FixtureDay } from "./assertions.ts";

export const parisBudgetVegetarian = {
  scenario: "paris-budget-vegetarian",
  destination: "Paris",
  dietaryRestrictions: ["vegetarian"],
  budgetTier: "budget",
  dayNumber: 2,
  totalDays: 4,
  isFirstDay: false,
  isLastDay: false,
  hasHotel: true,
  hotelName: "Hotel Jeanne d'Arc",
  day: {
    dayNumber: 2,
    activities: [
      { id: "p1", title: "Breakfast at Du Pain et des Idees", category: "dining", startTime: "08:30", endTime: "09:30", cost: { amount: 12, currency: "USD" } },
      { id: "p2", title: "Musée d'Orsay", category: "explore", startTime: "10:00", endTime: "12:00", cost: { amount: 16, currency: "USD" }, bookingRequired: true },
      { id: "p3", title: "Vegetarian Lunch at Hank Vegan Burger", category: "dining", startTime: "12:30", endTime: "13:30", cost: { amount: 14, currency: "USD" } },
      { id: "p4", title: "Stroll Tuileries Garden", category: "explore", startTime: "13:45", endTime: "14:45", cost: { amount: 0, currency: "USD" }, freeActivity: true },
      { id: "p5", title: "Sainte-Chapelle Stained Glass", category: "explore", startTime: "15:00", endTime: "16:30", cost: { amount: 13, currency: "USD" } },
      { id: "p6", title: "Return to Hotel", category: "logistics", startTime: "17:00", endTime: "17:45", cost: { amount: 0, currency: "USD" } },
      { id: "p7", title: "Dinner at Le Potager du Marais", category: "dining", startTime: "19:30", endTime: "21:00", cost: { amount: 28, currency: "USD" }, venue: { name: "Le Potager du Marais" } },
    ] as FixtureActivity[],
  } as FixtureDay,
} as const;
