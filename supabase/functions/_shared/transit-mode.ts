/**
 * Shared transit-tier picker.
 *
 * Centralizes the walk / metro / uber decision used by:
 *   - optimize-itinerary `getHaversineTransport` (post-gen optimization)
 *   - generate-itinerary `enforceTransitModeByDistance` (post-LLM sanitizer)
 *
 * If both call sites share the same tier function, an LLM-emitted
 * "walk" on a 12 km segment cannot survive past the sanitizer.
 *
 * Memory: mem://constraints/itinerary/transit-mode-distance-guard
 */

export const MAX_WALK_DISTANCE_METERS = 650;
export const MAX_WALK_DURATION_MINUTES = 15;

/**
 * Hard ceiling — anything above these triggers the WALK_OVER_THRESHOLD
 * validate→repair→gate cascade (see pipeline/validate-day.ts, repair-day.ts,
 * validation-gate.ts). Higher than the sanitizer ceiling because we only want
 * to fire here once distance is confidently known (post-enrichment).
 */
export const WALK_HARD_DISTANCE_METERS = 1500;
export const WALK_HARD_DURATION_MINUTES = 30;

/**
 * Tier-aware walk ceiling. Luxury / luminary / splurge / premium audiences
 * should not be routed across districts on foot — tighter cap surfaces
 * shorter walks (≥20 min OR ≥1000 m) to the WALK_OVER_THRESHOLD repair so
 * they get swapped to metro/taxi via `pickTransitTier`.
 *
 * Single source of truth for tier→threshold mapping. Used by
 * `pipeline/validate-day.ts::checkWalkOverThreshold`.
 */
export const WALK_LUXURY_DISTANCE_METERS = 1000;
export const WALK_LUXURY_DURATION_MINUTES = 20;

export function isLuxuryTier(budgetTier?: string | null): boolean {
  const t = String(budgetTier || '').toLowerCase().trim();
  return t === 'luxury' || t === 'luminary' || t === 'splurge' || t === 'premium';
}

export function walkThresholdsFor(budgetTier?: string | null): { duration: number; distance: number } {
  return isLuxuryTier(budgetTier)
    ? { duration: WALK_LUXURY_DURATION_MINUTES, distance: WALK_LUXURY_DISTANCE_METERS }
    : { duration: WALK_HARD_DURATION_MINUTES, distance: WALK_HARD_DISTANCE_METERS };
}

export type TransitMethod = 'walk' | 'metro' | 'uber';

export interface TransitTier {
  method: TransitMethod;
  durationMinutes: number;
  costAmount: number;          // EUR/USD — same number, currency stamped at call site
  instructions: string;
  distanceMeters: number;
}

/** Great-circle distance in meters. */
export function haversineMeters(
  lat1: number, lng1: number, lat2: number, lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(a))));
}

export type WaterCrossing = { city: string; reason: string };

/**
 * Hard-coded water/borough boundaries. Detects when a straight-line leg
 * crosses a body of water that pedestrians cannot traverse. Bounding boxes
 * scope the rule to the right city so unrelated lat/lng pairs that happen
 * to share a longitude don't false-positive.
 *
 * Returns null when no boundary is crossed.
 */
export function detectWaterCrossing(
  from: { lat: number; lng: number },
  to:   { lat: number; lng: number },
): WaterCrossing | null {
  // Istanbul — Bosphorus centerline ≈ 29.02 separates European (west) from Asian (east) side
  if (from.lat > 40.8 && from.lat < 41.3 && to.lat > 40.8 && to.lat < 41.3
      && ((from.lng < 29.02 && to.lng > 29.02) || (from.lng > 29.02 && to.lng < 29.02))) {
    return { city: 'Istanbul', reason: 'Bosphorus (Europe ↔ Asia)' };
  }

  // NYC — East River centerline ≈ -73.97 (Manhattan ↔ Brooklyn/Queens)
  if (from.lat > 40.55 && from.lat < 40.92 && to.lat > 40.55 && to.lat < 40.92
      && ((from.lng < -73.97 && to.lng > -73.97) || (from.lng > -73.97 && to.lng < -73.97))) {
    return { city: 'New York', reason: 'East River (Manhattan ↔ Brooklyn/Queens)' };
  }

  // SF Bay — centerline ≈ -122.35 (SF ↔ Oakland/Alameda)
  if (from.lat > 37.7 && from.lat < 37.9 && to.lat > 37.7 && to.lat < 37.9
      && ((from.lng < -122.35 && to.lng > -122.35) || (from.lng > -122.35 && to.lng < -122.35))) {
    return { city: 'San Francisco', reason: 'SF Bay (SF ↔ Oakland)' };
  }

  // London — Thames runs roughly east-west around lat 51.505 through central London
  if (from.lng > -0.25 && from.lng < 0.05 && to.lng > -0.25 && to.lng < 0.05
      && ((from.lat < 51.505 && to.lat > 51.505) || (from.lat > 51.505 && to.lat < 51.505))) {
    return { city: 'London', reason: 'Thames (north ↔ south)' };
  }

  return null;
}

/**
 * Pick the best transit tier for a known distance. Mirrors the canonical
 * thresholds from optimize-itinerary `getHaversineTransport`.
 */
export function pickTransitTier(
  distanceMeters: number,
  destinationName: string,
): TransitTier {
  const safeDest = destinationName || 'destination';
  // Walking pace ~5 km/h ≈ 83 m/min.
  const walkMinutes = Math.max(1, Math.round(distanceMeters / 83));

  if (distanceMeters <= MAX_WALK_DISTANCE_METERS && walkMinutes <= MAX_WALK_DURATION_MINUTES) {
    return {
      method: 'walk',
      durationMinutes: walkMinutes,
      costAmount: 0,
      instructions: `Walk ${distanceMeters}m to ${safeDest}`,
      distanceMeters,
    };
  }

  if (distanceMeters < 5000) {
    return {
      method: 'metro',
      durationMinutes: Math.max(5, Math.round(distanceMeters / 417) + 5),
      costAmount: 3,
      instructions: `Take public transit ${(distanceMeters / 1000).toFixed(1)}km to ${safeDest}`,
      distanceMeters,
    };
  }

  return {
    method: 'uber',
    durationMinutes: Math.max(5, Math.round(distanceMeters / 500) + 3),
    costAmount: Math.round(3 + (distanceMeters / 1000) * 1.8),
    instructions: `Take a rideshare ${(distanceMeters / 1000).toFixed(1)}km to ${safeDest}`,
    distanceMeters,
  };
}

/**
 * Conservative fallback when distance may be unknown. Used by the
 * WALK_OVER_THRESHOLD repair handler + validation gate as a single source
 * of truth so thresholds never drift between layers.
 *
 * - Known distance → delegate to `pickTransitTier`.
 * - Unknown/zero distance → taxi default: 20-min floor (or current duration if
 *   higher) at $15.
 */
export function pickTransitFallback(
  distanceMeters: number | null | undefined,
  currentDurationMin?: number,
  destinationName?: string,
): TransitTier {
  const safeDest = destinationName || 'destination';
  if (distanceMeters != null && Number.isFinite(distanceMeters) && distanceMeters > 0) {
    return pickTransitTier(distanceMeters, safeDest);
  }
  const dur = Math.max(Number(currentDurationMin) > 0 ? Number(currentDurationMin) : 0, 20);
  return {
    method: 'uber',
    durationMinutes: dur,
    costAmount: 15,
    instructions: `Taxi to ${safeDest}`,
    distanceMeters: 0,
  };
}

/** Resolve {lat,lng} from a variety of shapes the pipeline emits. */
export function extractCoords(obj: any): { lat: number; lng: number } | null {
  if (!obj || typeof obj !== 'object') return null;
  const candidates = [
    obj,
    obj.coordinates,
    obj.coords,
    obj.location,
    obj.location?.coordinates,
    obj.location?.coords,
    obj.geo,
    obj.position,
  ];
  for (const c of candidates) {
    if (!c || typeof c !== 'object') continue;
    const lat = typeof c.lat === 'number' ? c.lat
      : typeof c.latitude === 'number' ? c.latitude : null;
    const lng = typeof c.lng === 'number' ? c.lng
      : typeof c.lon === 'number' ? c.lon
      : typeof c.longitude === 'number' ? c.longitude : null;
    if (lat != null && lng != null
        && Number.isFinite(lat) && Number.isFinite(lng)
        && !(lat === 0 && lng === 0)) {
      return { lat, lng };
    }
  }
  return null;
}
