## Goal
Stop anonymous exposure of (a) `founding_member_tracker.stripe_session_id` and (b) every user's `user_social_links` rows.

## Findings from exploration

- `founding_member_tracker` (cols: `id, user_id, purchase_number, awarded_at, stripe_session_id`) has policy `Founding member tracker is publicly readable` with `USING (true)` to `{public}`. The only client read is the `get_n_count` RPC (a count). There is **no client code that needs to SELECT stripe_session_id** — safe to fully lock the table down.
- `user_social_links` has policy `Anyone can read social links` to `{anon}` with `USING (true)`. It is read from:
  - `src/services/socialLinksAPI.ts::fetchSocialLinks` (used on profile editor — authenticated)
  - `src/components/guides/CreatorCard.tsx` (rendered inside `CommunityGuidePublic.tsx` — an unauthenticated public guide page)
  So we cannot simply strip anon read; we must keep anon read **only for users who have a published community guide** (i.e. who opted into a public creator surface). Everyone else's links become authenticated-only.

## Plan

### 1. Lock down `founding_member_tracker`

Migration:

```sql
DROP POLICY "Founding member tracker is publicly readable" ON public.founding_member_tracker;

-- Owner can see own row (their purchase_number / badge)
CREATE POLICY "Users can view own founding member row"
  ON public.founding_member_tracker FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins can see everything (support)
CREATE POLICY "Admins can view all founding member rows"
  ON public.founding_member_tracker FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Public count stays available via existing SECURITY DEFINER RPC get_n_count.
-- Stripe session IDs are now invisible to anon and to non-owner authenticated users.
```

No client code changes — `useFoundingMemberCount` already uses the RPC, and `delete-my-account` runs as service role.

### 2. Tighten `user_social_links` (privacy-by-default, public-guide opt-in)

Migration:

```sql
DROP POLICY "Anyone can read social links" ON public.user_social_links;

-- Anonymous + authenticated can read links ONLY for users who have a published
-- community guide (those users have an explicit public creator surface).
CREATE POLICY "Public can read social links for published creators"
  ON public.user_social_links FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.community_guides cg
      WHERE cg.user_id = user_social_links.user_id
        AND cg.status = 'published'
    )
  );

-- Owners always see their own (existing "Users can read own social links" stays).
```

(Existing `Users can read own social links` / insert / update / delete policies are unchanged.)

If `community_guides.status` uses a different published value, the migration will be adjusted to match the existing enum before running.

### 3. Verification (post-migration, no code changes expected)

- Anonymous: `select stripe_session_id from founding_member_tracker` → 0 rows.
- Anonymous: `get_n_count()` RPC → still returns count.
- Owner authenticated: sees their own founding_member_tracker row only.
- Anonymous: select from `user_social_links` filtered by a creator with a published guide → returns rows (CommunityGuidePublic + CreatorCard keep working).
- Anonymous: select for a random non-creator user → 0 rows.
- Authenticated owner: still reads/writes own social links (profile editor unchanged).

### Files touched
- One new migration under `supabase/migrations/`. No frontend or edge-function changes.
