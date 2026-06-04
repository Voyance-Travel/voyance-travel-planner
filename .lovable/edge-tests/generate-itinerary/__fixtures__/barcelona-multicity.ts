/**
 * Barcelona Multi-City — 6-day trip, Day 4 (transition: Madrid → Barcelona by train).
 * Constraints: hotel-change day, train departs 11:00 (120m buffer), check-in evening.
 * Expectation: old hotel checkout precedes train, train precedes new hotel check-in,
 *              no leisure activities before train within buffer.
 */
import type { FixtureActivity, FixtureDay } from "./assertions.ts";

export const barcelonaMultiCity = {
  scenario: "barcelona-multicity",
  destination: "Barcelona",
  dietaryRestrictions: [],
  budgetTier: "standard",
  dayNumber: 4,
  totalDays: 6,
  isFirstDay: false,
  isLastDay: false,
  hasHotel: true,
  hotelName: "Hotel Casa Fuster",
  isHotelChange: true,
  previousHotelName: "Hotel Único Madrid",
  day: {
    dayNumber: 4,
    activities: [
      { id: "b1", title: "Breakfast at Hotel Único", category: "dining", startTime: "07:30", endTime: "08:15", cost: { amount: 0, currency: "USD" } },
      { id: "b2", title: "Hotel Check-Out (Único Madrid)", category: "logistics", startTime: "08:30", endTime: "09:00", cost: { amount: 0, currency: "USD" } },
      { id: "b3", title: "Transfer to Madrid Atocha", category: "transport", startTime: "09:15", endTime: "10:00", cost: { amount: 25, currency: "USD" } },
      { id: "b4", title: "AVE Train Madrid → Barcelona", category: "transport", startTime: "11:00", endTime: "13:30", cost: { amount: 95, currency: "USD" } },
      { id: "b5", title: "Lunch in Eixample", category: "dining", startTime: "14:00", endTime: "15:00", cost: { amount: 22, currency: "USD" } },
      { id: "b6", title: "Hotel Check-In (Casa Fuster)", category: "logistics", startTime: "15:30", endTime: "16:15", cost: { amount: 0, currency: "USD" } },
      { id: "b7", title: "Walk Passeig de Gracia", category: "explore", startTime: "16:30", endTime: "18:00", cost: { amount: 0, currency: "USD" }, freeActivity: true },
      { id: "b8", title: "Dinner at Cervecería Catalana", category: "dining", startTime: "20:00", endTime: "21:30", cost: { amount: 38, currency: "USD" } },
    ] as FixtureActivity[],
  } as FixtureDay,
} as const;
