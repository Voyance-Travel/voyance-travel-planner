## Fix AI Concierge "Invalid token" error

### Root cause

`supabase/functions/activity-concierge/index.ts` (lines 122–146) validates the bearer token with the legacy `authClient.auth.getUser(token)` pattern instead of the project-wide `getClaims` / `parseAuth` helper. With the new asymmetric JWT signing keys, `getUser` rejects valid sessions (network round-trip to `/auth/v1/user` returns 401 in cases where `getClaims` verifies the same token successfully). Every other paid edge fn in the project (`weather`, `enrich-destination`, `suggest-landmarks`, etc.) was migrated to the shared helper — concierge was missed.

The client (`useActivityConcierge.ts`) is already sending the right token (user JWT, with refresh+retry on 401), so no client change is needed.

### Change

In `supabase/functions/activity-concierge/index.ts`, replace the inline auth block with the shared helper:

```ts
import { parseAuth } from "../_shared/parse-auth.ts";
...
const auth = await parseAuth(req);
if (auth instanceof Response) return auth;
const userId = auth.userId;
```

Remove the `createClient` / `getUser` block and the manual 401 responses. Keep the existing handler logic below untouched.

### Verification

1. Hit `activity-concierge` from the live preview (logged-in session) — should stream a response, no "Invalid token".
2. Curl without an `Authorization` header — should still 401 with `"Authentication required"`.
3. Check edge function logs for a successful 200.

UI/business logic untouched. One file edited.