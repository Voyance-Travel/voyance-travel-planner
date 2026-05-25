import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { enforceTimingAndBuffers } from "../timing-cascade.ts";
import { normalizePredawnCascade } from "../predawn-cascade-normalize.ts";

// Reproduces the Rome bug: an LLM-emitted "Luggage Drop" at 06:15 cannot push
// the 02:30-04:30 arrival-flight anchor forward, and the predawn cascade does
// not rebase it to 09:00.

Deno.test("arrival-flight anchor is immovable by enforceTimingAndBuffers", () => {
  const acts: any[] = [
    {
      id: "flight",
      title: "Arrival Flight",
      category: "flight",
      startTime: "02:30",
      endTime: "04:30",
      isLocked: true,
      anchorSource: "arrival-flight",
      source: "repair-arrival-flight",
      durationMinutes: 120,
    },
    {
      id: "transfer",
      title: "Transfer to Hotel de Russie",
      category: "transport",
      startTime: "05:00",
      endTime: "05:45",
      isLocked: true,
      anchorSource: "airport-transfer",
      source: "repair-airport-transfer",
      durationMinutes: 45,
    },
    {
      id: "lugg",
      title: "Luggage Drop at Hotel de Russie",
      category: "accommodation",
      startTime: "06:00",
      endTime: "06:20",
    },
  ];

  const result = enforceTimingAndBuffers(acts);
  const flight = result.activities.find((a: any) => a.id === "flight");
  const transfer = result.activities.find((a: any) => a.id === "transfer");
  assertEquals(flight?.startTime, "02:30");
  assertEquals(flight?.endTime, "04:30");
  assertEquals(transfer?.startTime, "05:00");
  assertEquals(transfer?.endTime, "05:45");
});

Deno.test("predawn cascade leaves arrival-flight anchor untouched", () => {
  const acts: any[] = [
    {
      id: "flight",
      title: "Arrival Flight",
      category: "flight",
      startTime: "02:30",
      endTime: "04:30",
      isLocked: true,
      anchorSource: "arrival-flight",
      source: "repair-arrival-flight",
    },
  ];
  const out = normalizePredawnCascade(acts, 0, { dayNumber: 1, site: "test" });
  assertEquals(out.changed, false);
  assertEquals(out.count, 0);
  assertEquals(out.activities[0].startTime, "02:30");
});
