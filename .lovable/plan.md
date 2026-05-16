# Fix: "When trip has required activities, only restaurants get scheduled"

## What's actually happening

Reproduced on trip `eb9ec034` (Stockholm, must-dos = Vasamuseet + City Hall):

| Source | Day 1 | Day 2 | Day 3 |
|---|---|---|---|
| **`trips.itinerary_data` (what the user sees)** | 6 cards — meals + logistics only | 4 — meals + logistics | 3 — departure |
| `itinerary_versions` v1 (canonical generation) | **15 cards incl. Vasamuseet, Wander Gamla Stan, Nightcap** | 14 incl. **City Hall**, Djurgården e‑bike | 3 |
| `itinerary_activities` table | 21 (rich + duplicates) | 17 | 4 |

So generation **did** place the must-dos. A later `save-itinerary` overwrote `trips.itinerary_data` with a meals-only shell. The on-page sparse-JSON resync that's supposed to heal this isn't firing for this trip in practice (no `[HEALTH_JSON_SPARSE_RESYNC]` sentinel in the recent logs).

Three later save attempts WERE caught by the regression guard (`was meaningful=7 paid=5, now meaningful=2 paid=1`) — but by then the meal-only state had already become "the baseline".

## Plan

### 1. Root-cause guard in `action-save-itinerary` (`supabase/functions/generate-itinerary/`)

Add a **meal-only suspicion guard** that runs *before* the existing regression check:

- Compute, for the incoming payload, `nonMealMeaningfulCount` = activities that are not dining/cafe/breakfast/lunch/dinner/snack/drinks AND not logistics (flight/transport/transfer/checkout/accommodation/return-to-hotel).
- Compare against the **larger of** (a) previously persisted `nonMealMeaningfulCount` and (b) the latest `itinerary_versions.activities` per day for this trip.
- If incoming `nonMealMeaningfulCount === 0` AND either reference has `≥ 3` non-meal meaningful rows, **reject the write** with sentinel `[PERSIST_MEAL_ONLY_BLOCKED]` (same shape as `PERSIST_REGRESSION_BLOCKED`, stamped to `metadata.rejected_attempts`).
- Opt-out flag `allowMealOnly: true` for explicit user-initiated meal-only edits.

### 2. Harden sparse-JSON resync in `src/pages/TripDetail.tsx` (~L1530-1790)

The existing probe compares JSONB vs `itinerary_activities` only. For this trip it should still have fired (Day 1: 6 < 0.6×21). Add observability + a missing trigger:

- Add **non-meal coverage** to the drift check: if `jsonNonMealCount === 0` AND (`tableNonMealCount ≥ 3` OR `versionsNonMealCount ≥ 3`), force `perDayDriftSuspected = true` even when total counts look close.
- Include `itinerary_versions` (latest `version_number` per `day_number`) as a third candidate source alongside `embedded` and `per-row` in the score/select step. Pick whichever source has the highest non-meal-meaningful count (tie-broken by total count).
- Log `[HEALTH_JSON_SPARSE_RESYNC] reason=missing_nonmeal` so we can verify the heal path firing for this exact pattern.

### 3. One-shot backfill for affected trips

SQL migration (read-only `SELECT` first, then conditional `UPDATE` via JS script):

- Find trips where `itinerary_data.days[*].activities` has zero non-meal/non-logistics rows on any day AND the latest `itinerary_versions` rows for that day have ≥3 such rows.
- For each, rebuild `itinerary_data.days[d].activities` from the latest `itinerary_versions` row (preferring v1 from `created_by_action='generate'`).
- Persist via `safeUpdateItineraryData` equivalent server-side write with `saveReason='backfill-restore-rich-days-from-versions'` and `skipLedgerCheck:true`. Stamp `metadata.rebuilt_from_versions = { at, days_restored }`.

### 4. Memory entry

Add to `mem://constraints/itinerary/` a new rule `no-meal-only-persist` capturing the guard contract and the three-source resync precedence (JSONB → activities table → versions).

## Verification

- Trip `eb9ec034` after backfill: `trips.itinerary_data` Day 1 contains Vasamuseet; Day 2 contains City Hall; total ≥ 13 activities/day. Page reload no longer shows meals-only.
- Replay save-itinerary with a synthetic meals-only payload against a healthy trip → blocked with `[PERSIST_MEAL_ONLY_BLOCKED]`, baseline untouched.
- Sparse-resync fires on any trip with `nonMealCount=0` and rebuilds from versions when activities table is also degraded.

## Out of scope (deliberately)

- Why the *first* save stripped the rich generation — likely a stale client payload from `EditorialItinerary` after a partial parse. Guard (#1) makes it harmless regardless of source.
- Changes to anchor-guard / meal-guard themselves — both are working as designed in the logs.
- Currency toggle work (unrelated, already shipped).