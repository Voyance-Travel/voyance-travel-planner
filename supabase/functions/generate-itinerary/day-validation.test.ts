// Tests for day-validation.ts — chain-restaurant filter & meal-slot detection.
// These are the gates that decide whether a generated day is acceptable.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isChainRestaurant,
  filterChainRestaurants,
  detectMealSlots,
  CHAIN_RESTAURANT_BLOCKLIST,
} from "./day-validation.ts";

// ---------- isChainRestaurant ----------

Deno.test("isChainRestaurant: exact name match", () => {
  // pick the first entry from the actual blocklist so the test can't drift
  const sample = CHAIN_RESTAURANT_BLOCKLIST[0];
  assertEquals(isChainRestaurant(sample), true);
});

Deno.test("isChainRestaurant: case-insensitive substring match", () => {
  // "Five Guys Burgers and Fries" should match "five guys"
  if (CHAIN_RESTAURANT_BLOCKLIST.includes("five guys")) {
    assertEquals(isChainRestaurant("Five Guys Burgers and Fries"), true);
    assertEquals(isChainRestaurant("FIVE GUYS"), true);
  }
});

Deno.test("isChainRestaurant: empty string returns false", () => {
  assertEquals(isChainRestaurant(""), false);
});

Deno.test("isChainRestaurant: independent restaurant returns false", () => {
  assertEquals(
    isChainRestaurant("Chez Janou"),
    false,
    "real Paris bistro must not be flagged as a chain",
  );
  assertEquals(isChainRestaurant("Septime"), false);
  assertEquals(isChainRestaurant("Le Comptoir du Relais"), false);
});

// ---------- filterChainRestaurants ----------

Deno.test("filterChainRestaurants: removes chains, keeps independents", () => {
  const sampleChain = CHAIN_RESTAURANT_BLOCKLIST[0];
  const acts = [
    { title: `Lunch at ${sampleChain}`, venue_name: sampleChain, category: "DINING" },
    { title: "Dinner at Septime", venue_name: "Septime", category: "DINING" },
    { title: "Coffee at Café de Flore", venue_name: "Café de Flore", category: "DINING" },
  ];
  const { filtered, removedChains } = filterChainRestaurants(acts as any);
  assertEquals(filtered.length, 2);
  assertEquals(removedChains.length, 1);
  assertEquals(
    filtered.every((a: any) => !a.venue_name.toLowerCase().includes(sampleChain)),
    true,
  );
});

Deno.test("filterChainRestaurants: non-dining activities pass through unchanged", () => {
  const acts = [
    { title: "Visit Louvre", venue_name: "Louvre", category: "MUSEUM" },
    { title: "Walk Seine", venue_name: "Seine", category: "EXPLORE" },
  ];
  const { filtered, removedChains } = filterChainRestaurants(acts as any);
  assertEquals(filtered.length, 2);
  assertEquals(removedChains.length, 0);
});

// ---------- detectMealSlots ----------

Deno.test("detectMealSlots: finds breakfast/lunch/dinner from titles", () => {
  const acts = [
    { title: "Breakfast at Café de Flore", category: "DINING" },
    { title: "Lunch at Le Comptoir", category: "DINING" },
    { title: "Dinner at Septime", category: "DINING" },
  ];
  const meals = detectMealSlots(acts as any);
  assertEquals(meals, ["breakfast", "lunch", "dinner"]);
});

Deno.test("detectMealSlots: time-based detection for dining-category cards", () => {
  // "De Kas" at 19:00 with no meal keyword in title → still counts as dinner
  const acts = [
    { title: "De Kas", category: "DINING", startTime: "19:00" },
  ];
  const meals = detectMealSlots(acts as any);
  assertEquals(meals.includes("dinner"), true);
});

Deno.test("detectMealSlots: drinks-only venues at dinner time do NOT count as dinner", () => {
  const acts = [
    { title: "Cocktails at Speakeasy Bar", category: "DINING", startTime: "20:00" },
  ];
  const meals = detectMealSlots(acts as any);
  assertEquals(
    meals.includes("dinner"),
    false,
    "memory rule: drinks-only != dinner",
  );
});

Deno.test("detectMealSlots: structural transit titles do NOT satisfy meal guard", () => {
  // "Walk to Dinner" is a transit card; must not count as dinner
  const acts = [
    { title: "Walk to Dinner", category: "transport" },
  ];
  const meals = detectMealSlots(acts as any);
  assertEquals(meals.includes("dinner"), false);
});

Deno.test("detectMealSlots: time-based morning card classifies as breakfast", () => {
  const acts = [
    { title: "Morning at the bakery", category: "DINING", startTime: "08:30" },
  ];
  const meals = detectMealSlots(acts as any);
  assertEquals(meals.includes("breakfast"), true);
});

Deno.test("detectMealSlots: noon card classifies as lunch", () => {
  const acts = [
    { title: "Casual meal", category: "DINING", startTime: "13:00" },
  ];
  const meals = detectMealSlots(acts as any);
  assertEquals(meals.includes("lunch"), true);
});

Deno.test("detectMealSlots: empty input returns empty array", () => {
  assertEquals(detectMealSlots([]), []);
});
