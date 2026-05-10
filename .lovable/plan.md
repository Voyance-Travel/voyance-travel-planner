## DNA-2 — Atomic 3-table DNA save

### Current state
`OnboardConversation.tsx` (lines 180-239) performs three sequential client-side upserts to `travel_dna_profiles`, `profiles`, and `user_preferences`. If write 2 or 3 fails, the user is left with a partial DNA state (e.g. DNA saved but `quiz_completed=false`), which strands them in an inconsistent onboarding loop.

### Plan

**1. Migration** — `supabase/migrations/<timestamp>_atomic_dna_save.sql`

Create `public.save_onboarding_dna(p_user_id, p_primary_archetype, p_secondary_archetype, p_confidence, p_trait_scores, p_preferences) RETURNS jsonb`:
- `LANGUAGE plpgsql SECURITY DEFINER` with `SET search_path = public`.
- Three upserts wrapped in plpgsql block (implicit transaction): `travel_dna_profiles` (on conflict user_id), `profiles` (on conflict id, set `quiz_completed=true`), `user_preferences` (on conflict user_id, COALESCE-preserving existing values, `quiz_completed=true`).
- `travel_companions` written as `ARRAY[p_preferences->>'travel_companion']::text[]`.
- `EXCEPTION WHEN OTHERS` returns `{success:false, error, sqlstate}`; success path returns `{success:true, saved_at}`.
- `REVOKE ALL FROM PUBLIC` then `GRANT EXECUTE TO authenticated`.

Authorization note: function relies on `p_user_id` matching the authenticated caller. Will add an `IF p_user_id <> auth.uid() THEN RAISE EXCEPTION` guard at the top so a `SECURITY DEFINER` function can't be abused to write DNA for other users.

**2. Edit `src/pages/OnboardConversation.tsx`** (lines 180-242)

Replace the three `.upsert(...)` blocks + their `if (...Error) throw` guards with a single `supabase.rpc('save_onboarding_dna', { ... })` call mapping params per the spec. On `error || !data?.success`, log + toast + return (no navigate). On success, keep existing toast + `navigate(ROUTES.PROFILE.VIEW)`. Keep the surrounding `try/catch/finally` so `savingInProgressRef` resets correctly.

### Out of scope
- Changing the trait-score derivation (DNA-1 already shipped).
- Migrating other multi-table writes (trip create, etc.) to RPCs.
- Adding retry logic on the client — RPC is atomic, a single retry by the user is sufficient.

### Verification
- `ls supabase/migrations/ | grep atomic_dna_save` → file exists.
- `grep -c "save_onboarding_dna" src/pages/OnboardConversation.tsx` ≥ 1.
- Manual: complete onboarding → check `travel_dna_profiles`, `profiles.quiz_completed=true`, `user_preferences` all populated in one round-trip.