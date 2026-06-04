// Tests for auto-route-optimizer.ts — verifies that locked / time-fixed activities
// never move during route optimization. This directly backs the Universal Locking rule.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isTimeFixed, autoOptimizeDayRoute } from "./auto-route-optimizer.ts";

// ---------- isTimeFixed ----------

Deno.test("isTimeFixed: locked activities are fixed", () => {
  assertEquals(isTimeFixed({ isLocked: true, title: "Walk", category: "explore" }), true);
});

Deno.test("isTimeFixed: bookingRequired activities are fixed", () => {
  assertEquals(
    isTimeFixed({ bookingRequired: true, title: "Tour", category: "experience" }),
    true,
  );
});

Deno.test("isTimeFixed: transport / accommodation categories always fixed", () => {
  assertEquals(isTimeFixed({ category: "transport", title: "Bus" }), true);
  assertEquals(isTimeFixed({ category: "accommodation", title: "Hotel" }), true);
  assertEquals(isTimeFixed({ category: "logistics", title: "Check-in" }), true);
});

Deno.test("isTimeFixed: meal categories are fixed (dinner reservations etc.)", () => {
  assertEquals(isTimeFixed({ category: "dining", title: "Dinner at Septime" }), true);
  assertEquals(isTimeFixed({ category: "restaurant", title: "Lunch" }), true);
});

Deno.test("isTimeFixed: title patterns mark reservations / shows / transfers", () => {
  assertEquals(isTimeFixed({ title: "Reservation at Septime", category: "explore" }), true);
  assertEquals(isTimeFixed({ title: "Airport transfer", category: "explore" }), true);
  assertEquals(isTimeFixed({ title: "Concert at Olympia", category: "explore" }), true);
  assertEquals(isTimeFixed({ title: "Departure", category: "explore" }), true);
});

Deno.test("isTimeFixed: flexible explore activity is NOT fixed", () => {
  assertEquals(
    isTimeFixed({ title: "Wander Le Marais", category: "explore" }),
    false,
  );
});

// ---------- autoOptimizeDayRoute ----------

Deno.test("autoOptimizeDayRoute: <=2 activities returned unchanged", () => {
  const acts = [
    { title: "A", location: { coordinates: { lat: 48.85, lng: 2.34 } } },
    { title: "B", location: { coordinates: { lat: 48.86, lng: 2.35 } } },
  ];
  const out = autoOptimizeDayRoute(acts);
  assertEquals(out.length, 2);
  assertEquals(out[0].title, "A");
});

Deno.test("autoOptimizeDayRoute: locked activity stays at its index", () => {
  // Locked dinner reservation in middle slot must not move even if reordering would help
  const acts = [
    {
      title: "Wander Marais",
      category: "explore",
      location: { coordinates: { lat: 48.857, lng: 2.359 } },
    },
    {
      title: "Dinner at Septime (LOCKED)",
      category: "dining",
      isLocked: true,
      location: { coordinates: { lat: 48.853, lng: 2.378 } },
    },
    {
      title: "Eiffel Tower",
      category: "explore",
      location: { coordinates: { lat: 48.858, lng: 2.294 } },
    },
    {
      title: "Louvre area stroll",
      category: "explore",
      location: { coordinates: { lat: 48.860, lng: 2.337 } },
    },
  ];
  const out = autoOptimizeDayRoute(acts);
  assertEquals(out.length, 4);
  // Locked dinner must remain in slot 1 (index 1)
  assertEquals(
    out[1].title,
    "Dinner at Septime (LOCKED)",
    "locked activity must not move",
  );
});

Deno.test("autoOptimizeDayRoute: missing coordinates short-circuits", () => {
  const acts = [
    { title: "A", category: "explore" },
    { title: "B", category: "explore" },
    { title: "C", category: "explore" },
  ];
  const out = autoOptimizeDayRoute(acts);
  assertEquals(out.length, 3);
  // No coords → no reorder; original order preserved
  assertEquals(out.map((a: any) => a.title), ["A", "B", "C"]);
});

Deno.test("autoOptimizeDayRoute: bookingRequired pins the activity", () => {
  const acts = [
    { title: "A", category: "explore", location: { coordinates: { lat: 0, lng: 0 } } },
    {
      title: "Booked tour",
      category: "experience",
      bookingRequired: true,
      location: { coordinates: { lat: 1, lng: 1 } },
    },
    { title: "C", category: "explore", location: { coordinates: { lat: 2, lng: 2 } } },
  ];
  const out = autoOptimizeDayRoute(acts);
  assertEquals(out[1].title, "Booked tour", "booking-required activity must stay put");
});
