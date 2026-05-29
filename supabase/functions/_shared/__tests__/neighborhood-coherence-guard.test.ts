/**
 * Tests for neighborhood-coherence-guard.ts
 *
 * Covers the Alfama / Av. da Liberdade root-cause scenario and the
 * general contract of checkNeighborhoodCoherence.
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  checkNeighborhoodCoherence,
  extractNeighborhoodMentions,
  CITY_NEIGHBORHOODS,
} from "../neighborhood-coherence-guard.ts";

// ─── extractNeighborhoodMentions ─────────────────────────────────────────────

Deno.test("extracts Alfama from 'Alfama Wandering'", () => {
  const found = extractNeighborhoodMentions("Alfama Wandering", CITY_NEIGHBORHOODS.lisbon);
  assertEquals(found.includes("alfama"), true);
});

Deno.test("extracts avenida_liberdade from 'Strolling along Avenida da Liberdade'", () => {
  const found = extractNeighborhoodMentions(
    "Strolling along Avenida da Liberdade",
    CITY_NEIGHBORHOODS.lisbon,
  );
  assertEquals(found.includes("avenida_liberdade"), true);
});

Deno.test("extracts avenida_liberdade from abbreviated 'Av. da Liberdade'", () => {
  const found = extractNeighborhoodMentions("Av. da Liberdade", CITY_NEIGHBORHOODS.lisbon);
  assertEquals(found.includes("avenida_liberdade"), true);
});

Deno.test("returns empty for generic text with no Lisbon neighborhood", () => {
  const found = extractNeighborhoodMentions("Morning coffee at the café", CITY_NEIGHBORHOODS.lisbon);
  assertEquals(found.length, 0);
});

// ─── checkNeighborhoodCoherence — THE ROOT CAUSE SCENARIO ────────────────────

Deno.test("Alfama day + Av. da Liberdade activity → mismatch", () => {
  const activity = {
    title: "Window-shopping on Avenida da Liberdade",
    description: "Browse luxury boutiques along Lisbon's grandest boulevard.",
    // NOTE: no 'neighborhood' field — the structured field is intentionally absent
    //       to reproduce the bug where enforceGeoCoherence silently skips the activity.
  };
  const verdict = checkNeighborhoodCoherence(activity, "Alfama Wandering", "Lisbon");
  assertEquals(verdict.mismatch, true, "should detect neighborhood mismatch");
  assertEquals(verdict.dayThemeHoods.includes("alfama"), true);
  assertEquals(verdict.activityHoods.includes("avenida_liberdade"), true);
  assertEquals(verdict.detail.includes("Alfama"), true);
  assertEquals(verdict.detail.includes("Avenida da Liberdade"), true);
});

Deno.test("Alfama day + Alfama activity → coherent (no mismatch)", () => {
  const activity = {
    title: "Wander the steep lanes of Alfama",
    description: "Explore Lisbon's oldest neighbourhood.",
  };
  const verdict = checkNeighborhoodCoherence(activity, "Alfama Wandering", "Lisbon");
  assertEquals(verdict.mismatch, false);
});

Deno.test("Alfama day + activity with NO neighborhood text → no mismatch (silent pass)", () => {
  // Activity title mentions no known Lisbon neighborhood; guard stays silent
  // rather than false-positive on generic content.
  const activity = {
    title: "Morning pastel de nata tasting",
    description: "Try the famous custard tarts at a traditional bakery.",
  };
  const verdict = checkNeighborhoodCoherence(activity, "Alfama Wandering", "Lisbon");
  assertEquals(verdict.mismatch, false);
});

Deno.test("Alfama day + abbreviated 'Av. da Liberdade' in description → mismatch", () => {
  const activity = {
    title: "Luxury shopping",
    description: "Visit flagship stores on Av. da Liberdade.",
  };
  const verdict = checkNeighborhoodCoherence(activity, "Alfama Wandering", "Lisbon");
  assertEquals(verdict.mismatch, true);
});

Deno.test("Shinjuku day + Senso-ji (Asakusa) activity → mismatch", () => {
  const activity = {
    title: "Senso-ji Temple visit",
    description: "Explore the ancient Asakusa shrine.",
  };
  const verdict = checkNeighborhoodCoherence(activity, "Shinjuku Soul & Hidden Alleys", "Tokyo");
  assertEquals(verdict.mismatch, true);
  assertEquals(verdict.dayThemeHoods.includes("shinjuku"), true);
  assertEquals(verdict.activityHoods.some((h) => ["asakusa"].includes(h)), true);
});

Deno.test("returns no mismatch for unknown destination (never false-positive)", () => {
  const activity = { title: "Visit the waterfront" };
  const verdict = checkNeighborhoodCoherence(activity, "Harbour Walk", "Reykjavik");
  assertEquals(verdict.mismatch, false);
});

Deno.test("returns no mismatch when dayTitle has no known neighborhood", () => {
  const activity = {
    title: "Window-shopping on Avenida da Liberdade",
    description: "Luxury boulevard.",
  };
  // "Scenic Lisbon Highlights" contains no recognized hood key
  const verdict = checkNeighborhoodCoherence(activity, "Scenic Lisbon Highlights", "Lisbon");
  assertEquals(verdict.mismatch, false);
});

Deno.test("Le Marais day + Montmartre activity → mismatch", () => {
  const activity = {
    title: "Sunrise at Sacré-Cœur Montmartre",
    description: "Climb the hill to the basilica.",
  };
  const verdict = checkNeighborhoodCoherence(activity, "Le Marais Wandering", "Paris");
  assertEquals(verdict.mismatch, true);
  assertEquals(verdict.dayThemeHoods.includes("le_marais"), true);
});

// ─── Integration: guard is called when hood field is absent ──────────────────

Deno.test("activity.location.address containing 'Avenida da Liberdade' triggers mismatch", () => {
  const activity = {
    title: "Flagship store visit",
    location: {
      name: "Louis Vuitton Lisbon",
      address: "Avenida da Liberdade 180, 1250-096 Lisboa",
    },
    // no neighborhood field
  };
  const verdict = checkNeighborhoodCoherence(activity, "Alfama Wandering", "Lisbon");
  assertEquals(verdict.mismatch, true);
});
