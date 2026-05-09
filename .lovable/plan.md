## Fix 8.2 — Defense-in-depth RLS on credit_purchases + group_unlocks

Both tables have SELECT (and one INSERT on `group_unlocks`) policies but no explicit deny for the other write ops. Service-role bypasses RLS today, so this is purely additive defense-in-depth — if a future RLS misconfiguration ever exposes either table to authenticated/anon, per-row policies still block.

### Existing policies (verified)

- `credit_purchases`: SELECT (own + admin)
- `group_unlocks`: SELECT (trip owner) + INSERT (`Users can purchase group unlock`) — keep both untouched

### Migration

Create `supabase/migrations/<timestamp>_rls_defense_credit_purchases_group_unlocks.sql`:

- `credit_purchases`: deny INSERT/UPDATE/DELETE to `authenticated`; deny ALL to `anon`
- `group_unlocks`: deny UPDATE/DELETE to `authenticated` (do NOT deny INSERT — would conflict with existing user-facing purchase policy); deny ALL to `anon`

PostgreSQL RLS is permissive-OR by default, so adding a deny policy alongside an allow policy still grants access via the allow. The deny policies only matter as a fallback if SELECT/INSERT allow policies are ever removed or roles change. To make these true blockers, we use `AS RESTRICTIVE` on the new policies — restrictive policies AND with permissive ones, so a `false` restrictive policy hard-blocks the role regardless of permissive policies. Since `anon` has no allow policies anywhere on these tables, the anon block is effectively a belt-and-suspenders.

Wait — `AS RESTRICTIVE` would also block the existing `group_unlocks` INSERT for `authenticated`. So:
- For `credit_purchases` (no user write policies exist): use `AS RESTRICTIVE` on INSERT/UPDATE/DELETE for `authenticated` — true defense-in-depth.
- For `group_unlocks`: use `AS RESTRICTIVE` only for UPDATE/DELETE on `authenticated` (INSERT must remain allowed by the existing permissive policy).
- For `anon` on both tables: use `AS RESTRICTIVE FOR ALL` — anon has zero allow policies so this is a hard wall.

Service-role bypasses RLS entirely (including restrictive policies), so all edge functions continue working.

Policy names are unique to this migration (verified `grep -n "deny authenticated\|deny anon" supabase/migrations/*.sql` → 0 hits).

### Verify

```
ls supabase/migrations/ | grep rls_defense
grep -rn "credit_purchases.*deny\|group_unlocks.*deny" supabase/migrations/ | head -10
grep -n "deny authenticated\|deny anon" supabase/migrations/*.sql
```
Expected: new migration exists; only the new file contains these policy names.

### Notes

- No app/edge-function code changes.
- `AS RESTRICTIVE` is the correct primitive — without it, `WITH CHECK (false)` permissive policies are silently OR-ed with future allow policies and become useless.
