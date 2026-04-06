import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { checkAndApplyFreeVenue, ALWAYS_FREE_VENUE_PATTERNS } from "./sanitization.ts";

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes miradouro", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.test("Miradouro da Graça"), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes praça", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.test("Praça do Comércio"), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes jardim", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.test("Jardim Botânico"), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes park", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.test("Hyde Park"), true);
});

Deno.test("checkAndApplyFreeVenue zeros miradouro in title", () => {
  const activity = {
    title: "Sunset Views at the Miradouro",
    category: "explore",
    price_per_person: 23,
    price: 23,
  };
  const result = checkAndApplyFreeVenue(activity, "test");
  assertEquals(result, true);
  assertEquals(activity.price_per_person, 0);
  assertEquals(activity.price, 0);
  assertEquals((activity as any).is_free, true);
});

Deno.test("checkAndApplyFreeVenue zeros miradouro in venue_name only", () => {
  const activity = {
    title: "Views at São Pedro de Alcântara",
    venue_name: "Miradouro de São Pedro de Alcântara",
    category: "explore",
    price_per_person: 23,
    price: 23,
  };
  const result = checkAndApplyFreeVenue(activity, "test");
  assertEquals(result, true);
  assertEquals(activity.price_per_person, 0);
});

Deno.test("checkAndApplyFreeVenue zeros praça in title", () => {
  const activity = {
    title: "Praça do Comércio",
    category: "explore",
    price_per_person: 23,
    price: 23,
  };
  const result = checkAndApplyFreeVenue(activity, "test");
  assertEquals(result, true);
  assertEquals(activity.price_per_person, 0);
});

Deno.test("checkAndApplyFreeVenue does NOT zero museums", () => {
  const activity = {
    title: "National Museum of Ancient Art",
    category: "culture",
    price_per_person: 15,
    price: 15,
    booking_required: true,
  };
  const result = checkAndApplyFreeVenue(activity, "test");
  assertEquals(result, false);
  assertEquals(activity.price_per_person, 15);
});

Deno.test("checkAndApplyFreeVenue does NOT zero guided tours", () => {
  const activity = {
    title: "Guided Tour of the Gardens",
    category: "tour",
    price_per_person: 45,
    price: 45,
  };
  const result = checkAndApplyFreeVenue(activity, "test");
  assertEquals(result, false);
  assertEquals(activity.price_per_person, 45);
});

Deno.test("checkAndApplyFreeVenue does NOT zero botanical gardens (ticketed)", () => {
  const activity = {
    title: "Visit the Botanical Garden",
    category: "explore",
    price_per_person: 8,
    price: 8,
    booking_required: false,
    description: "The Jardim Botânico tropical garden with rare plants",
  };
  // "botanical" matches PAID_EXPERIENCE_RE
  const result = checkAndApplyFreeVenue(activity, "test");
  assertEquals(result, false);
  assertEquals(activity.price_per_person, 8);
});

Deno.test("checkAndApplyFreeVenue skips already-free activities", () => {
  const activity = {
    title: "Miradouro da Graça",
    category: "explore",
    price_per_person: 0,
    price: 0,
  };
  // effectiveCost <= 0 → returns false (no-op, already free)
  const result = checkAndApplyFreeVenue(activity, "test");
  assertEquals(result, false);
});
