# Realtime anon hard-deny (R6 — defense in depth)

## Current state (verified)
`realtime.messages` has exactly one policy: `realtime_topic_scoped` — PERMISSIVE, `TO authenticated`, `FOR SELECT`, with a `CASE` matching `trip:<id>` / `user:<id>` topics against `auth.uid()` ownership/collaboration. No anon policy exists, so anon is already denied today by Postgres RLS default.

The linter flag is for **defense in depth**: if a future maintainer adds any PERMISSIVE policy that touches `anon`, anon would silently start getting access. A RESTRICTIVE deny ANDs with all permissive policies and cannot be bypassed.

## Migration

```sql
CREATE POLICY "realtime_messages_deny_anon"
ON realtime.messages
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);
```

`FOR ALL` covers SELECT/INSERT/UPDATE/DELETE — Realtime broadcast/presence writes also flow through this table, so we don't want a future channel feature to accidentally let anon write.

The existing `realtime_topic_scoped` policy is untouched.

## No code changes
Frontend Realtime subscriptions already require an authenticated session; nothing in `src/` needs editing.

## Verification
- Signed-out: subscribe to any Realtime channel → rejected
- Signed-in owner: subscribe to own `trip:<id>` channel → works
- Signed-in non-collaborator: subscribe to someone else's `trip:<id>` → rejected by existing `CASE`
- Linter: Realtime anon coverage warning clears

## Memory
New entry `mem://constraints/security/realtime-subscription-rules`:
> Realtime channel subscription requires authenticated + topic-matched ownership (trip:<id> → owner OR accepted collaborator; user:<id> → self). anon is explicitly denied via RESTRICTIVE policy `realtime_messages_deny_anon` (belt-and-braces against future permissive policy additions). Never add a PERMISSIVE policy on `realtime.messages` covering `anon`.

Add a one-liner reference under Memories in `mem://index.md`.

## Out of scope
- No changes to `realtime_topic_scoped`
- No frontend changes
- No other realtime tables (none with policies)