import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { pruneOrphanTransits } from "../orphan-transit.ts";

Deno.test("pruneOrphanTransits: keeps airport transfer even when no card names the airport", () => {
  // Departure day: transfer to airport then flight. The flight card does not
  // literally contain "airport", but the transfer is departure logistics, not an
  // orphan — it must survive.
  const acts = [
    { title: "Checkout", category: "accommodation", startTime: "10:00", endTime: "10:30" },
    { title: "Transfer to Airport", category: "transport", startTime: "11:00", endTime: "11:45" },
    { title: "Departure Flight", category: "flight", startTime: "14:00", endTime: "16:00" },
  ];
  const removed = pruneOrphanTransits(acts);
  assertEquals(removed, 0);
  assertEquals(acts.some((a) => a.title === "Transfer to Airport"), true);
});

Deno.test("pruneOrphanTransits: keeps station transfer at end of day", () => {
  const acts = [
    { title: "Lunch at Trattoria", category: "dining", startTime: "12:00", endTime: "13:00" },
    { title: "Transfer to Station", category: "transport", startTime: "14:00", endTime: "14:40" },
  ];
  const removed = pruneOrphanTransits(acts);
  assertEquals(removed, 0);
  assertEquals(acts.length, 2);
});

Deno.test("pruneOrphanTransits: still drops a genuine orphan venue transit", () => {
  // "Walk to Tartine" where Tartine no longer exists (cross-city dropped) → orphan.
  const acts = [
    { title: "Museum Visit", category: "activity", startTime: "10:00", endTime: "11:30" },
    { title: "Walk to Tartine", category: "transport", startTime: "11:30", endTime: "11:45" },
    { title: "Park Stroll", category: "activity", startTime: "12:00", endTime: "13:00" },
  ];
  const removed = pruneOrphanTransits(acts);
  assertEquals(removed, 1);
  assertEquals(acts.some((a) => a.title === "Walk to Tartine"), false);
});

Deno.test("pruneOrphanTransits: keeps transit whose venue target follows", () => {
  const acts = [
    { title: "Walk to Borough Market", category: "transport", startTime: "11:00", endTime: "11:15" },
    { title: "Lunch at Borough Market", category: "dining", startTime: "11:30", endTime: "12:30" },
  ];
  const removed = pruneOrphanTransits(acts);
  assertEquals(removed, 0);
  assertEquals(acts.length, 2);
});
