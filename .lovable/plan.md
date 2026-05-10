## Atomic quiz-completion write via Postgres RPC

**Problem:** `setPreferences` in `src/contexts/AuthContext.tsx` (lines 740–760) does two upserts back-to-back:
1. `user_preferences` upsert with `quiz_completed: true` → throws on error.
2. `profiles` upsert with `quiz_completed: true` → logs and swallows the error.

If write #2 fails, the two rows disagree on quiz status. `transformProfile` currently OR's the two flags, so the practical user-visible damage is small — but the invariant "both rows agree" is silently violated, and any future code path that reads only `profiles.quiz_completed` (e.g. server-side gating, a future RLS policy, an analytics export) will misclassify the user.

The cleanest fix is **one transaction**, not two upserts that both throw. Postgres can do that via a `SECURITY DEFINER` function; PostgREST cannot wrap two table calls in a transaction.

### Migration: `complete_quiz` RPC

New function `public.complete_quiz(_prefs jsonb)`:

- Runs as `SECURITY DEFINER`, `SET search_path = public`.
- Reads `auth.uid()`; raises `exception 'not_authenticated'` if null.
- In a single statement block (implicit transaction):
  1. `INSERT INTO user_preferences (user_id, quiz_completed, completed_at, budget_tier, travel_pace, accommodation_style, planning_preference, interests, travel_companions, travel_vibes, traveler_type, primary_goal) VALUES (auth.uid(), true, now(), …) ON CONFLICT (user_id) DO UPDATE SET … ` — only set columns whose key is present in `_prefs` (use `coalesce(_prefs->>'budget','user_preferences.budget_tier')` style, or build the column list dynamically with `jsonb_object_keys`).
  2. `INSERT INTO profiles (id, quiz_completed, updated_at) VALUES (auth.uid(), true, now()) ON CONFLICT (id) DO UPDATE SET quiz_completed = true, updated_at = now()`.
- Returns `void` (or `jsonb` with `{ ok: true }` for clarity).
- `GRANT EXECUTE ON FUNCTION public.complete_quiz(jsonb) TO authenticated;`
- No grant to `anon`.

Because both upserts run inside the same function call, Postgres wraps them in a single transaction: if the `profiles` upsert fails, the `user_preferences` upsert rolls back. Atomic.

### Client change: `src/contexts/AuthContext.tsx` — `setPreferences`

Replace the two `supabase.from(...).upsert(...)` blocks with one call:

```ts
const { error } = await supabase.rpc('complete_quiz', {
  _prefs: {
    budget: preferences.budget ?? null,
    pace: preferences.pace ?? null,
    accommodation: preferences.accommodation ?? null,
    planning: preferences.planning ?? null,
    interests: preferences.interests ?? null,
    travel_companions: preferences.travel_companions ?? null,
    travel_vibes: preferences.travel_vibes ?? null,
    traveler_type: preferences.traveler_type ?? null,
    primary_goal: preferences.primary_goal ?? null,
  },
});
if (error) {
  console.error('[Auth] Error completing quiz:', error);
  throw error;
}
```

Then update local state as before. Keep the `console.log('[Auth] Preferences saved successfully')`.

The `user_id`/`auth.uid()` is read server-side, so it doesn't need to be in the payload.

### What's intentionally NOT in scope

- No changes to `transformProfile`'s OR fallback — keeping it is harmless and actually nice belt-and-braces.
- No changes to `updateUser` (single-table write, already throws).
- No retry/repair job for already-divergent rows. If the user wants a one-time fix-up of historical drift (any user where `user_preferences.quiz_completed = true` but `profiles.quiz_completed` is false/null), call that out and add a tiny `UPDATE profiles SET quiz_completed = true …` data fix as a separate step.

### Verification

- Quiz finish on a fresh user → both rows have `quiz_completed = true` and the call succeeds.
- Force the `profiles` upsert to fail (e.g. temporarily revoke `profiles` permissions in a staging DB) → RPC errors, **`user_preferences` row is unchanged** (atomic rollback), client surfaces the error toast instead of silently swallowing it.
- Re-running the quiz on an existing user upserts cleanly without duplicate-key errors.
- RLS unchanged; no new direct-table grants needed because the RPC runs as definer.

### Files touched

- New migration: `complete_quiz(jsonb)` function + grant.
- `src/contexts/AuthContext.tsx` — `setPreferences` body only (no signature change).
