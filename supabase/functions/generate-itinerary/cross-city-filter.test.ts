import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isCrossCityAddress, detectCrossCityMention, extractCityFromFormattedAddress } from "./cross-city-filter.ts";

Deno.test("flags Rome address when destination is Venice", () => {
  const act = {
    title: "Sant'Eustachio Il Caffè",
    category: "dining",
    location: { address: "Piazza di Sant'Eustachio, 82, 00186 Roma RM, Italy" },
  };
  assertEquals(isCrossCityAddress(act, "Venice, Italy"), "Rome");
});

Deno.test("flags Florence address when destination is Venice", () => {
  const act = {
    title: "Trattoria Sostanza",
    category: "restaurant",
    address: "Via del Porcellana, 25/R, 50123 Firenze FI, Italy",
  };
  assertEquals(isCrossCityAddress(act, "Venice"), "Florence");
});

Deno.test("allows correct-city Venice address", () => {
  const act = {
    title: "Trattoria alla Madonna",
    category: "dining",
    location: { address: "Calle de la Madonna, 594, 30125 Venezia VE, Italy" },
  };
  assertEquals(isCrossCityAddress(act, "Venice, Italy"), null);
});

Deno.test("locked exemption is caller responsibility — function still detects", () => {
  // The filter helper itself doesn't know about locks; callers skip it.
  const act = {
    title: "All'Antico Vinaio",
    category: "food",
    location: { address: "Via dei Neri, 74/R, 50122 Firenze FI, Italy" },
    locked: true,
  };
  assert(isCrossCityAddress(act, "Venice") === "Florence");
});

Deno.test("returns null when destination country has no token map", () => {
  assertEquals(detectCrossCityMention("Some address", "Reykjavik, Iceland"), null);
});

Deno.test("extractCityFromFormattedAddress parses Italian address", () => {
  const city = extractCityFromFormattedAddress("Piazza di Sant'Eustachio, 82, 00186 Roma RM, Italy");
  assert(city && /Roma/i.test(city));
});

Deno.test("non-dining strings without city tokens not flagged", () => {
  assertEquals(detectCrossCityMention("Calle Larga 123", "Venice, Italy"), null);
});
