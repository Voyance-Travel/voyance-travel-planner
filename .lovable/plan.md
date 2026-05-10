## Goal

After the new matcher gates ship, every existing `travel_dna_profiles` row should re-run through the canonical TS matcher exactly once so primary/secondary archetypes reflect the new logic. We avoid building a duplicate Deno-side matcher (memory: *"TS `matchArchetypes` is the only archetype matcher — never port to SQL"*) and we avoid surprising inactive users with silent assignment changes.

**Approach: soft rollout via a one-shot per-user recalc on next visit, plus an optional admin sweep for proactive convergence.**

The user's spec edge function (`supabase/functions/recalculate-all-dna/index.ts`) is **not** built, because `recalculateArchetype` and `recalculateDNAFromPreferences` import frontend-only modules (`@/integrations/supabase/client`, `archetype-matcher.ts`) and porting them to `_shared/` would create a second matcher.

## Files & changes

### 1. Migration — add a recalc flag

`supabase/migrations/<ts>_dna_recalc_flag.sql`:

```sql
ALTER TABLE public.travel_dna_profiles
  ADD COLUMN IF NOT EXISTS dna_recalc_needed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.travel_dna_profiles.dna_recalc_needed_at IS
  'When non-null, client should re-run recalculateArchetype() on next load and clear this. Set by gate-change rollouts.';

-- Mark every existing profile for recalc (one-shot)
UPDATE public.travel_dna_profiles
SET dna_recalc_needed_at = NOW()
WHERE dna_recalc_needed_at IS NULL;
```

Existing RLS already covers the column (user-scoped policies on `user_id`).

### 2. Client trigger — `src/services/engines/travelDNA/recalculateArchetype.ts`

Extend with a thin wrapper that reads the flag, recalcs, and clears it:

```ts
export async function recalculateIfNeeded(userId: string): Promise<RecalculateResult | { success: true; skipped: true }> {
  const { data } = await supabase
    .from("travel_dna_profiles")
    .select("dna_recalc_needed_at, primary_archetype_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data?.dna_recalc_needed_at) return { success: true, skipped: true };

  const before = data.primary_archetype_name;
  const result = await recalculateArchetype(userId);

  await supabase
    .from("travel_dna_profiles")
    .update({ dna_recalc_needed_at: null })
    .eq("user_id", userId);

  if (result.success && result.primary !== before) {
    console.log(`[recalculateIfNeeded] shift user=${userId} ${before} → ${result.primary}`);
  }
  return result;
}
```

### 3. Wire the trigger on app entry

In `src/App.tsx` (or `useAuthSession`/main authenticated layout — wherever the user-bound effect for "load profile on auth" lives), call `recalculateIfNeeded(userId)` once when a session is detected. Fire-and-forget (never blocks UI). Show a one-time `sonner` toast on shift: *"Your Travel DNA has been refined."*

### 4. Optional: admin sweep page (skippable for now)

`src/pages/admin/DNARecalcSweep.tsx` — admin-only route that:
- Pages through `travel_dna_profiles` where `dna_recalc_needed_at IS NOT NULL` (limit 200/page).
- For each row, calls `recalculateArchetype(userId)`, clears the flag, accumulates shift counts.
- Renders running totals: `total | recalculated | unchanged | failed | top 20 shifts`.

Gated by existing admin role check (`has_role(auth.uid(), 'admin')`). Lets you converge inactive users on demand without an edge function.

## Why not the spec's edge function

- `recalculateDNAFromPreferences` (in `src/utils/quizMapping.ts`) and `recalculateArchetype` (in `src/services/engines/travelDNA/`) both import `@/integrations/supabase/client` and `archetype-matcher.ts`. Neither resolves under Deno without a port.
- The matcher contains tension resolvers, forbidden pairs, category penalty, and (newly added) pair-specific disambiguation logic — duplicating it server-side guarantees drift on the next gate change.
- Soft rollout converges on every active user within days and gives you the same shift telemetry via `[recalculateIfNeeded] shift …` logs in browser/edge logs.

## Verification

- After migration: `SELECT count(*) FROM travel_dna_profiles WHERE dna_recalc_needed_at IS NOT NULL;` equals previous total profile count.
- Sign in with a known account → check console: `[recalculateArchetype]` runs once; subsequent loads are silent (`skipped:true`).
- Spot-check 3–5 users: row's `primary_archetype_name` updated and `dna_recalc_needed_at IS NULL` post-visit.
- After ~2 weeks (or via admin sweep): `SELECT count(*)` of remaining flagged rows ≈ inactive-user count.
- Zero rows with `primary_archetype_name IS NULL` (the matcher always returns a primary; if it fails it leaves the existing value untouched).

## Out of scope

- Deno-side matcher port.
- Forced bulk recalc for inactive users (admin sweep covers this if needed).
- Notification email about the shift (toast only).
