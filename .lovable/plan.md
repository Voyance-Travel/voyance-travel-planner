# Fix: Must-Do Venues Silently Dropped (Paris trip pattern)

## What's broken on `1777da80-…`

The trip has **3 days, 3 must-do venues** (Eiffel Tower, Louvre, Notre-Dame entered in Step 3), but the final itinerary contains only meals, hotel check-in/out, and the departure transfer — zero sightseeing.

Database evidence:
- `metadata.mustDoActivities = ["Eiffel Tower", "Louvre Museum", "Notre-Dame Cathedral"]` ✅ captured
- `metadata.userAnchors` — all three have **`dayNumber: 0`** ❌
- `metadata.itinerary_status = 'failed'`, `generation_failure_reason = 'incomplete_itinerary'`
- `metadata.rejected_attempts` — 3 consecutive `save-itinerary` writes blocked by **regression-overwrite guard** (attempted 0 meaningful vs. existing 7), so the broken state is now stuck — even retries can't replace it.

## Root cause

`supabase/functions/_shared/user-anchors.ts → parseMustDoEntry` defaults `dayNumber: 0` when the must-do string has no explicit "Day N" prefix (which is always the case for venues entered in the Step 3 box).

Then `supabase/functions/generate-itinerary/anchor-guard.ts:45`:

```ts
const targetDayNum = (anchor.dayNumber as number) || 0;
if (targetDayNum < 1 || targetDayNum > days.length) continue;
```

…silently skips every dayNumber=0 anchor. So the post-generation safety net that's supposed to **restore missing must-do venues into the day** never fires for un-pinned must-dos. If the model also omits them (as happened here), they vanish without a trace.

`action-save-itinerary.ts:1195` has the same `d.dayNumber > 0` filter, compounding the drop on save.

## Fix

### 1. Distribute un-pinned must-do anchors across days (anchor-guard)

In `restoreUserAnchors` (`supabase/functions/generate-itinerary/anchor-guard.ts`), before the existing per-anchor loop:

- Partition anchors into `pinned` (`dayNumber ≥ 1`) and `floating` (`dayNumber < 1`).
- For each `floating` anchor, assign a target day by round-robin starting at Day 1, **skipping the departure day** (last day if `metadata.departureDay`-flagged or if it already contains a `transfer-to-airport` / `Departure Flight` activity).
- Prefer days that don't already contain a fingerprint-match (avoids piling multiple anchors on Day 1 when later days are emptier).
- Then run the existing restore-or-reaffirm logic with the assigned `targetDayNum`.

Telemetry: log `[ANCHOR_GUARD] floating_distributed count=N days=[…]` so future regressions are visible.

### 2. Mirror the distribution at save-time (action-save-itinerary)

In `action-save-itinerary.ts` around line 1195, before applying the `d.dayNumber > 0` filter, run the same distribution helper so anchors persisted with `dayNumber: 0` (legacy rows like this trip) get bound on the next save instead of being filtered out.

### 3. Allow this trip to recover

The regression-overwrite guard is correctly protecting the user — we **keep it**. But because the on-disk state is the bad state for this trip, add a one-shot self-heal path:

- In `TripDetail.tsx`, when `metadata.generation_failure_reason === 'incomplete_itinerary'` AND `metadata.userAnchors` has un-bound entries (`dayNumber < 1`) AND no successful regeneration since the last `empty_itinerary_detected_at`, surface the existing **"Regenerate itinerary"** CTA prominently instead of silently swallowing the failure. Don't auto-trigger (DB-is-source-of-truth + No-Auto-Resume-On-Load constraints).
- Backfill (one-shot SQL migration): for trips where `userAnchors` exists with `dayNumber=0`, recompute and stamp distributed `dayNumber` values so the next user-initiated regenerate picks them up correctly.

### 4. Shared helper

Add `supabase/functions/_shared/distribute-floating-anchors.ts` exporting `distributeFloatingAnchors(anchors, dayCount, departureDayNum?)` so anchor-guard, save-itinerary, and any future caller share one implementation. Add unit test covering: 3 floating + 3 days (one each), 5 floating + 3 days (2-2-1 with departure-day skip), 0 floating (no-op).

## Files touched

- `supabase/functions/_shared/distribute-floating-anchors.ts` (new)
- `supabase/functions/generate-itinerary/anchor-guard.ts`
- `supabase/functions/generate-itinerary/action-save-itinerary.ts`
- `src/pages/TripDetail.tsx` (CTA visibility for incomplete-itinerary state — display only, no auto-regen)
- One migration to backfill `metadata.userAnchors[].dayNumber` for affected legacy trips
- New `__tests__/distribute-floating-anchors.test.ts`

## Out of scope

- The bogus `MISSING_REQUIRED_MEAL` validation errors in `persist_validation` (Day 1–2 meals exist) — separate validator drift, not blocking this fix.
- The regression-overwrite guard itself — working as designed.
