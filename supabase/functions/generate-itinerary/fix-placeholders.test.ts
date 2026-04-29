// Tests for fix-placeholders.ts — placeholder detection patterns and fallback application.
// Backs the "no generic names" memory rule.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  PLACEHOLDER_TITLE_PATTERNS,
  PLACEHOLDER_VENUE_PATTERNS,
  isPlaceholderMeal,
  applyFallbackToActivity,
  GENERIC_VENUE_TEMPLATES,
} from "./fix-placeholders.ts";

const matchesAnyTitle = (s: string) =>
  PLACEHOLDER_TITLE_PATTERNS.some((p) => p.test(s));
const matchesAnyVenue = (s: string) =>
  PLACEHOLDER_VENUE_PATTERNS.some((p) => p.test(s));

// ---------- PLACEHOLDER_TITLE_PATTERNS ----------

Deno.test("placeholder titles: 'Lunch at a bistro' is generic", () => {
  assertEquals(matchesAnyTitle("Lunch at a bistro"), true);
  assertEquals(matchesAnyTitle("Dinner at a traditional trattoria"), true);
  assertEquals(matchesAnyTitle("Breakfast at the local boulangerie"), true);
});

Deno.test("placeholder titles: verb-led generics flagged", () => {
  assertEquals(matchesAnyTitle("Enjoy breakfast"), true);
  assertEquals(matchesAnyTitle("Have dinner"), true);
  assertEquals(matchesAnyTitle("Grab lunch"), true);
  assertEquals(matchesAnyTitle("Try some local food"), true);
});

Deno.test("placeholder titles: real named venues are NOT flagged", () => {
  assertEquals(matchesAnyTitle("Dinner at Septime"), false);
  assertEquals(matchesAnyTitle("Lunch at Le Comptoir du Relais"), false);
  assertEquals(matchesAnyTitle("Breakfast at Café de Flore"), false);
});

Deno.test("placeholder titles: 'sample local cuisine' flagged", () => {
  assertEquals(matchesAnyTitle("Sample local cuisine"), true);
  assertEquals(matchesAnyTitle("Sample traditional dishes"), true);
});

// ---------- PLACEHOLDER_VENUE_PATTERNS ----------

Deno.test("placeholder venues: 'the destination' / 'the city' flagged", () => {
  assertEquals(matchesAnyVenue("The destination"), true);
  assertEquals(matchesAnyVenue("the city"), true);
  assertEquals(matchesAnyVenue("Downtown"), true);
  assertEquals(matchesAnyVenue("near the hotel"), true);
});

Deno.test("placeholder venues: real venue names are NOT flagged", () => {
  assertEquals(matchesAnyVenue("Septime"), false);
  assertEquals(matchesAnyVenue("Le Comptoir du Relais"), false);
});

Deno.test("placeholder venues: super-short names flagged", () => {
  // /^.{0,3}$/ catches 0-3 char venue names
  assertEquals(matchesAnyVenue(""), true);
  assertEquals(matchesAnyVenue("Bar"), true);
});

// ---------- isPlaceholderMeal ----------

Deno.test("isPlaceholderMeal: dining card with generic title flagged", () => {
  const act = { title: "Lunch at a bistro", venue_name: "", category: "DINING" };
  assertEquals(isPlaceholderMeal(act, "Paris"), true);
});

Deno.test("isPlaceholderMeal: venue equals city name flagged", () => {
  const act = { title: "Dinner", venue_name: "Paris", category: "DINING" };
  assertEquals(isPlaceholderMeal(act, "Paris"), true);
});

Deno.test("isPlaceholderMeal: venue equals title flagged", () => {
  const act = {
    title: "Lunch at a bistro",
    venue_name: "Lunch at a bistro",
    category: "DINING",
  };
  assertEquals(isPlaceholderMeal(act, "Paris"), true);
});

Deno.test("isPlaceholderMeal: real dining card NOT flagged", () => {
  const act = { title: "Dinner at Septime", venue_name: "Septime", category: "DINING" };
  assertEquals(isPlaceholderMeal(act, "Paris"), false);
});

Deno.test("isPlaceholderMeal: non-dining categories never flagged", () => {
  const act = { title: "Visit a museum", venue_name: "", category: "MUSEUM" };
  assertEquals(isPlaceholderMeal(act, "Paris"), false);
});

// ---------- applyFallbackToActivity ----------

Deno.test("applyFallbackToActivity: rewrites title, venue, location, cost", () => {
  const activity: any = {
    title: "Dinner at a bistro",
    location: { name: "old", address: "old" },
    cost: { amount: 0 },
  };
  const fallback = {
    name: "Septime",
    address: "80 Rue de Charonne, 75011 Paris",
    description: "Modern bistronomy",
    price: 80,
  };
  const used = new Set<string>();
  applyFallbackToActivity(activity, fallback, "dinner", used);

  assertEquals(activity.title, "Dinner at Septime");
  assertEquals(activity.location.name, "Septime");
  assertEquals(activity.venue_name, "Septime");
  assertEquals(activity.cost.amount, 80);
  assertEquals(used.has("septime"), true);
});

Deno.test("applyFallbackToActivity: clamps price to dining config range", () => {
  const activity: any = { title: "Lunch", location: null, cost: { amount: 0 } };
  const fallback = { name: "X", address: "Y", description: "test", price: 200 };
  const used = new Set<string>();
  const diningConfig: any = { priceRange: { lunch: [10, 40] } };

  applyFallbackToActivity(activity, fallback, "lunch", used, diningConfig);
  assertEquals(activity.cost.amount, 40, "should clamp to lunch upper bound");
});

// ---------- GENERIC_VENUE_TEMPLATES sanity ----------

Deno.test("GENERIC_VENUE_TEMPLATES: every meal slot has at least 3 options", () => {
  for (const slot of ["breakfast", "lunch", "dinner"] as const) {
    const list = GENERIC_VENUE_TEMPLATES[slot];
    assertEquals(Array.isArray(list), true, `slot ${slot} must be an array`);
    assertEquals(list.length >= 3, true, `slot ${slot} needs >=3 templates`);
  }
});
