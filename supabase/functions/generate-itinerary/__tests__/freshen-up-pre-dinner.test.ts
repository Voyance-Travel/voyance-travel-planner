// Pre-dinner freshen-up enforcement (repair-day §7b + §7b-bis).
// Closes: LLM places "exchange bike gear for evening attire" freshen-up
// AFTER dinner because preceding bike tour leaves only 15 min before dinner.
// Also: lone "Check-in" title on non-arrival day is relabeled to "Freshen Up".
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { repairDay } from "../pipeline/repair-day.ts";

const baseInput = {
  validationResults: [],
  dayNumber: 2,
  isFirstDay: false,
  isLastDay: false,
  hasHotel: true,
  hotelName: "Hotel Test",
  hotelAddress: "1 Test St",
  lockedActivities: [],
  airportTransferMinutes: 45,
  paceScore: 4, // sidestep unrelated isFastPaced scope quirk
};

const mkAct = (over: any) => ({
  id: over.id || `a-${Math.random()}`,
  title: over.title,
  category: over.category,
  startTime: over.startTime,
  endTime: over.endTime,
  description: over.description ?? "",
  location: { name: "", address: "" },
  cost: { amount: 0, currency: "USD" },
  ...over,
});

Deno.test("§7b-bis: pre-dinner freshen-up after bike tour with 15m gap → dropped", () => {
  const day = {
    dayNumber: 2,
    date: "2026-05-15",
    title: "Bruges Day 2",
    activities: [
      mkAct({ id: "1", title: "Bike Tour around Bruges", category: "activity", startTime: "15:00", endTime: "19:00" }),
      mkAct({ id: "2", title: "Dinner at Den Gouden Harynck", category: "dining", startTime: "19:15", endTime: "21:00" }),
      mkAct({
        id: "3",
        title: "Freshen Up at Hotel Test",
        category: "accommodation",
        startTime: "22:12",
        endTime: "22:42",
        description: "Exchange bike gear for evening attire before dinner.",
      }),
    ],
  };
  const { day: out } = repairDay({ ...baseInput, day: day as any } as any);
  const freshen = out.activities.find((a: any) => /freshen[-\s]?up/i.test(a.title || ""));
  assertEquals(freshen, undefined, "freshen-up must be dropped (gap=15m < required 65m)");
});

Deno.test("§7b-bis: pre-dinner freshen-up with adequate gap → relocated before dinner", () => {
  const day = {
    dayNumber: 2,
    date: "2026-05-15",
    title: "Bruges Day 2",
    activities: [
      mkAct({ id: "1", title: "Museum Visit", category: "museum", startTime: "14:00", endTime: "17:00" }),
      mkAct({ id: "2", title: "Dinner at De Karmeliet", category: "dining", startTime: "20:00", endTime: "22:00" }),
      mkAct({
        id: "3",
        title: "Freshen Up at Hotel Test",
        category: "accommodation",
        startTime: "22:30",
        endTime: "22:50",
        description: "Quick refresh ahead of dinner reservation.",
      }),
    ],
  };
  const { day: out } = repairDay({ ...baseInput, day: day as any } as any);
  const freshenIdx = out.activities.findIndex((a: any) => /freshen[-\s]?up/i.test(a.title || ""));
  const dinnerIdx = out.activities.findIndex((a: any) => /dinner/i.test(a.title || ""));
  assert(freshenIdx >= 0, "freshen-up should remain (gap=180m allows it)");
  assert(freshenIdx < dinnerIdx, "freshen-up must appear before dinner");
  const freshen = out.activities[freshenIdx];
  const [h, m] = (freshen.endTime || "").split(":").map(Number);
  assert(h * 60 + m <= 20 * 60 - 15, `freshen end must be ≤ dinnerStart−15m, got ${freshen.endTime}`);
});

Deno.test("§7b: lone 'Check-in' on non-arrival day → relabeled to 'Freshen Up'", () => {
  const day = {
    dayNumber: 3,
    date: "2026-05-16",
    title: "Bruges Day 3",
    activities: [
      mkAct({ id: "1", title: "Walking Tour", category: "activity", startTime: "10:00", endTime: "12:00" }),
      mkAct({ id: "2", title: "Check-in at Hotel Test", category: "accommodation", startTime: "18:30", endTime: "19:00" }),
      mkAct({ id: "3", title: "Dinner at De Karmeliet", category: "dining", startTime: "19:30", endTime: "21:30" }),
    ],
  };
  const { day: out } = repairDay({
    ...baseInput,
    dayNumber: 3,
    day: day as any,
    isTransitionDay: false,
    isHotelChange: false,
  } as any);
  const relabel = out.activities.find((a: any) => a.id === "2");
  assert(relabel, "card 2 must exist");
  assert(/freshen[-\s]?up/i.test(relabel!.title || ""), `expected Freshen Up, got "${relabel!.title}"`);
});
