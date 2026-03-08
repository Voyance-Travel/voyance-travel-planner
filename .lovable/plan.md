

## Fix: Trip Sharing — Broken Links, Capacity Limits, and URL Issues

Six coordinated changes across frontend and database to fix sharing.

### 1. `src/utils/getAppUrl.ts` — Fix production URL
- Change `PUBLISHED_URL` to `https://travelwithvoyance.com`
- Simplify logic: if origin includes `travelwithvoyance.com`, return origin; otherwise return `PUBLISHED_URL`
- This fixes all 11 callers (invites, referrals, guides, archetypes, intake links, etc.)

### 2. Database migration — Rewrite `accept_trip_invite()`
- Remove the `v_max_members` capacity check based on `travelers` count entirely
- The invite link's own `max_uses` (set in `resolve_or_rotate_invite`) is sufficient abuse protection
- Keep all other logic: token validation, expiry check, already-member check, collaborator insert, friendship insert

### 3. Database migration — Rewrite `resolve_or_rotate_invite()`
Three changes:
- Increase `v_max_uses` from `GREATEST(7, travelers*2)` to `GREATEST(10, travelers*3)`
- Increase expiry from `7 days` to `30 days`
- Remove `spotsRemaining` from the returned JSONB object

### 4. Database migration — Rewrite `get_trip_invite_info()`
- Remove `spotsRemaining` from returned JSONB
- Remove the capacity/trip_full check (it doesn't exist in current code but ensure it stays removed)

### 5. Database migration — Backfill existing invites
- Update active invites with `max_uses < 10` to at least 10
- Extend expiry of active invites that were set to ~7 days to 30 days from creation

### 6. Frontend cleanup — Remove "spots remaining" UI
Three files:
- **`src/services/inviteResolver.ts`**: Remove `spotsRemaining` from `InviteHealth` interface
- **`src/pages/AcceptInvite.tsx`** (lines 407-412): Delete the `spotsRemaining` display block; remove from `InviteInfo` interface (line 36)
- **`src/components/itinerary/EditorialItinerary.tsx`** (lines 5887-5900): Replace spots/capacity text with simple "Link active · Expires in 30 days" message

### What stays unchanged
- Token generation, token persistence, AcceptInvite flow logic, collaborator permissions, friendship creation, force-rotate, credit bonus for first share

### Important note for the user
After deploying, verify that `travelwithvoyance.com` is listed in the backend authentication redirect URLs. If OAuth sign-up from share links fails, this is likely the cause — the domain needs to be whitelisted for auth redirects.

