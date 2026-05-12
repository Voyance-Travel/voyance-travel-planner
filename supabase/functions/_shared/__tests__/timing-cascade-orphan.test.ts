import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { pruneOrphanLateNightlifeBookend } from "../timing-cascade.ts";

Deno.test("orphan late_nightlife_bookend pruned when prior tail isn't nightlife", () => {
  const acts: any[] = [
    { id: "a", title: "Breakfast", category: "dining", startTime: "09:00", endTime: "10:00" },
    { id: "b", title: "Museum", category: "culture", startTime: "14:00", endTime: "16:00" },
    { id: "c", title: "Dinner at Refter", category: "dining", startTime: "21:00", endTime: "22:30" },
    {
      id: "stale",
      title: "Return to Hotel",
      category: "accommodation",
      startTime: "00:10",
      endTime: "00:35",
      source: "late_nightlife_bookend",
      tags: ["hotel", "rest", "late_nightlife_bookend"],
    },
  ];
  const removed = pruneOrphanLateNightlifeBookend(acts, { dayNumber: 2 });
  assertEquals(removed, 1);
  assertEquals(acts.length, 3);
  assertEquals(acts.some((a) => a.id === "stale"), false);
});

Deno.test("legitimate late_nightlife_bookend after a vermutería nightcap survives", () => {
  const acts: any[] = [
    { id: "a", title: "Breakfast", category: "dining", startTime: "09:00", endTime: "10:00" },
    {
      id: "n",
      title: "Nightcap at La Rosa Vermutería",
      category: "drinks",
      startTime: "21:30",
      endTime: "00:15",
    },
    {
      id: "ret",
      title: "Return to St Regis",
      category: "accommodation",
      startTime: "00:40",
      endTime: "01:05",
      source: "late_nightlife_bookend",
      tags: ["late_nightlife_bookend"],
    },
  ];
  const removed = pruneOrphanLateNightlifeBookend(acts, { dayNumber: 2 });
  assertEquals(removed, 0);
  assertEquals(acts.length, 3);
});

Deno.test("bookend that starts BEFORE prior nightlife ends is pruned (impossible chronology)", () => {
  const acts: any[] = [
    {
      id: "n",
      title: "Nightcap at Vermutería",
      category: "drinks",
      startTime: "21:30",
      endTime: "00:15",
    },
    {
      id: "bad",
      title: "Return to Hotel",
      category: "accommodation",
      startTime: "00:10",
      endTime: "00:35",
      source: "late_nightlife_bookend",
    },
  ];
  const removed = pruneOrphanLateNightlifeBookend(acts, { dayNumber: 2 });
  assertEquals(removed, 1);
});

Deno.test("non-bookend cards are never touched", () => {
  const acts: any[] = [
    { id: "a", title: "Brunch", category: "dining", startTime: "10:00", endTime: "11:30" },
    { id: "b", title: "Walk", category: "transit", startTime: "11:30", endTime: "11:45" },
  ];
  const removed = pruneOrphanLateNightlifeBookend(acts, { dayNumber: 1 });
  assertEquals(removed, 0);
  assertEquals(acts.length, 2);
});
