import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateDay } from "../pipeline/validate-day.ts";
import { FAILURE_CODES } from "../pipeline/types.ts";

const baseInput = {
  dayNumber: 1,
  isFirstDay: true,
  isLastDay: false,
  hasHotel: true,
  hotelName: "Hotel Roma",
  arrivalTime24: "04:00",
  returnDepartureTime24: undefined,
  requiredMeals: [],
  previousDays: [],
  avoidList: [],
  dietaryRestrictions: [],
  mustDoActivities: [],
  isHotelChange: false,
  previousHotelName: undefined,
  destination: "Rome",
  budgetTier: "premium" as const,
};

Deno.test("LANDMARK_AFTER_DARK: Colosseum at 21:30 flagged", () => {
  const results = validateDay({
    ...baseInput,
    day: {
      activities: [
        { title: "Colosseum tour", category: "sightseeing", startTime: "21:30", endTime: "23:00", description: "Visit the Colosseum at night for an evocative experience under the lights." },
      ],
    } as any,
  });
  const landmark = results.filter(r => r.code === FAILURE_CODES.LANDMARK_AFTER_DARK);
  assertEquals(landmark.length, 1);
  assert(landmark[0].message.includes("Colosseum"));
});

Deno.test("LANDMARK_AFTER_DARK: Pantheon at 14:00 NOT flagged", () => {
  const results = validateDay({
    ...baseInput,
    day: {
      activities: [
        { title: "Pantheon visit", category: "landmark", startTime: "14:00", endTime: "15:00", description: "Walk through the ancient Pantheon temple, marvel at the oculus." },
      ],
    } as any,
  });
  const landmark = results.filter(r => r.code === FAILURE_CODES.LANDMARK_AFTER_DARK);
  assertEquals(landmark.length, 0);
});

Deno.test("LANDMARK_AFTER_DARK: dinner at 21:30 NOT flagged (dining exempt)", () => {
  const results = validateDay({
    ...baseInput,
    day: {
      activities: [
        { title: "Dinner near Trevi", category: "dining", startTime: "21:30", endTime: "23:00", description: "Late-evening Roman dinner with traditional cacio e pepe." },
      ],
    } as any,
  });
  const landmark = results.filter(r => r.code === FAILURE_CODES.LANDMARK_AFTER_DARK);
  assertEquals(landmark.length, 0);
});

Deno.test("LANDMARK_AFTER_DARK: locked Colosseum at 21:30 NOT flagged", () => {
  const results = validateDay({
    ...baseInput,
    day: {
      activities: [
        { title: "Colosseum night tour", category: "sightseeing", startTime: "21:30", endTime: "23:00", isLocked: true, description: "Special after-hours guided tour booked by user." },
      ],
    } as any,
  });
  const landmark = results.filter(r => r.code === FAILURE_CODES.LANDMARK_AFTER_DARK);
  assertEquals(landmark.length, 0);
});

Deno.test("LANDMARK_AFTER_DARK: nightlife exempt", () => {
  const results = validateDay({
    ...baseInput,
    day: {
      activities: [
        { title: "Live jazz at Trastevere club", category: "nightlife", startTime: "22:00", endTime: "00:30", description: "Intimate Roman jazz club with local musicians playing classic standards." },
      ],
    } as any,
  });
  const landmark = results.filter(r => r.code === FAILURE_CODES.LANDMARK_AFTER_DARK);
  assertEquals(landmark.length, 0);
});
