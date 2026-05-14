# Day-1-Past-Midnight Cascade: Lock the Risk Closed

## Background

The existing chain already has 4 defense layers for the Amsterdam 1:33 / 3:26 / 6:31 AM symptom:

1. `stripBookendsForPrompt` — strips bookend rows AND any [00:00, 06:00) activity from cross-day prompt context (covers untagged "Return to Hotel" too).
2. Parser Step 4 stale-head drop — drops a `late_nightlife_bookend` / `bookend-*` sitting at index 0 of Day N≥2 (and Day 1 when followed by real later activity).
3. `normalizePredawnCascade` — shifts the leading [00:00, 05:00) block on ANY day forward to 09:00, preserving spacing.
4. `dayChronoKey` wrap-aware sort — keeps a 00:25 nightcap bookend at the chronological tail of its own day.

Copenhagen Day 1 (12:25 AM end → clean Day 2) confirms the chain works. Amsterdam was the worst-case legacy. The user's concern is that the risk is still latent — no single layer asserts the invariant.

## What's missing

There is **no single chokepoint** that asserts the invariant after persist. If any new code path (manual edit, AI rewrite tool, future regenerate variant, version-restore) writes an activity with `dayNumber = N+1` and `startTime ∈ [00:00, 06:00)` while Day N has a late nightlife / late dinner tail, nothing today either:

- moves it back to Day N's tail (where it belongs), OR
- emits a single canonical telemetry signal that something silently leaked.

Every existing layer is either prompt-time, parse-time, or per-day-cascade. A persist-boundary cross-day invariant check is the missing piece.

## Plan

### 1. New shared util: `assertNoCrossDayBleed`

`supabase/functions/_shared/cross-day-bleed-guard.ts` (new, ~80 lines)

Per persisted day pair `(N, N+1)`:

- If Day N's last non-locked activity ends ≥ 22:00 (late-nightlife signal), AND Day N+1's first non-locked activity starts in [00:00, 06:00) AND is **not** a `late_nightlife_bookend`/`bookend-*` source row, then:
  - Move that head row back to the tail of Day N (re-stamp `dayNumber = N`, leave time unchanged).
  - Log `[DAY1_BLEED_GUARD] day=N+1 site=<caller> action=moved_to_prev_day_tail title="…" start=HH:MM` and stamp `metadata.quality.cross_day_bleed_repairs += 1`.
- Bookend-source rows at Day N+1 head are already handled by parser Step 4 stale-head drop — this guard does **not** duplicate that; it specifically catches **untagged real activities** that escape every upstream filter.

Locked / `manual` / `extracted` / `pinned` / `user_added` / departure-logistics rows are exempt (re-uses existing `isLockedLike` / `isDepartureLogistics` helpers from `predawn-cascade-normalize.ts`).

### 2. Wire into persist boundary

`supabase/functions/generate-itinerary/action-save-itinerary.ts` `normalizeDays` — call `assertNoCrossDayBleed(days, { site: 'save-itinerary' })` AFTER `normalizePredawnCascade` and BEFORE the final activity_costs write. Guard runs once per save; any move re-runs `enforceTimingAndBuffers` on both affected days.

`supabase/functions/_shared/persist-itinerary.ts` — add the same call at the single write chokepoint so chat-tool / regenerate / chain-final paths inherit the guard.

### 3. Frontend read-time mirror (defense in depth)

`src/utils/itineraryParser.ts` Step 4 — after the existing stale-head drop + `normalizePredawnCascade`, run a FE-side `assertNoCrossDayBleed` (port the util to `src/lib/itinerary/`) so legacy persisted trips (Amsterdam-class data already on disk) self-heal at next render. Logs `[DAY1_BLEED_GUARD]` to console for telemetry.

### 4. Regression tests

- `supabase/functions/_shared/__tests__/cross-day-bleed-guard.test.ts`
  - Day 1 ends with nightcap 22:00–23:30 + `late_nightlife_bookend` 23:50–00:25 → no move (bookend correctly on Day 1).
  - Day 1 ends 22:00, Day 2 head is `Moco Museum @ 01:33` (untagged real activity) → moved to Day 1 tail.
  - Day 2 head is `late_nightlife_bookend @ 00:25` → not moved (parser drops it separately).
  - Day 2 head is locked manual entry @ 02:00 → not moved.
  - Day 2 head at 09:00 → no-op.
- `supabase/functions/generate-itinerary/__tests__/late-nightlife-source-survival.test.ts` — extend with one Amsterdam-class fixture asserting the persist boundary leaves Day 1 with the bookend AND Day 2 starting ≥ 09:00.

### 5. Memory + index update

New entry `mem://constraints/itinerary/day1-past-midnight-no-day2-cascade` documenting the 5-layer chain (4 existing + new persist-boundary guard) and the `[DAY1_BLEED_GUARD]` sentinel. Reference from `mem://index.md` Memories list.

## Out of scope

- Changing the late-nightlife bookend allowance (00:00–02:30) — that's the documented Florence/Barcelona Day-2 fix and stays.
- Touching `normalizePredawnCascade` shift target (still 09:00).
- Hero/health/payments work shipped earlier in this loop.

## Acceptance

- Synthetic Amsterdam fixture (Day 1 nightcap 22:00, Day 2 LLM-emitted museum @ 01:33) round-trips through `action-save-itinerary` and emerges with the museum re-bucketed onto Day 1's tail; Day 2 starts ≥ 09:00.
- Backfill scan on existing trips logs `[DAY1_BLEED_GUARD]` exactly once per affected day; no false positives on Copenhagen-class clean Day 2 trips.
- All existing late-nightlife / predawn / wrap-sort tests continue to pass.

## Files

- `supabase/functions/_shared/cross-day-bleed-guard.ts` (new)
- `supabase/functions/generate-itinerary/action-save-itinerary.ts` (1 call site)
- `supabase/functions/_shared/persist-itinerary.ts` (1 call site)
- `src/lib/itinerary/crossDayBleedGuard.ts` (new, FE port)
- `src/utils/itineraryParser.ts` (1 call site in Step 4)
- `supabase/functions/_shared/__tests__/cross-day-bleed-guard.test.ts` (new)
- `supabase/functions/generate-itinerary/__tests__/late-nightlife-source-survival.test.ts` (extend)
- `mem://constraints/itinerary/day1-past-midnight-no-day2-cascade` (new)
- `mem://index.md` (reference)
