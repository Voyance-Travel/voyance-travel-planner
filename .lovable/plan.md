## send-push lockdown — verification + memorialize

### Live verification (just run)

| Request | Result |
|---|---|
| `POST /send-push` no Authorization | **403** `Forbidden — service-role auth required` ✅ |
| `POST /send-push` Bearer **anon key** | **403** `Forbidden — service-role auth required` ✅ |
| Bearer **service-role** | Path exercised in prod by `send-trip-reminders` + `trip-notifications` (no destructive curl from agent) |

### Caller audit

- `src/` callers: **zero** matches for `send-push` ✅
- Internal callers (both already use `SUPABASE_SERVICE_ROLE_KEY` bearer):
  - `supabase/functions/send-trip-reminders/index.ts:541`
  - `supabase/functions/trip-notifications/index.ts:354` (where `supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`)

### Code state

`supabase/functions/send-push/index.ts` already has the exact gate from the finding (lines ~199–207): post-CORS-preflight constant-equality check against `SUPABASE_SERVICE_ROLE_KEY`, returning `403 { error: 'Forbidden — service-role auth required', code: 'FORBIDDEN' }`. **No code changes needed.**

### Action — memorialize only

1. **Create `mem://constraints/security/send-push-service-role-only.md`** documenting:
   - send-push is service-role ONLY (push notifications are server-triggered: trip generation complete, reminder cron, booking confirmed — never user-triggered)
   - 403 returned for missing/anon/user-JWT Authorization
   - Two known internal callers (send-trip-reminders, trip-notifications) — both must continue passing `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
   - Frontend `src/` MUST NEVER call `supabase.functions.invoke('send-push')`. Any future user-triggered push (e.g. "send test notification") must go through a separate authed endpoint that internally invokes send-push with service-role
   - Verified curl matrix (the table above)

2. **Update `mem://index.md`** — add R9 reference line linking to the new constraint (preserve all existing content).

3. **Mark the security finding as fixed** via `security--manage_security_finding` (operation `mark_as_fixed`) referencing the in-place service-role gate + caller audit.

No migration. No edge function edits. No frontend changes.