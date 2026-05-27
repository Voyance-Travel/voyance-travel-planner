
# Canonical Timing Spine — Steps 3–7

Steps 1–2 already shipped (arrival-aware `chronologicallyLast` + persist-time hotel-return wrap clamp). This plan finishes the remaining structural work so timing can't silently corrupt again.

## Step 3 — Single canonical timing helper (backend)

Create `supabase/functions/_shared/timing-spine.ts` as the one place that owns:

- `parseClock(value)` — accepts `startTime` / `start_time` / `time` / `endTime` / `end_time`, returns minutes-since-midnight or `null`. Replaces 6+ ad-hoc parsers.
- `classifyRole(activity)` — returns one of `arrival-logistics | departure-logistics | hotel-return | late-nightlife-bookend | meal | normal`. Source/tag/anchor aware (mirrors the predicate already added to `bookend-verification.ts`).
- `chronoSortKey(activity, dayMode)` — role-aware. Arrival logistics always sort to head on Day 1; hotel-return + late-nightlife bookends always sort to tail; pre-dawn non-bookend cards on Day N≥2 stay as cross-day-bleed signal (already guarded), not "end of day."
- `clampBookendEnd(activity)` — central clamp used by sanitize-schedule, runStep8, persist-itinerary, action-save-itinerary.

Route these existing call sites through it (no behavior change beyond consistency):
- `_shared/sanitize-schedule-timing.ts`
- `_shared/timing-cascade.ts` (`fillMissingStartTimes`, `enforceTimingAndBuffers`)
- `_shared/bookend-verification.ts`
- `_shared/clamp-bookend.ts`
- `_shared/cross-day-bleed-guard.ts`
- `_shared/predawn-cascade-normalize.ts`
- `generate-itinerary/universal-quality-pass.ts` (`runStep8`)
- `generate-itinerary/persist-itinerary.ts`

## Step 4 — Frontend mirror

Create `src/lib/itinerary/timingSpine.ts` re-exporting the same three functions (port, not import — edge ≠ FE bundle). Route through it:
- `src/lib/itinerary/itineraryParser.ts` (sort + cross-day reassignment)
- `src/lib/itinerary/dayChronoKey.ts`
- `src/lib/itinerary/ensureHotelReturnBookend.ts`
- `src/lib/itinerary/normalizePredawnCascade.ts`
- `src/lib/itinerary/healthCascadePreview.ts`
- `src/components/itinerary/EditorialItinerary.tsx` (display helpers)

Locks in: parser, health engine, and bookend injector all use the same role classification the backend just wrote.

## Step 5 — Generation-run idempotency token

Root cause of "older timing overwrites newer": `generate-trip-day` can be invoked concurrently (chain retry + poller resume + user refresh-day). Last writer wins, even if it's stale.

- Stamp `metadata.active_generation_run_id = crypto.randomUUID()` at the start of every chain (Stage 6 entry + chain resumption + `action-generate-trip-day` entry when no token present).
- Each `generate-trip-day` invocation carries the token in its payload; on persist, `persistTripItinerary` reads `trips.metadata.active_generation_run_id` and rejects writes whose token doesn't match (sentinel `[STALE_RUN_REJECTED]`).
- User-edit paths (`action-save-itinerary`, chat executor) are exempt (no token = user write).
- Token cleared on chain completion or fatal abort.

## Step 6 — Per-day timing lifecycle trace

Add `metadata.quality.timing_trace[dayN]` = ordered array of `{stage, parsedRoles, head, tail, bookendSource}` snapshots written at: `validate_day`, `repair_day`, `universal_quality_pass`, `persist`, `save-itinerary normalize`, `parser read-time`. Bounded ring buffer (last 6 stages, cap 12KB/day). Powers postmortem on every "why did Day 1 collapse" report without needing log dives.

## Step 7 — One-shot backfill migration

`20260527_clamp_legacy_bookend_wrap.sql` — server-side scan of `trips.itinerary_data` for any hotel-return-shaped activity where `endTime` parses earlier than `startTime` and source is NOT `late_nightlife_bookend`. Clamp `endTime` to `23:59` in JSONB and write a `metadata.repair_log` entry. Pure data heal — no schema change. Targets the Lisbon/Istanbul/Buenos Aires shapes still persisted from before Step 2 was deployed.

## Technical notes

- All work is additive — no breaking change to existing payloads.
- Steps 3 + 4 are pure refactors gated by existing tests + 2 new spine unit tests.
- Step 5 is the only behavioral change that can reject writes; it's gated on token presence so legacy flows continue unchanged.
- Step 7 runs once; idempotent (re-runs are no-ops because `endTime ≤ startTime` no longer holds after clamp).

## Out of scope

- No UI changes beyond using the new helpers.
- No new health-engine warning categories.
- No changes to meal/anchor/cost logic.
