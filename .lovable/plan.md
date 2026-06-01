## Problem

`OmittedMustDosBanner` reads `trips.metadata.omitted_must_dos`, but this field is only ever written by the upstream **Trip Planner LLM** in `action-generate-trip.ts` (line 1176). The per-day generation chain (`action-generate-trip-day.ts` Phase-6 freeze) computes `mustDoCoverage.missing` and stamps `metadata.must_do_repair_attempted.stillMissing`, plus pushes `MUST_DO_UNCOVERED` / `MUST_DO_INJECTION_FAILED` into generation health — but it never merges those into `omitted_must_dos`. Result: when the Trip Planner assigned "whisky tasting" to a day but the day-LLM + repair + injection all failed to place it, the banner stays empty.

## Fix

In `action-generate-trip-day.ts` Phase-6 freeze (the "Gate ok → freeze" branch around line 4592, and a parallel write in the "GATE BLOCKED" branch at line 4581 so partial trips also surface honesty), merge post-generation failures into `finalMeta.omitted_must_dos`:

1. Build a `postGenOmitted: OmittedMustDo[]` from:
   - `mustDoCoverage.missing` (titles the coverage matcher couldn't find)
   - `mustDoInjection.unscheduled` (titles the injector couldn't place)
   - Reason mapping: injector failure with stillMissing → `no_compatible_slot`; coverage-only miss → `low_priority_after_anchors`; default → `other`.
   - `detail`: short string (e.g. `"Day generator and repair couldn't place this — try extending the trip or swapping a lower-priority stop."`).

2. Merge with the existing `latestMeta.omitted_must_dos` (from Trip Planner) — dedupe by `mustDoTitle.toLowerCase()`, Trip Planner entries win (they have richer reason from the planner).

3. Write the merged array into `finalMeta.omitted_must_dos` before the `supabase.from('trips').update(...)` call. Do the same write in the GATE BLOCKED branch so users see honesty on partial trips too.

4. Add a trace log: `console.log('[generate-trip-day] omitted_must_dos merged: planner=X postGen=Y final=Z')`.

## Scope

**Edit:**
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — Phase-6 both branches (gate-blocked ~4581 and freeze ~4592). ~25 lines added.

**Add (tests):**
- `supabase/functions/_shared/__tests__/omitted-must-dos-merge.test.ts` — pure merge helper unit tests (planner-only / postgen-only / both with dedupe / empty cases).

**Extract:**
- Pull the merge logic into `supabase/functions/_shared/omitted-must-dos-merge.ts` so it's testable and reusable (action-generate-trip.ts can also call it later if needed).

## Out of scope

- Trip Planner LLM prompt changes (it already writes omitted_must_dos correctly).
- Making must-do injection more aggressive — that's a separate "guarantee mechanism" effort. This plan only fixes the **honesty surface** so users see what failed instead of silent drop.
- Banner UI / copy changes (already wired correctly).
- Backfill for already-generated trips — only applies to new generations + regenerations.

## Verification

- New unit tests pass.
- Manually inspect `metadata.omitted_must_dos` shape post-generation on a trip with a known unfit must-do; confirm banner renders.
