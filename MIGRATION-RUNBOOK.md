# Migration Runbook — Lovable Cloud → Owned Supabase

**Why:** Lovable Cloud's PostgREST schema cache cannot be reliably reloaded (no `NOTIFY`,
DDL, or AI "reload schema" takes; no restart available to us). This bit us hard on the
share feature and is the root cause of repeated incidents. Owning the Supabase project gives
us dashboard, restart, logs, backups, and ends this class of problem.

**Scope reality:** multi-hour, **co-driven** (owner does account/secrets/OAuth; agent drives
CLI/repo). **No real users yet** → skip data + auth-user migration; this is a clean stand-up.

---

## STATUS / PROGRESS
- [x] Approach validated (CLI 2.105 + Docker present; migrations replay locally)
- [x] Full dependency map captured (below)
- [x] Migration blocker #1 fixed (Barcelona data-repair FK) — branch `chore/migration-prep-fixes`
- [ ] Migration blocker #2 — duplicate policy `Users can view profiles of outgoing pending requests` (CREATE w/o DROP IF EXISTS). Likely more after it.
- [ ] Clean replay achieved → `supabase db dump --schema-only` baseline (recommended over replaying 473 drifted files)
- [ ] Owner: new project + 45 secrets + OAuth + Stripe
- [ ] Cutover

---

## STEP 1 — Get a CLEAN schema for the new project
**⚠️ Do NOT try to fix all 473 migrations one-by-one — it's whack-a-mole.** The drift is
structural: Lovable's auto-sync created **consolidated-duplicate migrations** (e.g.
`20260605135409` literally re-runs `20260605130000` + others → "already exists" /
FK errors on replay). There are an unknown number of these.

**Preferred path — schema-only dump of the LIVE DB** (it has the correct final state):
- Ask **support@lovable.dev** for a `pg_dump --schema-only` of the project, OR if a direct
  DB connection string can be obtained, run it ourselves. Save as `supabase/baseline-schema.sql`.
- Apply that single baseline to the new project (Step 3). Zero drift, zero whack-a-mole.

**Fallback — local replay cleanup** (only if no live dump is available):
- Iteratively `supabase start` / `db reset`, fixing each error, then `supabase db dump --schema-only`.
  - Data-repair (INSERT w/ hardcoded UUID): guard `WHERE EXISTS (SELECT 1 FROM <fk> WHERE id='<uuid>')`.
  - Consolidated-duplicate migrations: neutralize them (their content already exists in the
    separate files) or make every statement idempotent (`DROP ... IF EXISTS` / `CREATE OR REPLACE`).
- Known blockers so far: #1 `20260527223924` Barcelona FK (FIXED on `chore/migration-prep-fixes`);
  #2 `20260605135409` consolidated duplicate (policy + google budget + more) — neutralize.

## STEP 2 — Owner stages the new project (OWNER — agent cannot do)
1. supabase.com → **New project** (name, region near users, DB password).
2. From **Settings → API**: copy **Project URL**, **anon/publishable key**, **project ref**.
3. **Settings → Access Tokens** (account level): generate token → hand to agent.
4. **Enter the ~45 secrets** (Edge Functions → Secrets). Values come from each provider
   (write-only in old Cloud — not recoverable; you have them at source):
   - Google: `GOOGLE_MAPS_API_KEY`, `GOOGLE_PLACES_API_KEY`, `GOOGLE_GEOCODE_API_KEY`, `GOOGLE_ROUTES_API_KEY`, `GOOGLE_DAILY_CALL_CEILING`
   - AI: `PERPLEXITY_API_KEY`, `LOVABLE_API_KEY` (⚠️ may not work off-Cloud — generation pipeline; verify/replace)
   - Travel: `AMADEUS_API_KEY`/`_SECRET`, `VIATOR_API_KEY`, `FOURSQUARE_API_KEY`, `TRIPADVISOR_API_KEY`, `OPENTRIPMAP_API_KEY`
   - Images: `UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY`
   - Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (new — see Step 5)
   - Email: `SENDGRID_API_KEY`, `ZOHO_SMTP_USER`/`_PASSWORD`, `FROM_DOMAIN`, `SENDER_DOMAIN`, `SITE_DOMAIN`, `SITE_URL`, `SUPPORT_EMAIL`
   - Apple: `APPLE_TEAM_ID`, `APPLE_PRIVATE_KEY`, `APPLE_MAPKIT_KEY_ID`, `APPLE_APNS_KEY_ID`, `APPLE_APNS_PRODUCTION`, `APNS_BUNDLE_ID`, `APPLE_IAP_SANDBOX`, `APPLE_SHARED_SECRET`
   - (`SUPABASE_URL`/`SERVICE_ROLE_KEY`/`ANON_KEY` auto-injected — do NOT set manually.)

## STEP 3 — Apply schema + functions (AGENT)
```
supabase link --project-ref <ref>          # uses access token
supabase db push                            # or: psql < supabase/baseline-schema.sql
supabase functions deploy                   # all 130+ (config.toml carries verify_jwt)
```
- Confirm extensions enabled: `pg_cron`, `pg_net`.
- Enable **realtime** publication on: `itinerary_days`, `trip_chat_messages`, notifications.

## STEP 4 — Auth (OWNER + agent verify)
- Enable **Google** + **Apple** providers (client IDs/secrets).
- Auth → URL Configuration: **Site URL** = `https://travelwithvoyance.com` + redirect URLs.
- Wire `auth-email-hook` as the auth email hook.
- **Google Cloud Console:** add `https://<new-ref>.supabase.co/auth/v1/callback` to Authorized redirect URIs (⚠️ skip this and Google login breaks — exactly today's failure).

## STEP 5 — Stripe (OWNER)
- Point the webhook at `https://<new-ref>.supabase.co/functions/v1/stripe-webhook`.
- Capture the **new** signing secret → set `STRIPE_WEBHOOK_SECRET`.
- Price/product IDs (`price_1Syc…`) unchanged (same Stripe account).
- Connect onboarding/payout return URLs → update if hardcoded.

## STEP 6 — Storage (AGENT/OWNER)
- App-content buckets to recreate + copy files: `site-images`, `destination-images`, `guide-photos`.
- Skip (user content, none yet): `avatars`, `trip-photos`, `trip-memories`, `boarding-passes`, `agency-documents`.

## STEP 7 — Cutover (AGENT drives, OWNER publishes)
- Swap in `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`.
- Keep `VITE_GOOGLE_MAPS_API_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY` (account-tied).
- Lovable build with new env ("bring-your-own-Supabase") OR move hosting — keep `travelwithvoyance.com` live.
- **Verify before flipping the domain:** Google login works, a full trip generates, share toggle enables, credits/Stripe checkout.
- **Rollback:** revert `.env` + republish (old Cloud stays up until torn down).
- After stable: ask **support@lovable.dev** to tear down the old Cloud backend (else billable).

---

## FROZEN INVENTORY (source of truth for "nothing missed")
- **Edge functions:** 130+ in `supabase/functions/` (deploy all).
- **Secrets:** ~45 (Step 2).
- **Extensions:** `pg_cron`, `pg_net`.
- **Storage buckets:** 8 (Step 6).
- **Realtime tables:** itinerary_days, trip_chat_messages, notifications.
- **Frontend env:** VITE_SUPABASE_* (swap), VITE_GOOGLE_MAPS_API_KEY, VITE_STRIPE_PUBLISHABLE_KEY (keep).
- **Known post-migration fix:** supabase auth-lock (`navigator.locks` abort) — add a resilient lock to the client so Google OAuth + init stop failing (separate change; do in/after cutover).
