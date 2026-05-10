## Goal

Lock down `supabase/functions/enrich-destination/index.ts`: require auth, rate-limit by IP and user, and record AI cost so it shows up in the admin spend dashboard.

## Changes (single file)

`supabase/functions/enrich-destination/index.ts`

1. **Imports** — add:
   - `checkDbRateLimit` from `../_shared/db-rate-limiter.ts`
   - `trackCost` from `../_shared/cost-tracker.ts`

2. **Move the service-role Supabase client creation above the auth check** (currently created at line 29, inside the request body branch) so it's available for `auth.getUser` and the rate-limiter.

3. **Auth gate (after CORS preflight, before `req.json()`):**
   - Reject missing/non-Bearer `Authorization` → 401 `UNAUTHORIZED`.
   - Call `supabase.auth.getUser(token)`. On error/no user → 401 `AUTH_INVALID`.
   - Capture `user.id` for downstream rate-limit + cost-tracker.

4. **Rate limits** (uses existing `rate_limits` table via `checkDbRateLimit`):
   - IP key from `cf-connecting-ip` → `x-forwarded-for` → `'unknown'`.
   - Per-IP: `10/min` and `50/hour` (two checks against endpoints `enrich-destination:ip:min` and `enrich-destination:ip:hour`).
   - Per-user: `20/min` and `100/hour` (endpoints `enrich-destination:user:min` and `enrich-destination:user:hour`).
   - Any rejection → 429 `RATE_LIMIT` with `retryAfter` (seconds derived from the violated window).
   - Run rate-limit checks **after** auth so anonymous traffic never touches the table.

5. **Cost tracking** around the AI call:
   - Before `fetch(...)`: `const tracker = trackCost('enrich_destination', 'google/gemini-2.5-flash').setUserId(user.id);` (the actual API uses chained setters; the spec's positional form doesn't exist in `cost-tracker.ts`).
   - After a successful `aiResponse.json()`: `tracker.recordAiUsage(aiData);` then `await tracker.save();`.
   - On the AI failure branches (429/402/other non-OK and parse failures): no `save()` call — we only bill for actual usage.
   - `trip_id` stays unset (not known in this function).

6. **Behavior preserved** for: TTL fresh-skip (still returns 200 before the AI call so it doesn't burn rate-limit budget unnecessarily — order: auth → rate-limit → fetch dest → fresh-skip → AI). Rationale: rate-limit must come before any DB read on this hot path so abusers can't fan out fresh-skip lookups either.

## Out of scope

- No schema migrations (uses existing `rate_limits` and `trip_cost_tracking`).
- No `verify_jwt` toml change — keep `verify_jwt = false`; auth is enforced in code (matches project convention).
- No frontend changes; verified there are no in-repo callers, so adding the `Authorization` header is not required anywhere else (any caller using `supabase.functions.invoke` already attaches the session token).

## Verification

- `curl` with no Authorization → 401.
- `curl` with valid token → 200 (or fresh-skip 200).
- 11 rapid POSTs from one session → 11th returns 429.
- After a successful enrichment, `select * from trip_cost_tracking where action_type='enrich_destination' order by created_at desc limit 1;` shows a row with input/output tokens populated.
