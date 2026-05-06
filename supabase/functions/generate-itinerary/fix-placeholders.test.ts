// Tests for fix-placeholders.ts — placeholder detection patterns and fallback application.
// Backs the "no generic names" memory rule.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  PLACEHOLDER_TITLE_PATTERNS,
  PLACEHOLDER_VENUE_PATTERNS,
  isPlaceholderMeal,
  applyFallbackToActivity,
  matchesAIStubVenue,
  isPlaceholderWellness,
  getRandomFallbackWellness,
  applyFallbackWellnessToActivity,
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

// ---------- isPlaceholderWellness ----------

Deno.test("wellness: 'Private Wellness Refresh' with no venue is flagged", () => {
  const act = { title: "Private Wellness Refresh", category: "wellness", location: { name: "" } };
  assertEquals(isPlaceholderWellness(act, "Paris"), true);
});

Deno.test("wellness: 'Spa Time at Your Hotel' is flagged", () => {
  const act = { title: "Spa Time", category: "wellness", location: { name: "Your Hotel" } };
  assertEquals(isPlaceholderWellness(act, "Paris", "Your Hotel"), true);
});

Deno.test("wellness: real named spa with numeric address is NOT flagged", () => {
  const act = {
    title: "Spa Session at Spa Valmont at Le Meurice",
    category: "wellness",
    location: { name: "Spa Valmont at Le Meurice", address: "228 Rue de Rivoli, 75001 Paris" },
  };
  assertEquals(isPlaceholderWellness(act, "Paris"), false);
});

Deno.test("wellness: known fallback venue (no address) is NOT flagged via allowlist", () => {
  const act = {
    title: "Spa Session at Hammam Pacha",
    category: "wellness",
    location: { name: "Hammam Pacha", address: "" },
  };
  assertEquals(isPlaceholderWellness(act, "Paris"), false);
});

Deno.test("wellness: activity with google_place_id is NOT flagged", () => {
  const act = {
    title: "Personalized Facial",
    category: "wellness",
    location: { name: "Some Real Spa", address: "" },
    metadata: { google_place_id: "ChIJ_xyz" },
  };
  assertEquals(isPlaceholderWellness(act, "Paris"), false);
});

Deno.test("wellness: 'Glow & Wellness Facial Ritual' with no venue is flagged", () => {
  const act = {
    title: "Glow & Wellness Facial Ritual",
    category: "wellness",
    location: { name: "" },
  };
  assertEquals(isPlaceholderWellness(act, "Paris"), true);
});

Deno.test("wellness: 'Personalized Facial Ritual' (no spa keyword) is flagged", () => {
  const act = {
    title: "Personalized Facial Ritual",
    category: "wellness",
    location: { name: "" },
  };
  assertEquals(isPlaceholderWellness(act, "Paris"), true);
});

Deno.test("wellness: 'Signature Facial' with venue 'Hotel Spa' is flagged", () => {
  const act = {
    title: "Signature Facial",
    category: "wellness",
    location: { name: "Hotel Spa", address: "" },
  };
  assertEquals(isPlaceholderWellness(act, "Paris"), true);
});

Deno.test("wellness: invented long venue name without place id or address is flagged", () => {
  const act = {
    title: "Hot Stone Massage",
    category: "wellness",
    location: { name: "The Serenity Spa Lounge", address: "" },
  };
  assertEquals(isPlaceholderWellness(act, "Paris"), true);
});

Deno.test("wellness: non-wellness activity is NOT flagged", () => {
  const act = { title: "Dinner at Septime", category: "dining", location: { name: "Septime" } };
  assertEquals(isPlaceholderWellness(act, "Paris"), false);
});

Deno.test("wellness fallback: Paris returns a real named venue", () => {
  const used = new Set<string>();
  const fb = getRandomFallbackWellness("Paris", used);
  if (!fb) throw new Error("expected a Paris fallback wellness venue");
  assertEquals(typeof fb.name, "string");
  assertEquals(fb.name.length > 3, true);
  assertEquals(fb.price > 0, true);
});

Deno.test("wellness fallback: unknown city returns null", () => {
  assertEquals(getRandomFallbackWellness("Atlantis", new Set()), null);
});

Deno.test("applyFallbackWellnessToActivity rewrites title, venue, cost", () => {
  const act: any = { title: "Private Wellness Refresh", cost: { amount: 261 }, cost_per_person: 261 };
  const fb = { name: "Spa Test", address: "1 Test St", price: 200, description: "Test spa." };
  applyFallbackWellnessToActivity(act, fb, new Set());
  assertEquals(act.title, "Spa Session at Spa Test");
  assertEquals(act.location.name, "Spa Test");
  assertEquals(act.cost.amount, 200);
  assertEquals(act.cost_per_person, 200);
});
