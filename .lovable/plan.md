# R3.10 — Explicit EXECUTE grants on `transition_booking_state`

## Background

`transition_booking_state(uuid, public.booking_item_state, text, text, jsonb)` currently relies on Postgres defaults: it works for `service_role` because `SECURITY DEFINER` runs as the function owner, and for `authenticated` because PUBLIC has EXECUTE by default on functions. There's no explicit grant, and `anon` is not blocked. Defense-in-depth: lock it down.

## Migration

Single migration, no schema or function-body changes. Belt-and-braces grants:

```sql
-- R3.10: Explicit privilege model for transition_booking_state.
-- The function already enforces auth via auth.uid() + ownership/collaborator
-- checks, but we want anon blocked at the GRANT layer too in case any future
-- misconfiguration exposes the schema to the anon role.

REVOKE ALL ON FUNCTION public.transition_booking_state(
  uuid, public.booking_item_state, text, text, jsonb
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.transition_booking_state(
  uuid, public.booking_item_state, text, text, jsonb
) TO authenticated, service_role;
```

`REVOKE FROM PUBLIC` is required because Postgres' default function privileges grant EXECUTE to PUBLIC (which includes anon) — a bare `REVOKE FROM anon` would be a no-op while PUBLIC still holds the privilege.

## Out of scope

- The function body itself (already idempotent + auth-checked under R3.8).
- Any other RPC's grants (only the one R3.10 calls out).
- Renaming or signature changes.

## Verification

- `\df+ public.transition_booking_state` shows the explicit ACL list with `authenticated=X` and `service_role=X`, no `=X/owner` PUBLIC entry.
- Authenticated UI flows still call the RPC successfully (no behavior change).
- A direct `anon`-key call now returns a permission-denied error instead of falling through to the in-function auth check.

## Memory

Skip — the migration is self-documenting and there's no recurring footgun to remember. Future `CREATE OR REPLACE FUNCTION` calls preserve grants, so this won't drift.
