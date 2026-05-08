/**
 * persist-itinerary — single boundary for writing `trips.itinerary_data`.
 *
 * Every code path that updates the itinerary JSON must go through this helper.
 * It runs (in order):
 *
 *   1. stripPromptArtifactsInTitles — removes leaked template tokens like
 *      "(slot)" / "(AESTHETIC slot)" / "(<LABEL> slot)" from titles & names
 *      so legitimate rows aren't dropped by the contract.
 *   2. enforceContractOnDays — drops ghost rows, placeholder names, and
 *      cross-city venues (per-day cityName preferred, ctx.destination fallback).
 *   3. normalizeDurationsInDays — turns clock-style duration strings into
 *      "Xh Ym" form expected by the renderer.
 *   4. trips.update({ itinerary_data, ...extraUpdate }).eq('id', tripId).
 *
 * Pass `{ skipContract: true }` for write paths that must never drop rows
 * (e.g. lock toggles, user edits). Duration normalize + artifact strip still
 * run because they only mutate strings, never remove activities.
 */

import { enforceContractOnDays } from './persist-day-contract.ts';

// IMPORTANT: keep two separate regexes — a non-global one for `.test()` and a
// global one for `.replace()`. Sharing a single `/g` regex across `.test()`
// calls (the previous bug) leaves `lastIndex` set between calls, which made
// `(AESTHETIC slot)` / `(slot)` strips intermittently no-op on titles after
// the first match in a run. That is the root cause of the "intermittent"
// prompt-artifact leak users keep seeing on fresh generations.
const PROMPT_ARTIFACT_TEST_RE =
  /\(\s*(?:[A-Z][A-Z0-9 _-]{1,30}\s+)?(?:slot|placeholder|name|venue)\s*\)/i;
const PROMPT_ARTIFACT_REPLACE_RE =
  /\s*\(\s*(?:[A-Z][A-Z0-9 _-]{1,30}\s+)?(?:slot|placeholder|name|venue)\s*\)/gi;

export function stripPromptArtifactsInTitles(days: any[]): number {
  if (!Array.isArray(days)) return 0;
  let touched = 0;
  for (const day of days) {
    if (!day || !Array.isArray(day.activities)) continue;
    for (const a of day.activities) {
      if (!a) continue;
      for (const key of ['title', 'name', 'description']) {
        const v = a[key];
        if (typeof v !== 'string' || !v) continue;
        if (!PROMPT_ARTIFACT_TEST_RE.test(v)) continue;
        const cleaned = v.replace(PROMPT_ARTIFACT_REPLACE_RE, '').replace(/\s{2,}/g, ' ').trim();
        // If the strip empties the title, leave it — the contract will drop
        // the row as a placeholder/prompt-artifact in the next step.
        if (cleaned) {
          a[key] = cleaned;
          touched++;
        }
      }
    }
  }
  return touched;
}

export interface PersistItineraryOptions {
  destination?: string | null;
  skipContract?: boolean;
  extraUpdate?: Record<string, any>;
  /** Label for log lines (e.g. 'save-itinerary', 'generate-trip-day'). */
  label?: string;
}

export async function persistTripItinerary(
  supabase: any,
  tripId: string,
  itinerary: any,
  options: PersistItineraryOptions = {},
): Promise<{ error: any }> {
  const label = options.label || 'persist-itinerary';
  const days = Array.isArray(itinerary?.days) ? itinerary.days : [];

  // 1. Strip prompt artifacts from titles (mutates in place).
  try {
    const stripped = stripPromptArtifactsInTitles(days);
    if (stripped > 0) {
      console.log(`[${label}] stripped prompt-artifact tokens from ${stripped} field(s)`);
    }
  } catch (e) {
    console.warn(`[${label}] strip prompt artifacts failed (non-blocking):`, e);
  }

  // 2. Persist-day contract (skip on lock/user-edit paths).
  if (!options.skipContract) {
    try {
      await enforceContractOnDays(days, { destination: options.destination ?? null });
      if (itinerary && typeof itinerary === 'object') {
        (itinerary as any).days = days;
      }
    } catch (e) {
      console.warn(`[${label}] persist-day contract failed (non-blocking):`, e);
    }
  }

  // 3. Duration normalization.
  try {
    const mod = await import('../generate-itinerary/_shared/duration-format.ts');
    if (mod?.normalizeDurationsInDays) {
      mod.normalizeDurationsInDays(days);
      if (itinerary && typeof itinerary === 'object') {
        (itinerary as any).days = days;
      }
    }
  } catch (e) {
    console.warn(`[${label}] duration normalization failed (non-blocking):`, e);
  }

  // 4. Write.
  const updatePayload: Record<string, any> = {
    itinerary_data: itinerary,
    ...(options.extraUpdate || {}),
  };
  const { error } = await supabase.from('trips').update(updatePayload).eq('id', tripId);
  if (error) {
    console.error(`[${label}] trips.update failed:`, error);
  }
  return { error };
}
