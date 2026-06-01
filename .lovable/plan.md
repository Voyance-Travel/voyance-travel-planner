# Day 2 Dinner Still Missing — Investigation + Fix Plan

Your hypothesis is on the right track but we should verify which of the two failure modes is actually firing for the Lisbon trip before tightening the prompt, because each mode needs a different fix. The meal-guard (`enforceRequiredMealsFinalGuard` in `day-validation.ts:835`) is *supposed* to inject a dinner card when one is missing — so if Day 2 has no dinner in the persisted JSON, one of three things is true, and the right fix differs per case.

## Step 1 — Diagnose the actual Lisbon Day 2 output (read-only)

Pull the trip's persisted JSON + generation logs to determine which path failed:

1. `trips.itinerary_data.days[1]` — what cards exist between 17:00–23:00? Is there a dinner-shaped card the validator missed (mislabeled category, wrong title), a placeholder sentinel that survived, or truly nothing?
2. Edge-function logs for that trip's Day 2 generation, filtered on:
   - `[MEAL FINAL GUARD] Day 2` — did the guard fire? Did it inject? Did it skip due to "outside window" / empty fallback pool?
   - `MEAL_COVERAGE_MISSING` — integrity-contract code present?
   - `[DESC_FILL_POST_GUARD] day=2` — confirms the post-guard hook ran
   - `freshen[-_ ]?up` — confirms §7b-bis ran
3. Check `metadata.quality.meal_audit` / `meal_policy_at_generation` on the trip.

This tells us whether the guard never ran, ran-but-skipped, ran-and-injected-then-something-stripped-it, or never detected the gap.

## Step 2 — Fix based on what diagnosis shows

**Case A — Guard never detected gap** (the freshen-up card carries a `category: 'dining'` or title containing "dinner"): tighten `detectMealSlots` so a card whose title is "Freshen Up" / "Pre-Dinner Drinks" / "Aperitif" / "Bike Gear Change" never satisfies the dinner requirement, even if category got mislabeled. Mirror the `EXPLICIT_DRINKS_RE` exclusion already used in cost-sanitization.

**Case B — Guard fired but skipped** (logged "outside window" or "no fallback venues"): the dinner slot was computed to land after `latestTimeMins` because preceding activities pushed past 21:00, OR `verified_venues` returned an empty pool for Lisbon dinner. Fix:
- Slide the injected dinner *earlier* by trimming the prior activity (mirrors the late-departure shift logic already on lines 853–857), instead of skipping.
- Add a regional INLINE_FALLBACK_DINING entry for the destination so the pool is never empty.

**Case C — Guard injected then a downstream pass stripped it** (cross-city filter, cost-sync, post-checkout prune, normalizeDays). Add a sentinel + assertion: after `enforceRequiredMealsFinalGuard` returns `injectedMeals.length > 0`, snapshot the injected IDs and re-verify they survive every subsequent pass in `action-generate-trip-day.ts` (around the 3 call sites: 2255, 2320, 3069). Emit `[MEAL_INJECTION_LOST] day=N stripped_by=<stage>` health code.

**Case D — Hard skip in the LLM call itself** (Step 1 generation): only then touch the system prompt. Add a non-negotiable "Day 2+ MUST contain exactly one card with category=dining starting 18:00–21:30" to `prompt-library.ts` dinner rule, and a §7b-tris that promotes a "Freshen Up" / "Pre-Dinner" card landing 17:30–20:30 with no real dinner present into a request for the meal guard to fire one slot later.

## Step 3 — Universal hardening (regardless of case)

Add a final-final assertion at the end of `action-generate-trip-day.ts` (after meal-guard + post-meal-guard description fill) that re-runs `detectMealSlots` against `requiredMeals` and emits `MEAL_COVERAGE_MISSING` to the integrity contract if dinner is still absent. Today this code only fires from `day-validation.ts` mid-pipeline — surfacing it at the very end guarantees the yellow banner never lies and gives a single chokepoint for telemetry.

Also add a Deno test alongside `freshen-up-pre-dinner.test.ts` that asserts: input has freshen-up at 19:00–19:30 and NO dinner card → output must contain a dining card 19:30+.

## Technical notes
- Files touched (worst case): `supabase/functions/generate-itinerary/day-validation.ts`, `supabase/functions/generate-itinerary/action-generate-trip-day.ts`, `supabase/functions/generate-itinerary/pipeline/repair-day.ts`, `supabase/functions/generate-itinerary/prompt-library.ts`, `supabase/functions/_shared/itinerary-integrity-contract.ts`. New test file in `__tests__/`.
- No DB migration. No FE changes.
- All changes gated by destination-aware logging so we can confirm the fix on the next Lisbon regenerate.

## What I need from you
Either:
(a) the Lisbon trip ID so I can run Step 1 diagnostics live and pick the right case, or
(b) approval to ship Steps 2A + 2C + 3 + the new test as a defense-in-depth bundle without diagnosing first (Cases 2B and 2D get deferred until logs prove they're needed).
