import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { checkAndApplyFreeVenue, enforceMarketDiningCap, ALWAYS_FREE_VENUE_PATTERNS } from "./sanitization.ts";

// ─── Tier 1 pattern matching ───

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes miradouro", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("Miradouro da Graça")), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes praça", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("Praça do Comércio")), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes jardim", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("Jardim Botânico")), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes park", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("Hyde Park")), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes pont (bridge)", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("Pont Neuf")), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes bridge", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("Tower Bridge Walk")), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes basilique", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("Basilique du Sacré-Cœur")), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes église", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("Église Saint-Sulpice")), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes champs-élysées", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("Stroll along the Champs-Élysées")), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes montmartre", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("Explore Montmartre")), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes sacré-cœur", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("Visit Sacré-Cœur")), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes tuileries", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("Tuileries Garden")), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes champ de mars", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("Champ de Mars")), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes île saint-louis", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("Walk on Île Saint-Louis")), true);
});

// ─── checkAndApplyFreeVenue function tests ───

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

Deno.test("checkAndApplyFreeVenue zeros Pont Neuf", () => {
  const activity = {
    title: "Walk across Pont Neuf",
    category: "explore",
    price_per_person: 10,
    price: 10,
  };
  const result = checkAndApplyFreeVenue(activity, "test");
  assertEquals(result, true);
  assertEquals(activity.price_per_person, 0);
});

Deno.test("checkAndApplyFreeVenue zeros Sacré-Cœur", () => {
  const activity = {
    title: "Visit Sacré-Cœur",
    category: "explore",
    price_per_person: 15,
    price: 15,
  };
  const result = checkAndApplyFreeVenue(activity, "test");
  assertEquals(result, true);
  assertEquals(activity.price_per_person, 0);
});

Deno.test("checkAndApplyFreeVenue zeros Champs-Élysées", () => {
  const activity = {
    title: "Stroll along the Champs-Élysées",
    category: "explore",
    price_per_person: 12,
    price: 12,
  };
  const result = checkAndApplyFreeVenue(activity, "test");
  assertEquals(result, true);
  assertEquals(activity.price_per_person, 0);
});

Deno.test("checkAndApplyFreeVenue zeros Tuileries Garden", () => {
  const activity = {
    title: "Morning in the Tuileries Garden",
    category: "explore",
    price_per_person: 8,
    price: 8,
  };
  const result = checkAndApplyFreeVenue(activity, "test");
  assertEquals(result, true);
  assertEquals(activity.price_per_person, 0);
});

Deno.test("checkAndApplyFreeVenue does NOT zero Musée de l'Orangerie", () => {
  const activity = {
    title: "Musée de l'Orangerie",
    category: "culture",
    price_per_person: 13,
    price: 13,
  };
  const result = checkAndApplyFreeVenue(activity, "test");
  assertEquals(result, false);
  assertEquals(activity.price_per_person, 13);
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

Deno.test("checkAndApplyFreeVenue does NOT zero galerie", () => {
  const activity = {
    title: "Galerie Vivienne",
    category: "culture",
    price_per_person: 10,
    price: 10,
  };
  const result = checkAndApplyFreeVenue(activity, "test");
  assertEquals(result, false);
  assertEquals(activity.price_per_person, 10);
});

// ─── New universal patterns ───

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes campo (Italian square)", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("Campo de' Fiori")), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes platz (German square)", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("Alexanderplatz")), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes seafront", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("Walk along the Seafront")), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes corniche", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("Corniche Promenade")), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes monument", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("War Monument")), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes fountain/fontaine", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("Fontaine des Innocents")), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes statue", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("Statue of Liberty viewpoint")), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes mosque", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("Blue Mosque")), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes temple", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("Sensō-ji Temple")), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes synagogue", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("Great Synagogue")), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes souk", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("Souk el-Attarine")), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes puente (Spanish bridge)", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("Puente Nuevo")), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes brücke (German bridge)", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("Oberbaumbrücke")), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes overlook", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("Scenic Overlook")), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes belvedere", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("Belvedere viewpoint")), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes market", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("Borough Market")), true);
});

Deno.test("ALWAYS_FREE_VENUE_PATTERNS includes mercato", () => {
  assertEquals(ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test("Mercato Centrale")), true);
});

// ─── checkAndApplyFreeVenue with new patterns ───

Deno.test("checkAndApplyFreeVenue zeros fountain in title", () => {
  const activity = {
    title: "Visit the Fontaine des Innocents",
    category: "explore",
    price_per_person: 15,
    price: 15,
  };
  const result = checkAndApplyFreeVenue(activity, "test");
  assertEquals(result, true);
  assertEquals(activity.price_per_person, 0);
});

Deno.test("checkAndApplyFreeVenue zeros mosque in title", () => {
  const activity = {
    title: "Visit the Blue Mosque",
    category: "explore",
    price_per_person: 10,
    price: 10,
  };
  const result = checkAndApplyFreeVenue(activity, "test");
  assertEquals(result, true);
  assertEquals(activity.price_per_person, 0);
});

Deno.test("checkAndApplyFreeVenue zeros market entry", () => {
  const activity = {
    title: "Explore Borough Market",
    category: "explore",
    price_per_person: 12,
    price: 12,
  };
  const result = checkAndApplyFreeVenue(activity, "test");
  assertEquals(result, true);
  assertEquals(activity.price_per_person, 0);
});

Deno.test("checkAndApplyFreeVenue does NOT zero spa", () => {
  const activity = {
    title: "Spa Treatment at the Park Hotel",
    category: "wellness",
    price_per_person: 80,
    price: 80,
  };
  const result = checkAndApplyFreeVenue(activity, "test");
  assertEquals(result, false);
  assertEquals(activity.price_per_person, 80);
});

Deno.test("checkAndApplyFreeVenue does NOT zero gondola", () => {
  const activity = {
    title: "Gondola Ride on the Canal",
    category: "activity",
    price_per_person: 40,
    price: 40,
  };
  const result = checkAndApplyFreeVenue(activity, "test");
  assertEquals(result, false);
  assertEquals(activity.price_per_person, 40);
});

Deno.test("checkAndApplyFreeVenue does NOT zero cooking class", () => {
  const activity = {
    title: "Cooking Class at the Market",
    category: "experience",
    price_per_person: 65,
    price: 65,
  };
  const result = checkAndApplyFreeVenue(activity, "test");
  assertEquals(result, false);
  assertEquals(activity.price_per_person, 65);
});

// ─── enforceMarketDiningCap tests ───

Deno.test("enforceMarketDiningCap caps dining at market to €20", () => {
  const activity = {
    title: "Lunch at Mercato Centrale",
    category: "dining",
    price_per_person: 35,
    price: 35,
  };
  const result = enforceMarketDiningCap(activity, "test");
  assertEquals(result, true);
  assertEquals(activity.price_per_person, 20);
  assertEquals(activity.price, 20);
});

Deno.test("enforceMarketDiningCap does NOT cap if already under €20", () => {
  const activity = {
    title: "Snack at the Souk",
    category: "dining",
    price_per_person: 8,
    price: 8,
  };
  const result = enforceMarketDiningCap(activity, "test");
  assertEquals(result, false);
  assertEquals(activity.price_per_person, 8);
});

Deno.test("enforceMarketDiningCap does NOT cap non-dining at market", () => {
  const activity = {
    title: "Explore Borough Market",
    category: "explore",
    price_per_person: 30,
    price: 30,
  };
  const result = enforceMarketDiningCap(activity, "test");
  assertEquals(result, false);
  assertEquals(activity.price_per_person, 30);
});
