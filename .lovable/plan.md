# Plan: Finish the "no silent auto-regen on page load" fix

## What we were trying to fix

Trips like Dublin (and Clinton Brooks Madrid before it) silently lost activities or got partially overwritten after a page refresh, because something on `TripDetail` mount was re-invoking `generate-itinerary` without the user pressing **Regenerate**.

Two hot suspects were already neutralized:

1. **`useAutoResume`** (deleted) — its `status==='pending'` branch would have re-fired `handleResumeGeneration()` on every mount.
2. **`useGenerationPoller`** (patched) — its stall handler used to call `supabase.functions.invoke('generate-itinerary', { isResume: true })`; now it only logs + flips UI to `stalled` so the user can click Regenerate.

But a grep shows **three more on-mount effects** in `TripDetail.tsx` that still auto-invoke `generate-itinerary`:

- L773 `triggerGeneration` — queued multi-city journey leg
- L920 `stuckHealAttempted` — stuck `generating` journey leg (≥3 min stale heartbeat)
- L1041 `notStartedHealAttempted` — chat-planner trip stuck at `not_started` (mobile iOS Safari suspension)

These are **legitimately needed** (documented in the "Mobile Uses Server Chain" memory entry) and each is gated by guards that prevent overwriting a healthy trip. The plan is to **verify those guards, lock them with regression tests, and document them as accepted-class** — not delete them.

## Steps

### 1. Verify the three remaining guards

Confirm by reading the code that each effect short-circuits before invoke when an itinerary already exists:

| Effect | Guard that protects healthy trips |
|---|---|
| Queued-leg (L773) | Only fires when previous leg is `ready` AND this leg's own `itinerary_status` is awaiting handoff — never on a leg with saved days |
| Stuck-heal (L920) | `count` of `itinerary_days` rows = 0 (L921–926); if any rows exist it either auto-corrects status to `ready` or no-ops |
| Not-started-heal (L1038) | `!hasItineraryData(trip)` + age 60 s – 24 h + explicit user commitment (chat-planner source / mustDo / perDayActivities) |

If any guard is weaker than described, tighten it in the same step.

### 2. Add a single mount-time invariant test

New `src/pages/__tests__/TripDetail.no-silent-regen.test.ts`: source-level assertion (mirrors the `useGenerationPoller.no-auto-resume` test pattern) that the only `generate-itinerary`/`action: 'generate-trip'` invocations in `TripDetail.tsx` are inside one of the four allowed call sites:

- `handleResumeGeneration` (button)
- `triggerGeneration` (queued leg)
- `stuckHealAttempted` effect
- `notStartedHealAttempted` effect
- `extend-days` user action (L4184)

Any new auto-invoke added later fails the test.

### 3. Update the memory entry

Extend `mem://constraints/itinerary/no-auto-resume-on-load`:

- Restate the rule: **no on-mount effect may invoke `generate-itinerary` against a trip that already has saved activities**
- List the 3 accepted-class self-heal effects + the guard each relies on
- Cross-link to the real persistence-layer defenses already in Core: **Frozen After Ready**, **No-Regression Overwrite Guard**, **DB Is Source of Truth**

### 4. Confirm — no further deletions

The previous turn already removed the actual silent-overwrite paths (`useAutoResume`, poller auto-resume). The three remaining self-heals are *additive* (only fire when there is nothing to overwrite), so the correct fix is to lock + document, not delete.

## Files touched

- `src/pages/TripDetail.tsx` — only if step 1 surfaces a weak guard (no edit expected)
- `src/pages/__tests__/TripDetail.no-silent-regen.test.ts` — new
- `mem://constraints/itinerary/no-auto-resume-on-load` — extended

## Out of scope

- Backend `generate-itinerary` chain logic
- Frozen-After-Ready / No-Regression-Overwrite (already shipped, unchanged)
- The user-facing **Regenerate** button (unchanged)
