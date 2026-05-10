/**
 * Client-side fallback cost estimator for transport mode changes.
 *
 * Used ONLY when `optimize-itinerary` returns no usable cost (no data, or
 * threw). Mirrors the rough tier ordering of
 * `supabase/functions/_shared/transit-mode.ts`.
 *
 * Costs marked with this helper are flagged `basis: 'fallback_estimate'` so a
 * subsequent cost repair pass can re-price them from `cost_reference`.
 */

const MODE_COSTS_USD: Record<string, number> = {
  walk: 0,
  walking: 0,
  metro: 3,
  subway: 3,
  bus: 2,
  train: 5,
  uber: 15,
  taxi: 20,
  rideshare: 12,
  car: 5,
  drive: 5,
};

export function transportModeFallbackCost(mode: string | undefined | null): number {
  if (!mode) return 0;
  return MODE_COSTS_USD[String(mode).toLowerCase()] ?? 0;
}

export const TRANSPORT_FALLBACK_BASIS = 'fallback_estimate' as const;
