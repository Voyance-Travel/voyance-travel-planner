# Security Round R1–R6: Actually-Apply Fixes

Three findings have been "fixed" in prior rounds without the substantive step landing (column-restricted policy was only renamed; Realtime policy is still `USING(true)`; SECURITY DEFINER list was enumerated but not revoked). This plan executes every step end-to-end with verification, in two migrations + one edge-function batch.

Confirmed via DB inspection:
- `customer_reviews` still has policy `Anon can read approved reviews (column-restricted)` with `qual=(is_approved=true)` — RLS only, no column filter, no view, no REVOKE.
- `realtime.messages` policy is literally `USING (true)`.
- `trip_collaborators` has **no** email column — the email leak the linter flagged lives on **`trip_members`** (and `trip_invites`).
- Frontend already queries `trip_collaborators` in 13 files but none need an email; only `trip_members` reads need a view.

## R1 — customer_reviews PII (ERROR)

Migration:
1. Drop every anon-readable policy on `customer_reviews` (dynamic loop over `pg_policies`).
2. Create `public_customer_reviews` view (`security_barrier=true`) selecting only id, trip_id, rating, review_text, helpful_count, created_at, and a derived `reviewer_display` (display_name or masked initial). No email, no user_id.
3. `GRANT SELECT ON public_customer_reviews TO anon, authenticated`.
4. `REVOKE SELECT ON customer_reviews FROM anon, PUBLIC`. Add owner-only `customer_reviews_owner_read` policy for authenticated.

Frontend: `src/components/reviews/ReviewCapturePopup.tsx` is the only `from('customer_reviews')` caller and writes the user's own review — keep as-is (authenticated owner write).

## R2 — Realtime topic scoping (ERROR)

Migration:
1. `DROP POLICY realtime_authenticated_only ON realtime.messages`.
2. Create `realtime_trip_subscriptions`: a `CASE` on `realtime.topic()` matching `trip:{uuid}` → exists in `trips` as owner OR accepted `trip_collaborators` row; `user:{uuid}` → uid match; explicit allowlist (`system:*`, `public:health`); else false.
3. Audit `supabase.channel(` callsites in `src/` to confirm topic format. If any callsite uses a non-conforming topic, normalize it before migration ships.

## R3 — 10 unauthenticated paid-API edge functions (ERROR)

Apply standard JWT-validation prelude (mirroring `weather`/`suggest-landmarks`) to:

`nearby-suggestions`, `fetch-reviews`, `recommend-restaurants`, `airport-transfers`, `flight-status`, `lookup-local-events`, `lookup-travel-advisory`, `viator-search`, `viator-product`, `viator-availability`.

Also sweep additional paid callers in the same batch: `enrich-attraction`, `enrich-destination`, `lookup-destination-insights`, `lookup-activity-url`, `lookup-restaurant-url`, `suggest-hotel-swaps`, `mapkit-token` (sensitive token — auth required).

Pattern injected at top of each handler after CORS preflight:
```ts
const authHeader = req.headers.get('Authorization');
if (!authHeader?.startsWith('Bearer ')) return json({error:'Authentication required'}, 401);
const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
const { data: { user }, error } = await supa.auth.getUser();
if (error || !user) return json({error:'Invalid token'}, 401);
```

Cost tracker `trackCost(...)` already present in most; keep as-is.

`destination-images` deliberately left anon-readable (public hero images for share previews) — flag to the user before changing; will note as accepted risk in security memory if user agrees.

## R4 — trip_members email exposure (WARNING)

Migration:
1. Create `public_trip_members` view: id, trip_id, user_id, role, accepted_at, created_at, joined display_name/avatar from `profiles`; **no email**.
2. `GRANT SELECT ON public_trip_members TO authenticated`.
3. Replace permissive collaborator-read policy on `trip_members` with:
   - owner-only SELECT (`trips.user_id = auth.uid()`),
   - self-row SELECT (`user_id = auth.uid()`).
4. Frontend: `grep` `from('trip_members')` callsites; non-owner UIs that just need display info → `public_trip_members`; invite-management UIs stay on base table (owner sees emails of who they invited).

Same treatment for `trip_invites` if it surfaces emails to non-owners (verify policies first).

## R5 — parse-document-text auth + size cap (WARNING)

`supabase/functions/parse-document-text/index.ts`: add JWT check (R3 pattern), enforce `MAX_SIZE = 5 * 1024 * 1024` and restrict MIME to `text/plain`, `application/pdf`. Same pattern for any other `parse-*` paid-API caller (`parse-booking-confirmation`, `parse-travel-story`, `parse-trip-input`).

## R6 — SECURITY DEFINER revoke pass (WARNING)

Migration: per-function REVOKE pass.
1. Enumerate `pg_proc` SECURITY DEFINER functions in `public`.
2. Classify each by reading `prosrc`:
   - **User-callable** (contains `auth.uid()` and is invoked from client RPCs `get_consumer_shared_trip`, `get_shared_trip_payload`, public counters, `get_intake_account` — already allow-listed in prior migration): keep `authenticated` grant.
   - **Service-only** (no auth check, mutates system state, called only by edge functions/triggers): `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated; GRANT EXECUTE … TO service_role`.
3. Apply REVOKEs in the same migration so the linter actually clears.

## Verification (after each step)

- `curl` anon `customer_reviews` → 401/empty; `public_customer_reviews` → rows without `email`; `?select=email` → error.
- Two-user Realtime sub test on `trip:{owned}` vs `trip:{not-owned}`.
- `curl` each fixed edge function without Authorization → 401; with token → 200.
- Re-run Supabase linter: customer_reviews PII, Realtime, trip_members, SECURITY DEFINER, parse-document findings should all clear.
- Update security memory documenting accepted-risk for any intentionally-public function (e.g. `destination-images`).

## Technical notes

- All DB changes ship as **two migrations** (R1+R2+R4+R6 in one schema migration; storage/policy adjustments isolated). Frontend query swaps ship in same loop after migrations apply.
- Edge functions R3 + R5 ship as a single batched edit set (~14 files) — uniform prelude, no business-logic changes.
- No changes to `src/integrations/supabase/client.ts` or `types.ts` (auto-generated).
- Will ask the user one clarifying question before executing: confirm whether `destination-images` (and any other anon-public function discovered during R3 sweep) should remain anon-readable for share-link previews, or be auth-gated.