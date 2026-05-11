# Q43 Friend-Request Refactor + Audit Batch Closeout

## Priority 1 (BLOCKING) — Q43 Refactor: Restore `sendFriendRequestByEmail`

**Context.** `get_user_id_by_email` was hardened to admin-only in a prior migration. `src/services/supabase/friends.ts:162` (`sendFriendRequestByEmail`) silently 403s for every non-admin user. This is a real broken feature in production; refactor — don't remove.

### Steps

1. **Pre-flight check (BLOCKING gate)** — run pg_stat_statements query for any non-repo callers of `get_user_id_by_email` and `get_user_info_by_email`. If `pg_stat_statements` is unavailable, defer the `_info_` DROP only — proceed with everything else. Sentinel logged.

2. **New edge function** — `supabase/functions/friend-request-by-email/index.ts`:
   - `verify_jwt = true` via shared `_shared/require-auth.ts` pattern (must have `auth.uid()`)
   - Service-role client looks up email → user_id
   - If found and not self and no existing friendship/pending request → insert `friend_requests` row
   - **Always returns the same shape** regardless of registration status, self-request, or existing-request: `{ ok: true, message: "If that email belongs to a Voyance user, your request has been sent." }`
   - **Per-caller rate limit:** 20 requests/hour per `auth.uid()`. Use existing `rate_limit_log` infra if present (grep first); otherwise simple table-backed counter (NOT in-memory — edge functions are stateless). New table `friend_request_rate_log(user_id, created_at)` with index on `(user_id, created_at)` and a `cleanup_friend_request_rate_log()` purge >24h. Over-limit also returns the same neutral shape (no 429 leak).
   - Input validation: Zod schema, lowercase + trim email, max 255 chars
   - All error branches return the neutral shape — never `{error: "..."}` that leaks state
   - CORS headers on every response

3. **Refactor frontend** — `src/services/supabase/friends.ts:162` `sendFriendRequestByEmail`:
   - Replace `supabase.rpc('get_user_id_by_email', ...)` + manual insert with single `supabase.functions.invoke('friend-request-by-email', { body: { email } })`
   - Toast copy uses returned `message` verbatim
   - Remove now-dead error branches (user-not-found, self-request, duplicate) — all collapse into the neutral success path

4. **Migration — drop `get_user_info_by_email` only** (gated on step 1):
   - `DROP FUNCTION public.get_user_info_by_email(text);`
   - Keep `get_user_id_by_email` admin-only (legitimate sole caller: `SessionExplorer.tsx`)

5. **Tests** — `supabase/functions/friend-request-by-email/__tests__/`:
   - Unregistered email → neutral success, no DB write
   - Registered email → neutral success + `friend_requests` row exists
   - Self-request → neutral success, no row
   - Duplicate request → neutral success, no second row
   - Rate-limit boundary: 20th request OK, 21st returns neutral success but no DB write (sentinel `[FRIEND_REQ_RATE_LIMIT]`)
   - Response shape byte-identical across all branches (enumeration-safety assertion)

6. **Memory** — update `mem://constraints/security/security-definer-accepted-class.md`:
   - `get_user_info_by_email` removed (or deferral noted)
   - `get_user_id_by_email` admin-only, sole caller `SessionExplorer.tsx`
   - Friend-by-email flow now goes through `friend-request-by-email` edge function with rate limit

---

## Priority 2 — Approved follow-ups (batch ship after Q43)

### M3 addendum — wrap-past-midnight edge case
`detectGapsForDay` + `analyzeHealth`: use `endTime === 0 && startTime > 0` (more defensive than `<= 0`). One-line guard + regression test for 23:30 → 00:00 bookend.

### M5 ceiling review
Audit `_shared/category-price-bounds.ts` upper bounds for `bike_tour` ($90→$150), `food_tour`, `wine_tasting`, `cooking_class`, `boat_tour`. Document chosen ceiling rationale in file header comment block. Mirror in `action-repair-costs.ts`.

### R4 — Profiles RLS probe (BLOCKING gate before companion policy)
Run probe query as a co-collaborator (non-owner) reading another collaborator's `profiles.display_name`. If denied, add `profiles_collaborator_read` policy: `USING (EXISTS (SELECT 1 FROM trip_collaborators tc1 JOIN trip_collaborators tc2 ON tc1.trip_id = tc2.trip_id WHERE tc1.user_id = auth.uid() AND tc2.user_id = profiles.user_id AND tc1.status = 'accepted' AND tc2.status = 'accepted'))` exposing `display_name` + `avatar_url` only. If allowed, ship migration as-is.

### R5 verify
Curl-test the 4 parse-* edge functions (booking-confirmation, document-text, travel-story, trip-input) without auth → expect 401. With auth → expect 200/proper response. Spot-fix only the one(s) that fail. No broader changes.

### Description-coverage telemetry note
Memory-only update on `mem://constraints/itinerary/description-coverage.md`: documented the `>5% false-positive` relax-trigger. No code change.

---

## Sequencing

1. Q43 ships first (closes real broken feature)
2. M3 / M5 / R5 in parallel after Q43 lands
3. R4 probe runs separately (BLOCKING gate decides whether to add companion policy)
4. Memory updates last

## Out of scope

- Hotel-return, M1, M2, M4, M6, description-coverage code changes — already shipped in prior rounds (per chat history). This plan is the residual queue: Q43 refactor + the four small follow-ups + R4 probe + R5 verify.

## Risks

- **`pg_stat_statements` unavailable.** Mitigation: defer only the `_info_` DROP; everything else proceeds. Memory notes the deferral.
- **Rate-limit infra audit miss.** If existing `rate_limit_log` exists, use it (grep first). Otherwise dedicated table, not in-memory.
- **R4 probe ambiguous.** If probe shows partial access (some collaborators yes, others no), default to adding the companion policy — never ship a "Member abc12345" regression.
