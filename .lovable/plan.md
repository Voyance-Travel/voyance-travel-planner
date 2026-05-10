## Recalculate stale DNA — use the on-visit path, not a bulk edge function

### Why not the spec'd `recalculate-all-dna` edge function

The matcher (`matchArchetypes` in `src/services/engines/travelDNA/archetype-matcher.ts`) is a **client-side TS module**. The project's core memory rule is explicit: *"TS `matchArchetypes` is the only archetype matcher — never port to SQL"* (and by extension never port to a Deno edge function — it would duplicate ~500 lines of pair penalties / forbidden pairs / category logic and immediately drift). The spec's `import { recalculateDNAFromPreferences } from '../_shared/dna-recalculation.ts'` does not exist and would have to be a fresh port of the TS matcher. Building it violates the architectural mandate.

The **softer rollout** the user listed as "ALTERNATIVE" is already 90% built:
- `src/components/system/DNARecalcOnVisit.tsx` — mounts inside AuthProvider, runs once per session per user, shows the *"Your Travel DNA has been refined"* toast on archetype shift.
- `src/services/engines/travelDNA/recalculateArchetype.ts::recalculateIfNeeded` — gated by `travel_dna_profiles.dna_recalc_needed_at`. If non-null, re-runs the canonical TS matcher, writes new primary/secondary, clears the flag.
- DB column `dna_recalc_needed_at timestamptz` already exists.

The only missing piece is **flipping the flag for existing users** so the on-visit recalc fires.

### Plan

**1. One-time SQL migration: flag all existing DNA profiles for recalc**

```sql
UPDATE public.travel_dna_profiles
SET dna_recalc_needed_at = now()
WHERE dna_recalc_needed_at IS NULL
  AND primary_archetype_name IS NOT NULL
  AND trait_scores IS NOT NULL;
```

Effect: next time each affected user opens the app, `DNARecalcOnVisit` reads the flag, `recalculateIfNeeded` re-runs the new matcher (with same-category penalty + forbidden pairs + pair disambiguation already shipped), updates `primary_archetype_name`/`secondary_archetype_name`/`dna_confidence_score`, clears the flag, and toasts the user if their primary shifted. Idempotent — failed recalcs leave the flag set so the next visit retries.

**2. Add a lightweight observability query (no new code)**

After ~1 week, run as ad-hoc admin query to monitor convergence and shifts (paste into the SQL editor; not a feature):

```sql
-- Pending recalcs
SELECT count(*) FROM travel_dna_profiles WHERE dna_recalc_needed_at IS NOT NULL;
-- Top shift pairs by inspecting recent updates (requires a snapshot table; skip if not present)
```

If the team wants a proper shift-tracking table, that's a follow-up — not part of this change.

**3. Skip the bulk edge function entirely**

No new `recalculate-all-dna/index.ts`. Reasons recap:
- Would require porting `matchArchetypes` to Deno (forbidden by memory rule).
- Active users would see surprise archetype changes mid-session — the on-visit path with the toast is explicitly the "softer rollout" the user already listed as preferred.
- The on-visit path is already deployed and tested.

### Verification

- After migration: `SELECT count(*) FROM travel_dna_profiles WHERE dna_recalc_needed_at IS NOT NULL;` matches the count of pre-existing profiles.
- Sign in as a test user with an existing DNA profile → console shows `[recalculateIfNeeded] shift user=…` if shifted, flag is cleared, toast appears on shift.
- After 1 week: pending count trends to ~0 as active users return; dormant users converge on next visit.
- Spot-check 5 users: `SELECT user_id, primary_archetype_name, secondary_archetype_name, dna_recalc_needed_at FROM travel_dna_profiles ORDER BY updated_at DESC LIMIT 5;`

### Out of scope

- Bulk server-side recalc (rejected per matcher-locality rule).
- Shift-tracking audit table (can be added later if product wants metrics).