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
  /\(\s*(?:(?:[A-Z][A-Z0-9 _-]{1,30}\s+)?(?:slot|placeholder|name|venue)|[A-Z][A-Z0-9]*_[A-Z0-9_]+)\s*\)/i;
const PROMPT_ARTIFACT_REPLACE_RE =
  /\s*\(\s*(?:(?:[A-Z][A-Z0-9 _-]{1,30}\s+)?(?:slot|placeholder|name|venue)|[A-Z][A-Z0-9]*_[A-Z0-9_]+)\s*\)/gi;

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
  /**
   * Opt out of the regression guard. Default false. Only pass `true` for
   * write paths where overwriting a healthier previous version with fewer
   * activities is the intended behavior (e.g. user-initiated reset). The
   * guard is a single boundary that protects against partial / "last-minute
   * patch" generations clobbering a healthy itinerary on disk — the
   * symptom is total cost dropping (e.g. $924 → $340) after a page reload.
   * See mem://constraints/itinerary/no-regression-overwrite.
   */
  allowRegression?: boolean;
}

export interface PersistResult {
  error: any;
  /** True when the new `days` array was rejected for being a regression
   *  against the on-disk version; the on-disk `itinerary_data` was kept
   *  intact, only `extraUpdate` (status, metadata) was applied. */
  regressionBlocked?: boolean;
}

/** Capped-size ring buffer of rejected attempts written under
 *  `metadata.rejected_attempts` for post-mortem debugging. */
const MAX_REJECTED_ATTEMPTS = 3;

export async function persistTripItinerary(
  supabase: any,
  tripId: string,
  itinerary: any,
  options: PersistItineraryOptions = {},
): Promise<PersistResult> {
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

  // 3b. Dining description deterministic safety net — guarantees no dining
  // card persists with an empty `description`. Runs at the single boundary
  // so every write path (final-save, save-itinerary, repair-costs, lock
  // toggles, generation-core) is covered. Uses INLINE_FALLBACK_RESTAURANTS
  // → personalization.whyThisFits → deterministic venue+meal+cuisine
  // template. Never blocks on errors.
  try {
    const { ensureDayDiningDescriptions } = await import('./dining-description-backfill.ts');
    let totalFallback = 0, totalWhy = 0, totalTemplate = 0, totalScanned = 0;
    for (const day of days) {
      if (!day || !Array.isArray(day.activities)) continue;
      const cityForDay = day.city || day.cityName || options.destination || undefined;
      const c = ensureDayDiningDescriptions(day.activities, cityForDay);
      totalFallback += c.fallback;
      totalWhy += c.whyThisFits;
      totalTemplate += c.venueTemplate;
      totalScanned += c.scanned;
    }
    if (totalFallback + totalWhy + totalTemplate > 0) {
      console.log(
        `[${label}] [DINING_DESC_PERSIST_NET] scanned=${totalScanned} fallback=${totalFallback} whyThisFits=${totalWhy} template=${totalTemplate}`,
      );
    }
  } catch (e) {
    console.warn(`[${label}] dining-description persist net failed (non-blocking):`, e);
  }

  // 3c. Hotel-return verification + invariant — single boundary for every
  // write path (fresh generation, intermediate chain, save-itinerary, chat
  // executor). Stamps `metadata.quality.bookend_trace` on each day so the
  // result is auditable in persisted JSON instead of ephemeral console logs.
  // See mem://constraints/itinerary/day-end-hotel-return-bookend.
  try {
    const { runBookendVerification } = await import('./bookend-verification.ts');
    await runBookendVerification(days, {
      destination: options.destination ?? null,
      label,
    });
  } catch (e) {
    console.warn(`[${label}] bookend verification failed (non-blocking):`, e);
  }

  // 4. Regression guard — fetch the on-disk version and refuse to overwrite a
  //    healthy `days` array with a materially worse one. The completeness
  //    probe already classifies skeleton/incomplete plans; this layer makes
  //    sure such a plan never *replaces* a previously-saved healthy one.
  //    Failures here are non-blocking: any probe error falls through to the
  //    normal write path so we don't lock callers out on transient errors.
  let regressionBlocked = false;
  let oldMetadata: Record<string, any> | null = null;
  let oldSummary: { meaningfulCount: number; paidMeaningfulCount: number; dayCount: number } | null = null;
  let newSummary: { meaningfulCount: number; paidMeaningfulCount: number; dayCount: number } | null = null;
  try {
    const { data: existing } = await supabase
      .from('trips')
      .select('itinerary_data, metadata')
      .eq('id', tripId)
      .maybeSingle();
    if (existing) {
      oldMetadata = (existing.metadata as Record<string, any>) || {};
      const oldDays = Array.isArray((existing.itinerary_data as any)?.days)
        ? (existing.itinerary_data as any).days
        : [];
      const { classifyItineraryCompleteness } = await import(
        '../generate-itinerary/day-validation.ts'
      );
      oldSummary = classifyItineraryCompleteness(oldDays);
      newSummary = classifyItineraryCompleteness(days);
      const wasHealthy = oldSummary.meaningfulCount >= 3;
      const minMeaningful = Math.max(3, Math.floor(oldSummary.meaningfulCount * 0.6));
      const minPaid = Math.floor(oldSummary.paidMeaningfulCount * 0.5);
      const isRegression =
        wasHealthy &&
        (newSummary.meaningfulCount < minMeaningful ||
          newSummary.paidMeaningfulCount < minPaid);
      if (isRegression && !options.allowRegression) {
        regressionBlocked = true;
        console.warn(
          `[${label}] [PERSIST_REGRESSION_BLOCKED] keeping previous days — ` +
            `was meaningful=${oldSummary.meaningfulCount} paid=${oldSummary.paidMeaningfulCount}, ` +
            `now meaningful=${newSummary.meaningfulCount} paid=${newSummary.paidMeaningfulCount}`,
        );
      }
    }
  } catch (e) {
    console.warn(`[${label}] regression-guard probe failed (non-blocking):`, e);
  }

  // 5. Write.
  const extra = options.extraUpdate || {};
  const updatePayload: Record<string, any> = { ...extra };

  if (regressionBlocked) {
    // Do NOT write itinerary_data — preserve the healthy on-disk version.
    // Still merge metadata + rejected_attempts ring buffer.
    const existingRejected = Array.isArray((oldMetadata as any)?.rejected_attempts)
      ? ((oldMetadata as any).rejected_attempts as any[])
      : [];
    const callerMetadata = (extra.metadata && typeof extra.metadata === 'object')
      ? extra.metadata as Record<string, any>
      : {};
    const newEntry = {
      at: new Date().toISOString(),
      label,
      reason: 'regression_blocked',
      old: oldSummary,
      attempted: newSummary,
    };
    const rejected = [...existingRejected, newEntry].slice(-MAX_REJECTED_ATTEMPTS);
    updatePayload.metadata = {
      ...(oldMetadata || {}),
      ...callerMetadata,
      rejected_attempts: rejected,
    };
    delete updatePayload.itinerary_data; // belt-and-suspenders
  } else {
    updatePayload.itinerary_data = itinerary;
  }

  const { error } = await supabase.from('trips').update(updatePayload).eq('id', tripId);
  if (error) {
    console.error(`[${label}] trips.update failed:`, error);
  }
  return { error, regressionBlocked };
}
