

## Fix: Share Link "Not Valid" + StalePendingCharge Infinite Loop + Invite Telemetry

### Changes

#### 1. Database Migration (single migration)
- Add `replaced_at TIMESTAMPTZ` column to `trip_invites` (soft-delete marker)
- Create `invite_failure_log` table with RLS (service-role only)
- Replace `resolve_or_rotate_invite` function: change DELETEs to `UPDATE SET replaced_at = now()`, filter active invites with `AND replaced_at IS NULL`
- Replace `get_trip_invite_info` function: add `link_replaced` reason for tokens where `replaced_at IS NOT NULL`, insert into `invite_failure_log` on every failure path (token_not_found, link_replaced, expired, invite_limit_reached)

#### 2. `src/pages/AcceptInvite.tsx`
- Add `'link_replaced'` to `TERMINAL_REASONS` set (line 48-57)
- Add `case 'link_replaced'` to `getErrorDisplay` (after line 67): title "Link Updated", message "The trip owner created a new invite link. Ask them for the updated link."
- Add client-side failure logging after invite info returns invalid: fire-and-forget insert to `invite_failure_log` with token, reason, user_agent, referrer, user_id

#### 3. `src/hooks/useStalePendingChargeRefund.ts`
- Add `sessionStorage` guard per charge ID: before attempting refund, check `stale_refund_failed_{chargeId}`; on failure, set it. This prevents infinite retry loops across re-renders/navigations within the same session.
- The orphaned `await supabase` was already fixed in a previous deployment — current code (line 54) is clean.

### Files Changed
| File | Change |
|------|--------|
| Migration (SQL) | `replaced_at` column, `invite_failure_log` table, updated `resolve_or_rotate_invite` + `get_trip_invite_info` |
| `src/pages/AcceptInvite.tsx` | `link_replaced` in TERMINAL_REASONS + getErrorDisplay + failure logging |
| `src/hooks/useStalePendingChargeRefund.ts` | sessionStorage guard to stop infinite retry |

