import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { detectWaterCrossing } from "../../_shared/transit-mode.ts";

Deno.test("detectWaterCrossing: Topkapi → Çiya (Bosphorus) → Istanbul crossing", () => {
  const r = detectWaterCrossing(
    { lat: 41.0115, lng: 28.9833 },  // Topkapi
    { lat: 40.9893, lng: 29.0254 },  // Çiya Sofrası, Kadıköy
  );
  assert(r !== null);
  assertEquals(r!.city, "Istanbul");
});

Deno.test("detectWaterCrossing: Sultanahmet → Galata (both European) → null", () => {
  const r = detectWaterCrossing(
    { lat: 41.0086, lng: 28.9799 },  // Sultanahmet
    { lat: 41.0257, lng: 28.9744 },  // Galata
  );
  assertEquals(r, null);
});

Deno.test("detectWaterCrossing: Manhattan → DUMBO (East River) → NYC crossing", () => {
  const r = detectWaterCrossing(
    { lat: 40.758,  lng: -74.000 },  // Times Square area
    { lat: 40.703,  lng: -73.989 },  // DUMBO, Brooklyn
  );
  assert(r !== null);
  assertEquals(r!.city, "New York");
});

Deno.test("detectWaterCrossing: Paris ↔ Marais (lng ≈ 2.35, outside London bbox) → null", () => {
  const r = detectWaterCrossing(
    { lat: 48.8566, lng: 2.3522 },
    { lat: 48.8606, lng: 2.3622 },
  );
  assertEquals(r, null);
});

Deno.test("detectWaterCrossing: SF Embarcadero → Oakland (Bay) → SF crossing", () => {
  const r = detectWaterCrossing(
    { lat: 37.795, lng: -122.395 },  // SF Embarcadero
    { lat: 37.804, lng: -122.270 },  // Oakland
  );
  assert(r !== null);
  assertEquals(r!.city, "San Francisco");
});
