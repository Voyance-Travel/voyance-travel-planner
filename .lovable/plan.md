# X3 — Lock down `send-push` to service-role only

## Problem
`supabase/functions/send-push/index.ts` has zero auth on its handler (`verify_jwt = false` by default + no in-code check). Any anon caller can POST `{ userId, title, body, data }` and trigger an APNs push to that user's devices. Active phishing/spam vector.

## Caller audit (done)
| Caller | Auth header sent | Status |
|---|---|---|
| `supabase/functions/trip-notifications/index.ts:349` | `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` (line 296) | ✓ safe |
| `supabase/functions/send-trip-reminders/index.ts:541` | `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` (line 384) | ✓ safe |
| `src/**` | — | **0 matches** ✓ |

No frontend caller. No refactor needed — both internal callers already pass the service-role key.

## Fix
Add a service-role gate at the top of the `serve()` handler in `supabase/functions/send-push/index.ts`, immediately after the OPTIONS preflight (before the `try { … }` block):

```ts
if (req.method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders });
}

// Require service-role auth — push notifications are server-triggered, never user-triggered.
const authHeader = req.headers.get('Authorization');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!authHeader || !serviceRoleKey || authHeader !== `Bearer ${serviceRoleKey}`) {
  return new Response(
    JSON.stringify({ error: 'Forbidden — service-role auth required', code: 'FORBIDDEN' }),
    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

No other code changes. No DB migration. No `supabase/config.toml` change (existing default `verify_jwt = false` is fine since we now validate in code).

## Verification
1. `curl -X POST <send-push-url>` no auth → 403 `FORBIDDEN`
2. `curl -X POST` with `Bearer <anon_key>` → 403 `FORBIDDEN`
3. `curl -X POST` with `Bearer <SUPABASE_SERVICE_ROLE_KEY>` and valid body → 200 (or `NOT_CONFIGURED`/`no_tokens`)
4. Internal callers (`trip-notifications`, `send-trip-reminders`) continue to receive 200 — they already send the service-role key.
5. Linter no longer flags `send-push` as unauthenticated.

## Memory
Update `mem://constraints/security/edge-function-auth-required` with a new bullet: `send-push` is **service-role-only** (Pattern D — strict equality check against `SUPABASE_SERVICE_ROLE_KEY`). Future callers from the frontend MUST go through an authed wrapper edge function (e.g., a hypothetical `send-trip-update-notification`) that validates the trigger then calls `send-push` with the service-role key.

## Out of scope
Other unauthenticated edge fns flagged in the scan (`activities/transfer-pricing no-auth`, `trip_notifications JWT-claim check`, `agency_documents visibility`, AI endpoints). Each needs its own pattern (user-auth vs service-role) — separate fixes.
