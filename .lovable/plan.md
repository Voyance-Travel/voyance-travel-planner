## Lock down `voyance_picks` writes to admins only

### Findings

- The curated/editorial picks table is **`voyance_picks`** (not `editorial_picks` or `founder_picks`). It's the only matching table — confirmed via the scanner finding and the existing memory entry `[Voyance Picks](mem://features/voyance-picks-system)`.
- Current policies:
  - `Voyance picks are publicly readable` — SELECT, USING (true), {public} ✅ keep
  - `Authenticated users can manage voyance picks` — ALL, USING/CHECK `auth.uid() IS NOT NULL` ❌ this is the vulnerability
- Admin pattern in this project is **NOT** a `profiles.is_admin` flag. It uses the canonical role table via the SECURITY DEFINER helper `public.has_role(uuid, app_role)`, with `app_role` enum values `user | admin | moderator`. This is the same helper used elsewhere (see core memory on roles).

### Migration

```sql
DROP POLICY "Authenticated users can manage voyance picks" ON public.voyance_picks;

-- Public SELECT policy already exists, keep it.

CREATE POLICY "Admins can manage voyance picks"
  ON public.voyance_picks
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE INSERT, UPDATE, DELETE ON public.voyance_picks FROM authenticated, anon;
```

No new table, no schema change — just policy replacement + grant tightening. RLS is already enabled.

### Verification

1. Anonymous SELECT → still works (public-read policy unchanged).
2. Authenticated non-admin INSERT/UPDATE/DELETE → RLS violation (42501).
3. Admin (row in `user_roles` with `role='admin'`) INSERT/UPDATE/DELETE → succeeds.
4. Edge functions writing as service role → continue to work (service role bypasses RLS).

### Files

- New migration: `supabase/migrations/<ts>_lock_voyance_picks_writes_to_admins.sql`

No frontend changes — only admins should already be hitting write paths in the app; this just makes the DB enforce it.
