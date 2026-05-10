## P0.9 — DNA storage merge + archetype re-derive

### Diagnosis confirmed

Read the actual code, the agent's diagnosis is correct:

- `supabase/migrations/20260510003416_*.sql` lines 28-34: `save_onboarding_dna()` does `trait_scores = EXCLUDED.trait_scores` — **full replace, no merge**. ✅ matches the report.
- `src/utils/quizMapping.ts:846-857` `saveTravelDNA()` does plain `.update(payload)` with the same full-replace `trait_scores` field. ✅ matches.
- Quiz path produces ~25-26 traits; conversation path produces 8. Whichever runs second silently shrinks `trait_scores` to its own keyset and leaves `primary_archetype_name` as whatever the caller passed — frequently stale or computed against a different keyset.
- **Archetype matcher exists only in TypeScript** (`src/services/engines/travelDNA/archetype-matcher.ts:348` `matchArchetypes`). There is no SQL `match_archetype()` function — the lovable-stack-overflow snippet referencing one would not work as written.

This invalidates the "Cleaner: SQL trigger" option from the snippet. The correct fix is the **easier** option — a shared TS `recalculateArchetype()` boundary — because porting the matcher (29 archetypes × 5 pattern groups, life-stage adjustments, penalties, confidence gaps) to PL/pgSQL is a half-day rewrite for zero benefit and creates two sources of truth.

### Fix (3 parts, ship together)

**Part 1 — JSONB merge in the RPC**

Migration: replace `save_onboarding_dna()` body. Change line 32 from:
```sql
trait_scores = EXCLUDED.trait_scores,
```
to:
```sql
trait_scores = COALESCE(public.travel_dna_profiles.trait_scores, '{}'::jsonb) || EXCLUDED.trait_scores,
```
Conversation's 8 keys override quiz's same-named keys; the other ~17 quiz-only keys survive. Same-named keys take the newer value (this is fine — conversation may have refined a trait the quiz also measured).

Also change `primary_archetype_name = EXCLUDED.primary_archetype_name` to **NOT** trust the caller — set it to `NULL` (sentinel for "needs re-derive") OR leave it as the caller's value but immediately overwrite client-side via `recalculateArchetype()` (see Part 2). Going with **the latter** so the row is never in a NULL-archetype state mid-write.

**Part 2 — Shared `recalculateArchetype(userId)` boundary**

New file: `src/services/engines/travelDNA/recalculateArchetype.ts`. Single function:

1. `SELECT trait_scores, life_stage FROM travel_dna_profiles WHERE user_id = $1`
2. `matchArchetypes(traitScores, lifeStage)` — reuse the existing TS matcher
3. `UPDATE travel_dna_profiles SET primary_archetype_name = $primary, secondary_archetype_name = $secondary, dna_confidence_score = $confidence, updated_at = now() WHERE user_id = $1`

Wire it into both paths:

- `OnboardConversation.tsx` — call **after** `supabase.rpc('save_onboarding_dna', …)` resolves successfully.
- `quizMapping.ts::saveTravelDNA()` — also adopt JSONB merge for the quiz-after-conversation case (read existing `trait_scores`, merge in JS, write back), then call `recalculateArchetype()`.

This puts archetype derivation in **one** place. Callers no longer pass `primary_archetype_name`; it's always derived from the merged trait set.

> Tradeoff vs SQL trigger: requires both call sites to remember the post-write call. Mitigated by adding a one-line lint test (`grep "save_onboarding_dna" src/ | xargs grep -L "recalculateArchetype"` → must be empty) in CI.

**Part 3 — `derivation_source` tracking column**

Migration: `ALTER TABLE travel_dna_profiles ADD COLUMN derivation_source text NOT NULL DEFAULT 'quiz' CHECK (derivation_source IN ('quiz', 'conversation', 'merged'));`

Set logic:
- Quiz path writes `'quiz'` on first write; if existing row has `derivation_source <> 'quiz'`, write `'merged'`.
- Conversation path writes `'conversation'` on first write; if existing row has `derivation_source <> 'conversation'`, write `'merged'`.
- Implemented via `CASE` in the RPC's `ON CONFLICT DO UPDATE` and a small read-modify-write block in `saveTravelDNA()`.

Used for: support debugging ("how was this user's DNA computed?"), future A/B of merge-vs-prefer-one-source policy, and admin dashboard filtering.

### Files / state changed

- **New migration** (≈40 lines): replace `save_onboarding_dna()` body with merge-aware version; `ALTER TABLE travel_dna_profiles ADD COLUMN derivation_source ... CHECK ...`. Single migration file, both DDL + function replace.
- **New file** `src/services/engines/travelDNA/recalculateArchetype.ts` (~50 lines).
- **Edit** `src/utils/quizMapping.ts::saveTravelDNA` (~25 line diff): read-merge-write `trait_scores`, set `derivation_source`, drop `primary_archetype_name` from payload (now derived), call `recalculateArchetype` after write.
- **Edit** `src/pages/OnboardConversation.tsx` (~3 lines): `await recalculateArchetype(user.id)` immediately after the `save_onboarding_dna` RPC resolves successfully. **Do not change** the RPC arg shape — keep passing `p_primary_archetype` for backward compat; it's ignored once the recalculate fires.
- **No** changes to `archetype-matcher.ts` — reused as-is.
- **Memory** — append a Core rule: "DNA writes always merge JSONB + recalculate archetype via shared boundary; never trust caller-passed `primary_archetype_name`."

### Verification

1. **Repro pre-fix** (in dev): create a test user, run quiz path → check `trait_scores` keys (~25), archetype X. Run conversation onboarding → verify `trait_scores` keys shrink to 8, archetype unchanged. ✅ confirms bug.
2. **Post-fix repro**: same flow → `trait_scores` keys stay ~25 (8 from convo override + 17 quiz-only preserved), `primary_archetype_name` recomputed against full keyset, `derivation_source = 'merged'`.
3. **Reverse order**: convo first (8 keys, `'conversation'`) → quiz second → 25+ keys, `'merged'`, archetype recomputed.
4. **Idempotency**: run conversation twice → no growth in keys beyond 25, archetype stable.
5. **Lint**: `rg "primary_archetype_name" src/` shouldn't show new direct-write call sites; only the matcher module.

### Out of scope

- Backfill of existing corrupted profiles. The migration only fixes future writes. Optional follow-up: a one-shot script that, for users whose `derivation_source` is missing (i.e., pre-migration rows), reads `trait_scores`, runs the matcher, updates `primary_archetype_name`, marks `derivation_source = 'merged'`. Worth doing as a P1 follow-up but separate from this ticket.
- SQL-side archetype matcher port. Explicitly rejected — the TS matcher is the source of truth.
- Changing the conversation pipeline's trait derivation (already addressed in the prior `OnboardConversation.tsx` fix; that fix stands).
