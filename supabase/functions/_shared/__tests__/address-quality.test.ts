import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isWeakAddress } from "../address-quality.ts";

Deno.test("isWeakAddress flags null / empty / whitespace as weak", () => {
  assertEquals(isWeakAddress(null), true);
  assertEquals(isWeakAddress(undefined), true);
  assertEquals(isWeakAddress(""), true);
  assertEquals(isWeakAddress("   "), true);
});

Deno.test("isWeakAddress flags bare neighborhoods / sestieri as weak", () => {
  assertEquals(isWeakAddress("San Marco"), true);
  assertEquals(isWeakAddress("Cannaregio"), true);
  assertEquals(isWeakAddress("trastevere"), true);
  assertEquals(isWeakAddress("Le Marais"), true);
  assertEquals(isWeakAddress("Shibuya"), true);
  assertEquals(isWeakAddress("Centro Storico"), true);
});

Deno.test("isWeakAddress flags addresses without any digit as weak", () => {
  assertEquals(isWeakAddress("Piazza San Marco, Venezia"), true);
  assertEquals(isWeakAddress("Rue de Rivoli, Paris"), true);
});

Deno.test("isWeakAddress passes real street addresses with numbers", () => {
  assertEquals(isWeakAddress("Piazza San Marco 121, 30124 Venezia VE, Italy"), false);
  assertEquals(isWeakAddress("228 Rue de Rivoli, 75001 Paris"), false);
  assertEquals(isWeakAddress("Via del Corso 12, 00186 Roma RM"), false);
});
