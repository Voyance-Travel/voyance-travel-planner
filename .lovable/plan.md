## Lock down `test-email` to service-role + allowlist

**File:** `supabase/functions/test-email/index.ts`

**Caller audit:** `rg "test-email"` across `src/` and `supabase/functions/` returns zero matches. No frontend or backend code invokes this function — it is purely an admin/debug tool. No callers need to be removed or migrated.

### Changes

Inject two gates immediately after the CORS preflight check (before any other logic, including the `isConfigured()` short-circuit so unauthenticated callers can't probe SMTP config state):

1. **Service-role auth gate** — reject unless `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` matches exactly. Returns `403 FORBIDDEN`.
2. **Recipient allowlist gate** — parse the JSON body once, lowercase-trim `to`, and require it to be in `ALLOWED_TEST_RECIPIENTS` (initially `ashtonlaurenn@gmail.com`). Returns `400 RECIPIENT_NOT_ALLOWED`.

The existing "fall back to authenticated user's email" branch (lines 169–182) is removed — under service-role auth there is no end-user, and the allowlist is now the single source of truth for recipient. The `targetEmail` resolution collapses to the validated `toAddress` from the allowlist check.

### Verification (post-deploy)

- `curl -X POST <url>` (no auth) → 403 FORBIDDEN
- `curl -X POST -H "Authorization: Bearer <ANON_KEY>"` → 403 FORBIDDEN
- `curl -X POST -H "Authorization: Bearer <SERVICE_ROLE>" -d '{"to":"random@example.com"}'` → 400 RECIPIENT_NOT_ALLOWED
- `curl -X POST -H "Authorization: Bearer <SERVICE_ROLE>" -d '{"to":"ashtonlaurenn@gmail.com"}'` → 200, email delivered
- Linter no longer flags `test-email` as unauthenticated email-send vector

### Memory

Add new entry `mem://constraints/security/test-email-service-role-only` documenting:
- `test-email` is admin-only, service-role auth required
- Recipient must be in `ALLOWED_TEST_RECIPIENTS` allowlist (defense-in-depth vs. compromised service key)
- Never wire this function into any user-facing UI; never relax the allowlist to accept arbitrary `to`

Update `mem://index.md` with R7 reference line.
