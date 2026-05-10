## Goal
Make `travel_dna_profiles.trait_scores` slowly evolve from real behavior. Build a per-user drift recompute that reads the last 12 months of `activity_feedback`, maps categories to traits, applies bounded deltas (±0.05/trait/call, clamped to [0,1]), updates the profile with `derivation_source = 'drift'`, and recalculates the archetype.

UI surfacing is explicitly deferred.

## File 1 — `supabase/functions/recompute-trait-drift/index.ts` (new)

Service-role edge function. `verify_jwt = false` (called by cron / batch / admin). Body: `{ userId: string, dryRun?: boolean }`.

Steps:
1. Load `activity_feedback` for `user_id = :userId` where `created_at >= now() - interval '12 months'`. Bail with `{ skipped: 'no_feedback' }` if 0 rows.
2. Map each row to trait deltas via `CATEGORY_TRAIT_MAP` (see below). Rating weight: `loved = +1.0`, `liked = +0.5`, `neutral = 0`, `disliked = -1.0`, `hated = -1.5`. Multiplier per signal: `0.01` (so 100 strong loves = 1.0 raw, before cap).
3. Aggregate per trait → raw delta. Clamp each trait delta to **±0.05**.
4. Read current `travel_dna_profiles` row (`trait_scores`, `derivation_source`). If row missing → `{ skipped: 'no_profile' }`.
5. Apply: `new = clamp(old + delta, 0, 1)` for each numeric trait (skip `life_stage` — it's a string).
6. Upsert `trait_scores`, set `derivation_source = 'drift'`, `updated_at = now()`. Log a `trait_drift_log` row (see migration) with `{user_id, deltas, applied_count, sample_size, ran_at}`.
7. Call existing `recalculateArchetype(userId)` equivalent — actually that's a TS client helper. Cleaner: invoke RPC if exists, else just write `trait_scores` and let the next archetype recalc path pick it up. Per memory `mem://constraints/dna/storage-merge-and-recalc`, the only canonical matcher is the TS `matchArchetypes`. So after writing, **invoke the existing `calculate-travel-dna` edge function (or whatever runs `matchArchetypes`)** with the user — confirm by reading `calculate-travel-dna/index.ts` during build. If that's the wrong function, we leave a TODO and only update `trait_scores` (archetype recalc happens on next quiz/conversation save). Decide at build time.
8. On `dryRun`, return computed deltas without writing.

Returns `{ userId, sampleSize, deltas, beforeScores, afterScores, archetypeRecalced: boolean }`.

### Category → trait map (initial)
```
sightseeing      → cultural_depth, art_focus, photo_focus
museum / culture → cultural_depth, art_focus, learning_focus
dining / food    → food_focus
nightlife / bar  → social_energy, novelty_seeking
adventure / outdoor / hiking → adventure, nature_orientation
wellness / spa   → restoration_need, healing_focus
shopping         → status_seeking
nature / park    → nature_orientation
beach            → restoration_need, nature_orientation
entertainment    → novelty_seeking, social_energy
sports           → adventure
relaxation       → restoration_need
transport / logistics → (ignored)
```
Map keyed by both `activity_category` (primary) and `activity_type` fallback. Unknown categories ignored (don't fail).

## File 2 — Migration: drift log + cron

```sql
CREATE TABLE IF NOT EXISTS public.trait_drift_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ran_at timestamptz NOT NULL DEFAULT now(),
  sample_size int NOT NULL,
  deltas jsonb NOT NULL,
  before_scores jsonb,
  after_scores jsonb
);
ALTER TABLE public.trait_drift_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own drift log" ON public.trait_drift_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_trait_drift_log_user_ran ON public.trait_drift_log(user_id, ran_at DESC);
```

## File 3 — Trigger wiring (separate `supabase/insert` SQL, not migration, per scheduled-job convention)

Two layers, belt-and-suspenders:

**a) Per-trip invoke** in `summarize-trip-learnings-batch/index.ts` (existing) — after each successful summarization, fire-and-forget POST to `recompute-trait-drift` with that trip's `user_id`. (Tiny addition; same auth pattern.)

**b) Weekly cron sweep** via `pg_cron` job `recompute-trait-drift-weekly` at `0 5 * * 1` (Mondays 5am UTC). Selects users with ≥1 `activity_feedback` row in the last 7 days and no `trait_drift_log.ran_at` since their newest feedback, then calls `recompute-trait-drift` for each (cap 100 per run). Implemented as a small batch edge function `recompute-trait-drift-batch/index.ts` invoked by cron — same shape as the existing summarize batch.

This catches manual-mode users / opt-out paths the per-trip path misses.

## Safety rails
- ±0.05 per-trait per-call cap.
- Min 5 ratings required to apply; below that → `skipped: 'insufficient_signal'`.
- `derivation_source = 'drift'` only when actual deltas applied (not on dry runs / skips). Quiz / conversation writes still take precedence and overwrite back to their respective sources via the existing DNA storage merge contract — drift is the lowest-priority source.
- Numeric clamp `[0, 1]`; `life_stage` never touched.

## Verification
- Seed/find a user with ≥5 `activity_feedback` rows.
- `curl` the function with that `userId`. Confirm response `deltas` is non-empty and bounded.
- `select trait_scores, derivation_source from travel_dna_profiles where user_id = …` shows shifted floats, source `drift`.
- `select * from trait_drift_log where user_id = …` has the run.
- Re-run immediately → sample size same, deltas similar but capped; no runaway.
