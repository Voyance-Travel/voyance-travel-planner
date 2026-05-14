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
  /**
   * Opt out of the FROZEN gate. Default false. Page-load / hydration /
   * background self-heal paths MUST NEVER set this — they are exactly the
   * leak paths that silently re-shape ready trips on refresh. User-initiated
   * mutations (chat actions, regen, lock toggle, drag/reorder, undo/redo,
   * smart-finish, …) opt in here OR carry a whitelisted `saveReason` (see
   * `frozen-guard.ts::USER_SAVE_REASON_PREFIXES`).
   * See mem://constraints/itinerary/frozen-after-ready.
   */
  allowFrozenWrite?: boolean;
  /** Free-form save reason — also consulted by the FROZEN gate whitelist
   *  (`frozen-guard.ts::isUserSaveReason`). */
  saveReason?: string;
}

export interface PersistResult {
  error: any;
  /** True when the new `days` array was rejected for being a regression
   *  against the on-disk version; the on-disk `itinerary_data` was kept
   *  intact, only `extraUpdate` (status, metadata) was applied. */
  regressionBlocked?: boolean;
  /** True when the FROZEN gate blocked the JSONB write (extraUpdate metadata
   *  / status flags still applied). */
  frozenBlocked?: boolean;
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

  // ── FROZEN GATE (single backend chokepoint) ─────────────────────
  // Once the trip is frozen, page-load / background / refresh-time writers
  // MUST NOT touch `itinerary_data`. We still apply `extraUpdate` so callers
  // like cost-repair can stamp `last_cost_repair_at` without re-shaping the
  // plan. See mem://constraints/itinerary/frozen-after-ready.
  try {
    const { isTripFrozen, assertWriteAllowed } = await import('./frozen-guard.ts');
    const status = await isTripFrozen(supabase, tripId);
    const verdict = assertWriteAllowed({
      frozen: status.frozen,
      allowFrozenWrite: options.allowFrozenWrite,
      saveReason: options.saveReason,
      label,
    });
    if (verdict.blocked) {
      console.log(
        `[${label}] [FROZEN_BLOCKED] tripId=${tripId} reason=${verdict.reason} status=${status.status} frozenAt=${status.frozenAt || 'n/a'}`,
      );
      const extra = options.extraUpdate || {};
      const updatePayload: Record<string, any> = { ...extra };
      delete updatePayload.itinerary_data;
      // Apply non-itinerary metadata/status writes only, if any remain.
      if (Object.keys(updatePayload).length > 0) {
        const { error } = await supabase.from('trips').update(updatePayload).eq('id', tripId);
        if (error) {
          console.warn(`[${label}] [FROZEN_BLOCKED] extraUpdate write failed:`, error);
          return { error, frozenBlocked: true };
        }
      }
      return { error: null, frozenBlocked: true };
    }
  } catch (e) {
    console.warn(`[${label}] frozen-guard probe failed (non-blocking, allowing write):`, e);
  }


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

  // 3a. Cross-day bleed guard — single chokepoint that moves an untagged
  // pre-dawn head row on Day N+1 back to Day N's tail when Day N ended late
  // (≥22:00). Closes the residual "Day 1 nightcap → Day 2 starts at 01:33"
  // risk untouched by parser stale-head drop / predawn cascade / chronoKey
  // sort (those four layers cover bookend-tagged rows; this catches untagged
  // real LLM-emitted activities).
  // See mem://constraints/itinerary/day1-past-midnight-no-day2-cascade.
  try {
    const { assertNoCrossDayBleed } = await import('./cross-day-bleed-guard.ts');
    const guarded = assertNoCrossDayBleed(days, { site: label });
    if (guarded.changed) {
      // Mutate in place so downstream steps (bookend verification, dining
      // descriptions, regression guard) see the corrected day assignment.
      for (let i = 0; i < days.length; i++) {
        days[i] = guarded.days[i];
      }
      if (itinerary && typeof itinerary === 'object') {
        (itinerary as any).days = days;
      }
      console.log(
        `[${label}] [DAY1_BLEED_GUARD] moved=${guarded.movedCount} pairs across ${days.length} days`,
      );
    }
  } catch (e) {
    console.warn(`[${label}] cross-day bleed guard failed (non-blocking):`, e);
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

      // Identity-swap guard — block writes that keep similar counts but
      // replace the actual venues/themes wholesale (Dublin pattern: same
      // ~10 cards but different restaurants/activities/themes per day).
      // Per-day overlap is computed on a normalized title set; <30%
      // overlap on a previously-populated day is treated as an identity
      // replacement and rejected. Only fires when the on-disk version
      // was healthy and the caller has not opted into regression.
      let identitySwap = false;
      let flippedDays = 0;
      let eligibleOldDays = 0;
      const identityDetail: Array<{ day: number | string; overlap: number; oldCount: number; newCount: number }> = [];
      if (wasHealthy) {
        const norm = (s: any) => String(s || '')
          .toLowerCase()
          .replace(/\(.*?\)/g, ' ')
          .replace(/[^a-z0-9]+/g, ' ')
          .trim();
        const titlesOf = (acts: any[]): Set<string> => {
          const out = new Set<string>();
          for (const a of acts || []) {
            const t = norm(a?.title || a?.name);
            if (!t) continue;
            // Ignore generic logistics/bookend rows — they're noise here.
            if (/^(return to|travel to|walk to|taxi to|metro to|bus to|train to|drive to|check in|check out|checkin|checkout|luggage drop|freshen up|head to|departure flight|arrival flight|transfer to)\b/.test(t)) continue;
            out.add(t);
          }
          return out;
        };
        const newByNum = new Map<number, any>();
        for (const d of (Array.isArray(days) ? days : []) as any[]) {
          if (d && typeof d.dayNumber === 'number') newByNum.set(d.dayNumber, d);
        }
        const oldDaysArr = Array.isArray((existing as any)?.itinerary_data?.days)
          ? ((existing as any).itinerary_data.days as any[])
          : [];
        for (const oldDay of oldDaysArr) {
          if (!oldDay || typeof oldDay.dayNumber !== 'number') continue;
          const oldTitles = titlesOf(oldDay.activities || []);
          if (oldTitles.size < 3) continue;
          eligibleOldDays++;
          const newDay = newByNum.get(oldDay.dayNumber);
          const newTitles = titlesOf(newDay?.activities || []);
          if (newTitles.size === 0) continue;
          let inter = 0;
          for (const t of newTitles) if (oldTitles.has(t)) inter++;
          const overlap = inter / Math.max(oldTitles.size, newTitles.size);
          identityDetail.push({ day: oldDay.dayNumber, overlap: Math.round(overlap * 100) / 100, oldCount: oldTitles.size, newCount: newTitles.size });
          if (overlap < 0.3) flippedDays++;
        }
        // Trip-wide swap signal: ≥2 days flipped AND ≥60% of eligible old
        // days flipped. Single-day chat regenerate / per-day chain writes
        // never trip this. Wholesale Dublin-style replacement (3/3 days
        // flipped) does.
        identitySwap = flippedDays >= 2 && eligibleOldDays > 0 && (flippedDays / eligibleOldDays) >= 0.6;
      }

      if ((isRegression || identitySwap) && !options.allowRegression) {
        regressionBlocked = true;
        const reasonTag = isRegression && identitySwap
          ? 'regression+identity_swap'
          : (identitySwap ? 'identity_replacement_blocked' : 'regression_blocked');
        console.warn(
          `[${label}] [PERSIST_REGRESSION_BLOCKED] reason=${reasonTag} keeping previous days — ` +
            `was meaningful=${oldSummary.meaningfulCount} paid=${oldSummary.paidMeaningfulCount}, ` +
            `now meaningful=${newSummary.meaningfulCount} paid=${newSummary.paidMeaningfulCount}` +
            (identitySwap ? ` overlap=${JSON.stringify(identityDetail)}` : ''),
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
