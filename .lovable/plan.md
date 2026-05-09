## Fix 5 — Env-driven domain config in `auth-email-hook`

Replace the three hardcoded domain constants in `supabase/functions/auth-email-hook/index.ts` (lines 39–41) with env-var lookups that fall back to today's production values, so prod behavior is unchanged and staging/preview can override.

### Change

In `supabase/functions/auth-email-hook/index.ts`, replace lines 39–41:

```ts
const ROOT_DOMAIN = Deno.env.get("SITE_DOMAIN") ?? "travelwithvoyance.com";
const FROM_DOMAIN = Deno.env.get("FROM_DOMAIN") ?? ROOT_DOMAIN;
const SENDER_DOMAIN = Deno.env.get("SENDER_DOMAIN") ?? `notify.${ROOT_DOMAIN}`;
```

Order matters: `ROOT_DOMAIN` must be declared before `FROM_DOMAIN`/`SENDER_DOMAIN` so the fallbacks resolve correctly.

### Out of scope

- No changes to `SITE_NAME`, sample data, or template rendering.
- No new secrets created in prod (defaults preserve current behavior). Non-prod env vars are set by the operator, not by this change.
- No frontend changes.

### Verification

- Typecheck / function builds clean.
- Without env vars set: emits links at `travelwithvoyance.com` / `notify.travelwithvoyance.com` (unchanged).
- With `SITE_DOMAIN=staging.example.com`: confirmation links point at `staging.example.com` and sender becomes `notify.staging.example.com`.
