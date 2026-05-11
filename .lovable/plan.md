## Q43 result

Live DB query returned **31 SECURITY DEFINER public functions** with broad EXECUTE grants. Splitting by grantee (zero `PUBLIC` grants — only `anon` and `authenticated`):

### `anon`-callable (6) — by design
| Function | Purpose | Verdict |
|---|---|---|
| `get_consumer_shared_trip` | Read trip via public share token | ✅ intentional (consumer share architecture) |
| `get_shared_trip_payload` | Same family, payload variant | ✅ intentional |
| `get_founding_member_count` | Landing-page social proof | ✅ intentional |
| `get_platform_destination_count` | Landing-page stat | ✅ intentional |
| `get_platform_trip_count` | Landing-page stat | ✅ intentional |
| `get_intake_account` | Client intake (concierge form?) | ⚠️ needs 60-second source read to confirm anon is intended |

### `authenticated`-callable (~30) — by design
These are the app's RPC surface. They're SECURITY DEFINER on purpose so RLS-aware queries can run against tables that authenticated users can't read directly. Any blanket `REVOKE EXECUTE FROM authenticated` would break invites, credit deduction, group budgets, share toggles, intake submission, the booking-state machine, and the entire DNA pipeline.

The three worth a paranoid second look (PII enumeration risk):
- `get_current_user_email` — should return *only* the caller's own email
- `get_user_id_by_email` — invite/lookup helper; risk is unbounded enumeration
- `get_user_info_by_email` — same family

### Conclusion: do NOT ship a blanket REVOKE migration

Linter findings 0010 / "broad SECURITY DEFINER" on these are architectural-by-design, not drift. The right answer is **audit + document**, not revoke.

## Plan

1. **Read source of the 4 functions on the watch list** — `get_intake_account`, `get_current_user_email`, `get_user_id_by_email`, `get_user_info_by_email`. Confirm each one either (a) restricts to `auth.uid() = …` internally, or (b) is intentionally enumerable for a documented reason (e.g. invite UX needs to look up by email).
2. **Per-function decisions:**
   - If `get_intake_account` doesn't actually need anon access → ship a targeted `REVOKE EXECUTE … FROM anon` for it only.
   - If any of the email-lookup functions enumerate without a rate guard → add a `auth.uid() IS NOT NULL` guard or convert to a `WHERE` that requires the caller already know the user_id (defeats enumeration).
   - All others → leave as-is.
3. **Update `@security-memory`** with an "Accepted findings" section listing:
   - The 5 confirmed intentional anon RPCs (share-link reads + landing stats) and *why* they're public.
   - The pattern that authenticated SECURITY DEFINER RPCs are the project's standard contract for RLS-bypassing privileged operations, so future scanner runs don't re-flag the ~30 entries.
4. **Re-run `supabase--linter`** to confirm warning count drops or that the remaining ones are now expected per memory.

## Out of scope

- No code refactor of working RPCs.
- No mass DDL migration. Only a targeted REVOKE *if* step 1 turns up a function that doesn't need anon.

## Deliverables

- Read-only audit of 4 functions (no DB writes if all check out).
- At most one tiny migration (single-line REVOKE) — only if step 1 finds drift.
- Updated `@security-memory` documenting the accepted pattern.
- Final linter snapshot.
