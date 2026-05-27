# Canonical Preference Spine — Remaining Steps

Steps 1 (spine module) and 2 (unified prompt + validator merge) are shipped. The remaining work hardens propagation, enforcement, observability, and legacy heal.

## Step 3 — Preference Trace (forensic)

Add `metadata.quality.preference_trace` ring buffer (cap 8) at the persist boundary in `_shared/persist-itinerary.ts`, alongside the existing `timing_trace`. Each entry:

```
{ stage, ts, expected:[{id,kind,priority,label}], promptInjected:[id], fulfilled:[id], missed:[{id,reason}] }
```

- `expected` comes from `mergePreferenceSources` over the day's scope.
- `promptInjected` is stamped by `compile-prompt.ts` into a transient field on the day result.
- `fulfilled` / `missed` come from the same matcher used in Step 5.
- Sentinel: `[PREFERENCE_TRACE] day=N expected=X injected=Y fulfilled=Z missed=W`.

## Step 4 — Multi-City Propagation

In `splitJourneyIfNeeded` (generate-itinerary pipeline): trip-wide intents (no city tag, no day_number) MUST be cloned into every leg's prompt scope, not just leg 1. Tag-aware intents (e.g. "sushi in Tokyo") stay scoped. Add `[PREFERENCE_SPLIT] leg=N propagated=K scoped=M` log + unit test covering the Lisbon→Porto pattern where Day-3 lost "wine tasting".

## Step 5 — Semantic Fulfillment Matcher

New module `_shared/preference-matcher.ts`:

- Category aliases: `{ sushi: [omakase, sashimi, kaiseki…], rooftop: [skybar, terrace, panoramic…], hidden_gem: [local, off-beaten, neighborhood…], spa: [onsen, hammam, thermal…], slow_pace: pacingMetric ≤ X/day }`.
- `matchIntent(intent, dayActivities)` returns `{fulfilled, evidenceActivityId?, score}`.
- "Avoid" intents check absence (museums, chains, tourist-traps).
- Wired into save-itinerary ledger + Step 3 trace. NOT into hard-repair (soft preferences stay soft).

## Step 6 — Mandatory Seeding Guard

Refactor `seedDayIntentsFromMetadata`:

- If metadata contains preferences AND seeding fails (DB error, RLS, partial write), throw `PreferenceSeedingFailedError` on FRESH generation paths only (chain-finalize start, action-generate-trip-day day 1).
- Edit / chat / extend-days paths stay non-blocking (existing intents are already trustworthy).
- Wrap with `withStage(trace, 'preference_seed', …)` so failures surface in `auditTimingViolations`-style read-time audit.
- Sentinel: `[PREFERENCE_SEED] tripId=… seeded=K skipped=M error=…`.

## Step 7 — Legacy Backfill + Constraint Doc

- One-shot diagnostic SQL view `trips_with_orphan_preferences`: trips where `metadata.mustDoActivities`/`additionalNotes`/`perDayActivities` has rows but zero matching `trip_day_intents`. Read-only — no auto-heal (existing trips are frozen).
- Lazy `heal-trip-preferences` edge fn callable from TripDetail on owner visit: re-runs `seedDayIntentsFromMetadata` against trips flagged by the view, stamps `metadata.preferences_healed_at`.
- New memory file `mem://constraints/itinerary/canonical-preference-spine` documenting: single boundary = `mergePreferenceSources`, never re-introduce the `if (usedStructuredIntents) skip metadata` branch, multi-city must propagate trip-wide, matcher is soft-only, seeding is blocking on fresh paths.
- Add to `mem://index.md` Core: "Preference Spine: single merge boundary; metadata + intents always unioned; trip-wide propagates to every leg."

## Files Touched

- **New**: `supabase/functions/_shared/preference-matcher.ts`, `supabase/functions/heal-trip-preferences/index.ts`, migration for `trips_with_orphan_preferences` view
- **Edited**: `_shared/persist-itinerary.ts` (trace stamp), `_shared/preference-spine.ts` (add `seedOrThrow` wrapper), `generate-itinerary/pipeline/compile-prompt.ts` (stamp `promptInjected`), `generate-itinerary/pipeline/split-journey.ts` (propagation), `generate-itinerary/action-save-itinerary.ts` (matcher wire-up), `generate-itinerary/action-generate-trip-day.ts` + chain-finalize (mandatory seed)
- **Tests**: `preference-spine.merge.test.ts`, `preference-matcher.test.ts`, `split-journey.preference-propagation.test.ts`, `preference-seed-blocking.test.ts`
- **Memory**: `mem://constraints/itinerary/canonical-preference-spine` + index update

## Non-Goals

- No UI changes — entirely backend.
- No hard-repair for soft preferences (would degrade itinerary diversity).
- No retroactive auto-mutation of already-frozen trips (lazy heal only on owner visit).
