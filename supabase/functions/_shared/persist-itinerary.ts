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

/**
 * A "meaningful" activity that is NOT a meal and NOT a logistics row.
 * Used by the meal-only persist guard so we can detect attempts to clobber
 * a previously-rich day with a meals + logistics shell (Stockholm pattern:
 * full generation produced Vasamuseet + City Hall + nightlife, a subsequent
 * save persisted only Breakfast/Lunch/Dinner + flight/checkin).
 */
const MEAL_CAT_RE = /\b(dining|restaurant|breakfast|brunch|lunch|dinner|supper|cafe|food|snack|drinks|cocktail|nightcap)\b/i;
const MEAL_TITLE_RE = /\b(breakfast|brunch|lunch|dinner|supper|nightcap)\b/i;
const LOGISTICS_CAT_RE = /\b(flight|transport|transfer|airport|accommodation|hotel|checkin|check-in|checkout|check-out|logistics|return)\b/i;
const LOGISTICS_TITLE_RE = /^(return to|travel to|walk to|taxi to|metro to|bus to|train to|drive to|check[- ]?in|check[- ]?out|luggage drop|freshen up|head to|departure flight|arrival flight|transfer to)\b/i;

export function countNonMealMeaningfulActivities(days: any[]): number {
  if (!Array.isArray(days)) return 0;
  let total = 0;
  for (const day of days) {
    const acts = Array.isArray(day?.activities) ? day.activities : [];
    for (const a of acts) {
      if (!a) continue;
      const cat = String(a.category || a.type || '').toLowerCase();
      const title = String(a.title || a.name || '').trim();
      if (!title) continue;
      if (MEAL_CAT_RE.test(cat) || MEAL_TITLE_RE.test(title)) continue;
      if (LOGISTICS_CAT_RE.test(cat) || LOGISTICS_TITLE_RE.test(title)) continue;
      total++;
    }
  }
  return total;
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
  /**
   * Opt out of the MEAL-ONLY guard. Default false. The guard rejects writes
   * whose `nonMealMeaningfulCount === 0` when either the previously-persisted
   * itinerary OR the latest `itinerary_versions` row for any day has ≥3
   * non-meal meaningful activities. Closes the Stockholm pattern where a
   * save-itinerary call collapsed a rich generation down to meals + logistics.
   * Only pass `true` for explicit user-initiated meal-only edits (e.g. user
   * deleted every non-meal card themselves).
   */
  allowMealOnly?: boolean;
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
  /** True when the MEAL-ONLY guard blocked the JSONB write. */
  mealOnlyBlocked?: boolean;
  /** True when the strict day-count floor blocked the write (incoming day
   *  count was less than max(prior_json, itinerary_days_table)). */
  dayCountShrinkBlocked?: boolean;
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

  // ── DAY-COUNT FLOOR (strict, defense-in-depth) ──────────────────
  // Refuse to persist a `days` array with FEWER entries than
  // max(prior_json.days.length, count(itinerary_days table)). This is the
  // single backend boundary that catches the Bangkok / "1 of 4 days
  // generated" class: an upstream chain or chat write that emits a
  // single-day payload would otherwise silently land in JSON, after which
  // the bookend validator misclassifies Day 1 as departure and the
  // hotel-nights label collapses to "1 night". The regression-guard below
  // compares meaningful counts; this guard explicitly compares day counts
  // and runs even when meaningful counts look fine. Opt-out via
  // `allowRegression: true` (the same flag that powers user-initiated
  // resets / day-removal flows).
  let dayCountShrinkBlocked = false;
  let dayCountFloorMeta:
    | { incoming: number; priorJson: number; tableRows: number; dateSpan: number; generationTotalDays: number; priorMax: number }
    | null = null;
  // canonicalTotalDays — computed once here and reused for the bookend
  // verification step below so its `expectedTotalDays` guard sees the same
  // truth (trip dates + table count + metadata, not just JSON length).
  let canonicalTotalDays = Math.max(1, days.length);
  try {
    const { resolveTripTotalDays } = await import('./trip-total-days.ts');
    if (Array.isArray(days)) {
      const { data: priorRow } = await supabase
        .from('trips').select('itinerary_data').eq('id', tripId).maybeSingle();
      const priorJsonDays = Array.isArray((priorRow?.itinerary_data as any)?.days)
        ? ((priorRow!.itinerary_data as any).days as any[])
        : [];
      const { total, sources } = await resolveTripTotalDays(supabase, tripId, days.length);
      canonicalTotalDays = total;
      const priorMax = Math.max(
        priorJsonDays.length,
        sources.itineraryDaysTableCount,
        sources.dateSpan,
        sources.generationTotalDays,
      );
      if (!options.allowRegression && days.length > 0 && priorMax > 0 && days.length < priorMax) {
        dayCountShrinkBlocked = true;
        dayCountFloorMeta = {
          incoming: days.length,
          priorJson: priorJsonDays.length,
          tableRows: sources.itineraryDaysTableCount,
          dateSpan: sources.dateSpan,
          generationTotalDays: sources.generationTotalDays,
          priorMax,
        };
        console.warn(
          `[${label}] [PERSIST_DAY_COUNT_SHRINK_BLOCKED] incoming=${days.length} ` +
          `priorMax=${priorMax} (json=${priorJsonDays.length}, table=${sources.itineraryDaysTableCount}, ` +
          `dateSpan=${sources.dateSpan}, genTotal=${sources.generationTotalDays}). ` +
          `Keeping previous itinerary_data; applying extraUpdate only.`,
        );
      }
    }
  } catch (e) {
    console.warn(`[${label}] day-count-floor probe failed (non-blocking, allowing write):`, e);
  }

  if (dayCountShrinkBlocked) {
    const extra = options.extraUpdate || {};
    const updatePayload: Record<string, any> = { ...extra };
    delete updatePayload.itinerary_data;
    // Stamp a rejected_attempts entry for postmortem.
    try {
      const { data: priorRow } = await supabase
        .from('trips').select('metadata').eq('id', tripId).maybeSingle();
      const priorMeta = (priorRow?.metadata as Record<string, any>) || {};
      const existingRejected = Array.isArray(priorMeta.rejected_attempts) ? priorMeta.rejected_attempts : [];
      const callerMetadata = (extra.metadata && typeof extra.metadata === 'object')
        ? extra.metadata as Record<string, any>
        : {};
      const rejected = [
        ...existingRejected,
        {
          at: new Date().toISOString(),
          label,
          reason: 'day_count_shrink',
          ...dayCountFloorMeta,
        },
      ].slice(-MAX_REJECTED_ATTEMPTS);
      updatePayload.metadata = { ...priorMeta, ...callerMetadata, rejected_attempts: rejected };
    } catch (_e) { /* best effort */ }
    if (Object.keys(updatePayload).length > 0) {
      const { error } = await supabase.from('trips').update(updatePayload).eq('id', tripId);
      if (error) {
        console.warn(`[${label}] [PERSIST_DAY_COUNT_SHRINK_BLOCKED] extraUpdate write failed:`, error);
        return { error, dayCountShrinkBlocked: true };
      }
    }
    return { error: null, dayCountShrinkBlocked: true };
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

  // 3aa. Untimed-locked drop — final safety net for the recurring "duplicated
  // untimed user-anchor card" class. Any path (chat executor, manual edit,
  // legacy persisted JSON) that leaves an isLocked row without startTime AND
  // without legacy `time` is dropped here. anchor-guard already enforces this
  // at generation; this is defense-in-depth at the single write boundary.
  // See mem://constraints/itinerary/anchor-cards-must-have-time.
  try {
    let untimedDropped = 0;
    for (const day of days) {
      if (!day || !Array.isArray(day.activities)) continue;
      const kept: any[] = [];
      for (const a of day.activities) {
        if (!a) continue;
        const isLocked = a.isLocked === true || a.locked === true;
        const hasStart = !!(a.startTime || a.start_time || a.time);
        if (isLocked && !hasStart) {
          untimedDropped++;
          continue;
        }
        kept.push(a);
      }
      day.activities = kept;
    }
    if (untimedDropped > 0) {
      console.log(`[${label}] [ANCHOR_GUARD] persist_drop_untimed=${untimedDropped}`);
    }
  } catch (e) {
    console.warn(`[${label}] untimed-locked drop failed (non-blocking):`, e);
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

  // 3a-bis-PRE. Schedule timing sanity — single canonical pass that catches
  // pre-dawn meals/sightseeing on non-locked rows, field drift between
  // startTime / start_time / time and endTime / end_time, endTime < startTime
  // that isn't a legit wrap, and duplicate terminal hotel-return bookends.
  // Locked / user / manual / extracted / pinned / booked rows are NEVER
  // mutated. Runs BEFORE the chronology validator so chronology only sees
  // already-sane times. See mem://constraints/itinerary (Rome Day 1 class).
  let scheduleSanityTrace: Record<string, any> | null = null;
  try {
    const { sanitizeSchedule } = await import('./sanitize-schedule-timing.ts');
    const r = sanitizeSchedule(days, { site: label });
    const total =
      r.counters.predawnMealsRepaired +
      r.counters.predawnNonLockedDropped +
      r.counters.invalidEndBeforeStartRepaired +
      r.counters.duplicateHotelReturnsRemoved +
      r.counters.fieldDriftRepaired;
    if (total > 0) {
      scheduleSanityTrace = {
        at: new Date().toISOString(),
        touched_days: r.touchedDays,
        ...r.counters,
      };
    }
  } catch (e) {
    console.warn(`[${label}] schedule sanity pass failed (non-blocking):`, e);
  }

  // 3a-bis-PRE-AUDIT. Canonical READ-ONLY timing auditor — same function
  // used by the read-time `audit-trip-timing` edge fn so legacy bad trips
  // and fresh writes surface the same violation codes. Never mutates.
  // Result is persisted at metadata.quality.audit_summary so the dashboard
  // can group by code without re-running.
  let auditSummary: Record<string, any> | null = null;
  try {
    const { auditTimingViolations } = await import('./audit-timing.ts');
    const result = auditTimingViolations(days, {
      arrivalTime24: (callerMetaSuccess as any)?.savedArrivalTime24 ?? null,
      departureTime24: (callerMetaSuccess as any)?.savedDepartureTime24 ?? null,
    });
    if (result.violations.length > 0) {
      auditSummary = {
        at: result.ranAt,
        counts_by_code: result.countsByCode,
        violations_count: result.violations.length,
        // Cap to first 50 to keep metadata blob small.
        violations: result.violations.slice(0, 50),
      };
      console.log(
        `[${label}] [AUDIT_TIMING] violations=${result.violations.length} ` +
        Object.entries(result.countsByCode)
          .filter(([, n]) => (n as number) > 0)
          .map(([k, n]) => `${k}=${n}`).join(' '),
      );
    }
  } catch (e) {
    console.warn(`[${label}] audit-timing pass failed (non-blocking):`, e);
  }

  // 3a-bis. Chronology validator — sorts each day's activities by
  // wrap-aware dayChronoKey and drops any leftover predawn non-bookend
  // rows on Day N>=2 that earlier passes missed. This is the chokepoint
  // that catches all write paths (chat executor / restore-version /
  // manual upsert / optimistic save) which bypass action-save-itinerary's
  // pre-save enforceTimingAndBuffers sort. Stamps
  // metadata.quality.chronology_trace for observability.
  // See mem://constraints/itinerary/chronology-validator-three-gates.
  let chronologyTrace: Record<string, any> | null = null;
  try {
    const { validateChronology } = await import('./chronology-validator.ts');
    const v = validateChronology(days, { site: label });
    if (v.healed) {
      for (let i = 0; i < days.length; i++) days[i] = v.days[i];
      if (itinerary && typeof itinerary === 'object') {
        (itinerary as any).days = days;
      }
    }
    chronologyTrace = {
      at: new Date().toISOString(),
      issues_pre: v.issues.length,
      issues_post: v.remainingIssues.length,
      sorted_days: v.sortedDayCount,
      dropped: v.droppedCount,
      critical_after_heal: v.criticalAfterHeal,
      sample: v.remainingIssues.slice(0, 5),
    };
  } catch (e) {
    console.warn(`[${label}] chronology validator failed (non-blocking):`, e);
  }

  // 3a-ter. Per-day overlap-and-buffer cascade. The chronology validator
  // above catches reverse-sorted / predawn / backward-jump issues but does
  // NOT detect activity OVERLAPS where Cathedral 11:55–13:10 sits next to
  // Lunch 12:30–13:30 (both forward-sorted by startTime). enforceTimingAnd-
  // Buffers cascade-pushes the later card past prevEnd + buffer, recomputes
  // transit durations, fills floating meals, prunes orphan late-nightlife
  // bookends — all idempotent + locked-row-exempt. This is the chokepoint
  // that catches all write paths bypassing action-save-itinerary's STEP 2.9
  // (fresh-gen Stage 6, chat executor, restore-version, manual upsert).
  // Sentinel: [PERSIST_CASCADE] day=N repairs=K
  try {
    const { enforceTimingAndBuffers } = await import('./timing-cascade.ts');
    let totalRepairs = 0;
    let touchedDays = 0;
    for (const day of days) {
      if (!day || !Array.isArray(day.activities) || day.activities.length < 2) continue;
      const lockedIds = new Set<string>(
        day.activities
          .filter((a: any) => a?.isLocked || a?.locked || a?.lock_state === 'locked' || a?.userAdded || a?.userEdited || a?.isManual || a?.extracted || a?.pinned)
          .map((a: any) => String(a.id || ''))
          .filter(Boolean),
      );
      try {
        const res = enforceTimingAndBuffers(day.activities as any[], { lockedIds });
        if (res.repairs.length > 0) {
          day.activities = res.activities as any[];
          totalRepairs += res.repairs.length;
          touchedDays++;
          console.log(`[PERSIST_CASCADE] day=${day.dayNumber ?? '?'} repairs=${res.repairs.length} kinds=${[...new Set(res.repairs.map((r: any) => r.type))].join(',')}`);
        }
      } catch (e) {
        console.warn(`[PERSIST_CASCADE] day=${day.dayNumber ?? '?'} failed (non-blocking):`, e);
      }
    }
    if (touchedDays > 0) {
      console.log(`[PERSIST_CASCADE_SUMMARY] site=${label} touchedDays=${touchedDays} totalRepairs=${totalRepairs}`);
    }
  } catch (e) {
    console.warn(`[${label}] per-day cascade failed (non-blocking):`, e);
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
      // Pass canonical total so Day 1 of an N>1 trip is never auto-stamped
      // as departure when the JSON briefly carries only Day 1 (Bangkok).
      expectedTotalDays: canonicalTotalDays,
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
      .select('itinerary_data, metadata, itinerary_status')
      .eq('id', tripId)
      .maybeSingle();
    if (existing) {
      oldMetadata = (existing.metadata as Record<string, any>) || {};
      // ── Active-generation bypass ────────────────────────────────────
      // The regression / identity-swap guards exist to prevent stale
      // refresh-time writes from clobbering a healthy SAVED itinerary
      // (Dublin pattern). When the trip is in an active generation
      // window (status='generating') OR previously hard-failed
      // ('failed' / 'incomplete_itinerary'), the new days are *meant*
      // to replace whatever skeleton is on disk — that's the whole
      // point of the user-clicked Regenerate button. Bypassing here
      // keeps the guard from rejecting the legitimate overwrite.
      const existingStatus = String((existing as any).itinerary_status || '');
      const activeRegen = existingStatus === 'generating'
        || existingStatus === 'failed'
        || existingStatus === 'incomplete_itinerary';
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

      if ((isRegression || identitySwap) && !options.allowRegression && !activeRegen) {
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
      } else if ((isRegression || identitySwap) && activeRegen) {
        console.log(
          `[${label}] [PERSIST_REGRESSION_BYPASS_ACTIVE_REGEN] status=${existingStatus} ` +
            `was meaningful=${oldSummary.meaningfulCount}, now meaningful=${newSummary.meaningfulCount}`,
        );
      }
    }
  } catch (e) {
    console.warn(`[${label}] regression-guard probe failed (non-blocking):`, e);
  }

  // 4b. Meal-only guard — reject any write that strips every non-meal
  //     non-logistics activity from the plan when EITHER the on-disk version
  //     OR the latest itinerary_versions row for any day has ≥3 such rows.
  //     Closes the Stockholm pattern: rich generation (Vasamuseet + City
  //     Hall + nightlife) silently overwritten by a meals + logistics shell.
  //     NOT bypassed by activeRegen — a regen producing zero non-meal rows
  //     is itself the bug. Opt-out: `allowMealOnly: true`.
  let mealOnlyBlocked = false;
  if (!regressionBlocked && !options.allowMealOnly) {
    try {
      const incomingNonMeal = countNonMealMeaningfulActivities(days);
      if (incomingNonMeal === 0 && Array.isArray(days) && days.length > 0) {
        // Reference 1: on-disk
        let referenceNonMeal = 0;
        let referenceSource: 'on_disk' | 'versions' | null = null;
        try {
          const { data: prior } = await supabase
            .from('trips').select('itinerary_data').eq('id', tripId).maybeSingle();
          const priorDays = Array.isArray((prior?.itinerary_data as any)?.days)
            ? (prior!.itinerary_data as any).days : [];
          const onDisk = countNonMealMeaningfulActivities(priorDays);
          if (onDisk >= 3) { referenceNonMeal = onDisk; referenceSource = 'on_disk'; }
        } catch (_e) {}
        // Reference 2: latest itinerary_versions per day
        if (referenceNonMeal < 3) {
          try {
            const { data: versionRows } = await supabase
              .from('itinerary_versions')
              .select('day_number, version_number, activities')
              .eq('trip_id', tripId)
              .order('day_number', { ascending: true })
              .order('version_number', { ascending: false });
            const seen = new Set<number>();
            const latestPerDay: Array<{ activities: any[] }> = [];
            for (const r of (versionRows || []) as any[]) {
              if (seen.has(r.day_number)) continue;
              seen.add(r.day_number);
              latestPerDay.push({ activities: Array.isArray(r.activities) ? r.activities : [] });
            }
            const versionsNonMeal = countNonMealMeaningfulActivities(latestPerDay as any);
            if (versionsNonMeal >= 3 && versionsNonMeal > referenceNonMeal) {
              referenceNonMeal = versionsNonMeal;
              referenceSource = 'versions';
            }
          } catch (_e) {}
        }
        if (referenceNonMeal >= 3) {
          mealOnlyBlocked = true;
          console.warn(
            `[${label}] [PERSIST_MEAL_ONLY_BLOCKED] keeping previous days — ` +
              `incoming has 0 non-meal meaningful rows; reference (${referenceSource}) has ${referenceNonMeal}`,
          );
        }
      }
    } catch (e) {
      console.warn(`[${label}] meal-only guard probe failed (non-blocking):`, e);
    }
  }

  // 5. Write.
  const extra = options.extraUpdate || {};
  const updatePayload: Record<string, any> = { ...extra };

  if (regressionBlocked || mealOnlyBlocked) {
    // Do NOT write itinerary_data — preserve the healthy on-disk version.
    // Still merge metadata + rejected_attempts ring buffer.
    const blockReason = mealOnlyBlocked && !regressionBlocked
      ? 'meal_only_blocked'
      : 'regression_blocked';
    let priorMeta = oldMetadata;
    if (!priorMeta) {
      try {
        const { data: priorRow } = await supabase
          .from('trips').select('metadata').eq('id', tripId).maybeSingle();
        priorMeta = (priorRow?.metadata as Record<string, any>) || {};
      } catch (_e) { priorMeta = {}; }
    }
    const existingRejected = Array.isArray((priorMeta as any)?.rejected_attempts)
      ? ((priorMeta as any).rejected_attempts as any[])
      : [];
    const callerMetadata = (extra.metadata && typeof extra.metadata === 'object')
      ? extra.metadata as Record<string, any>
      : {};
    const newEntry: Record<string, any> = {
      at: new Date().toISOString(),
      label,
      reason: blockReason,
      old: oldSummary,
      attempted: newSummary || { meaningfulCount: 0, paidMeaningfulCount: 0, dayCount: Array.isArray(days) ? days.length : 0 },
    };
    if (mealOnlyBlocked) {
      newEntry.incomingNonMealCount = countNonMealMeaningfulActivities(days);
    }
    const rejected = [...existingRejected, newEntry].slice(-MAX_REJECTED_ATTEMPTS);
    updatePayload.metadata = {
      ...(priorMeta || {}),
      ...callerMetadata,
      rejected_attempts: rejected,
    };
    console.log(`[persist-itinerary] meta-merge (blocked) tripId=${tripId} priorMustDo=${!!(priorMeta as any)?.mustDoActivities} newMustDo=${!!(callerMetadata as any)?.mustDoActivities} priorAnchors=${Array.isArray((priorMeta as any)?.userAnchors) ? (priorMeta as any).userAnchors.length : 0}`);
    delete updatePayload.itinerary_data; // belt-and-suspenders
  } else {
    updatePayload.itinerary_data = itinerary;
    // ── Metadata merge (success branch) ─────────────────────────────
    // Postgres jsonb columns are full-replace on UPDATE. Without this
    // merge, every save overwrote the entire `metadata` column with
    // just the caller's keys (persist_validation, itinerary_frozen_at,
    // fully_persisted, quality, …), wiping setup intent set at trip
    // creation (mustDoActivities, interestCategories, userAnchors,
    // generationRules, celebrationDay, pacing, isFirstTimeVisitor,
    // firstTimePerCity). The next regeneration leg then read an empty
    // metadata and fell back to generic "find a local spot" stubs,
    // ignoring user must-do spots. The regression-blocked branch
    // above already does this; mirror it here.
    const callerMetaSuccess = (extra.metadata && typeof extra.metadata === 'object')
      ? extra.metadata as Record<string, any>
      : null;
    if (callerMetaSuccess || chronologyTrace || scheduleSanityTrace) {
      let priorMeta = oldMetadata;
      if (!priorMeta) {
        try {
          const { data: priorRow } = await supabase
            .from('trips').select('metadata').eq('id', tripId).maybeSingle();
          priorMeta = (priorRow?.metadata as Record<string, any>) || {};
        } catch (_e) { priorMeta = {}; }
      }
      const merged: Record<string, any> = {
        ...(priorMeta || {}),
        ...(callerMetaSuccess || {}),
      };
      if (chronologyTrace || scheduleSanityTrace) {
        const priorQuality = (merged.quality && typeof merged.quality === 'object') ? merged.quality : {};
        merged.quality = {
          ...priorQuality,
          ...(chronologyTrace ? { chronology_trace: chronologyTrace } : {}),
          ...(scheduleSanityTrace ? { schedule_sanity_trace: scheduleSanityTrace } : {}),
        };
      }
      updatePayload.metadata = merged;
      console.log(`[persist-itinerary] meta-merge (success) tripId=${tripId} priorMustDo=${!!(priorMeta as any)?.mustDoActivities} newMustDo=${!!callerMetaSuccess?.mustDoActivities} chronologyTrace=${chronologyTrace ? `pre=${chronologyTrace.issues_pre}/post=${chronologyTrace.issues_post}` : 'none'} sanityTrace=${scheduleSanityTrace ? 'yes' : 'none'}`);
    }
  }

  const { error } = await supabase.from('trips').update(updatePayload).eq('id', tripId);
  if (error) {
    console.error(`[${label}] trips.update failed:`, error);
  } else {
    // Reconcile metadata.failed_day_numbers against the activities table
    // so stale entries don't pin the UI in "incomplete generation" mode
    // (Bangkok pattern: meta said [3,4] failed but tables had 11/3 rows).
    // Non-blocking — never fails the persist.
    try {
      const { reconcileFailedDays } = await import('./reconcile-failed-days.ts');
      await reconcileFailedDays(supabase, tripId, { label });
    } catch (e) {
      console.warn(`[${label}] reconcileFailedDays failed (non-blocking):`, e);
    }
  }
  return { error, regressionBlocked, mealOnlyBlocked };

}
