

## Fix: Case-Sensitive Token Lookup + accept_trip_invite Case-Insensitive Update

### What's already done (from previous implementations)
- `AcceptInvite.tsx`: `link_replaced` in `TERMINAL_REASONS` and `getErrorDisplay` ✓
- `useStalePendingChargeRefund.ts`: sessionStorage guard ✓
- `resolve_or_rotate_invite`: soft-delete with `replaced_at` ✓
- `get_trip_invite_info`: `link_replaced` reason + `replaced_at` check ✓

### What's needed: Single database migration

**1. Replace `generate_share_token()`** — switch from base64 (mixed-case) to hex encoding (lowercase-only: a-f, 0-9). Default size 16 bytes → 16 hex chars.

**2. Case-insensitive index** — `CREATE INDEX idx_trip_invites_token_lower ON trip_invites(LOWER(token))` for performance.

**3. Backfill existing tokens** — `UPDATE trip_invites SET token = LOWER(token) WHERE token <> LOWER(token)`.

**4. Update `get_trip_invite_info()`** — change `WHERE token = p_token` to `WHERE LOWER(token) = LOWER(p_token)`. Keep all existing logic (replaced_at check, failure logging, etc.).

**5. Update `accept_trip_invite()`** — change line 21 from `WHERE token = p_token FOR UPDATE` to `WHERE LOWER(token) = LOWER(p_token) FOR UPDATE`. Rest of function unchanged.

**6. Add `replaced_at` column** — `ALTER TABLE trip_invites ADD COLUMN IF NOT EXISTS replaced_at TIMESTAMPTZ DEFAULT NULL` (may already exist from previous migration; `IF NOT EXISTS` makes it safe).

### Files changed
| File | Change |
|------|--------|
| New migration (SQL) | All 6 items above in a single migration |

No frontend changes needed — everything is already in place.

