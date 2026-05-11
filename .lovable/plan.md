## Goal
Close the "Unauthenticated Cron Email Functions" finding: `send-price-alerts`, `send-trip-reminders`, and `post-trip-email` currently accept any caller and can be abused to spam users or burn email credits.

## Caller audit (already done)
- `send-trip-reminders` — zero `src/` callers. Cron-only.
- `send-price-alerts` — `src/services/priceMonitorAPI.ts` exports `triggerPriceAlert` / `useTriggerPriceAlert`, but **no component in `src/` actually calls them**. Effectively cron-only.
- `post-trip-email` — `src/services/postTripEmailService.ts` exports `sendPostTripEmail`, but **no component calls it**. Used internally / from scheduled work.

No user-facing regressions expected.

## Changes

### 1. `supabase/functions/send-trip-reminders/index.ts` — service-role only
Add at top of handler (after CORS preflight), mirroring the pattern locked in by `mem://constraints/security/test-email-service-role-only` and `…/send-push-service-role-only`:

```ts
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const authHeader = req.headers.get("Authorization") ?? "";
if (authHeader !== `Bearer ${SERVICE_ROLE_KEY}`) {
  return new Response(JSON.stringify({ error: "Forbidden" }), {
    status: 403,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

### 2. `supabase/functions/send-price-alerts/index.ts` — service-role only
Same service-role gate as above. Remove/neutralize the unused `triggerPriceAlert` client helper:
- Delete `triggerPriceAlert`, `useTriggerPriceAlert`, and the `PriceChange` re-exports from `src/services/priceMonitorAPI.ts` (keep subscribe/unsubscribe/status — those are real features). Any future user-triggered price alert must route through a new authed endpoint that internally invokes this fn with service-role.

### 3. `supabase/functions/post-trip-email/index.ts` — JWT auth + ownership from JWT
Replace body-supplied `userId` with JWT-derived user:

```ts
import { parseAuth } from "../_shared/require-auth.ts";
// …
const auth = await parseAuth(req);
if (auth instanceof Response) return auth;
const userId = auth.userId;
const { tripId, forceResend } = await req.json();
// keep existing trip ownership check: trip.user_id !== userId → 403
```

Drop `userId` from `PostTripEmailRequest`. Update `src/services/postTripEmailService.ts::sendPostTripEmail` signature to take only `tripId` (already unused, but keep API consistent).

### 4. Tests / verification
- `curl` each function with no auth and with a user JWT → expect 401/403.
- `curl` `send-trip-reminders` / `send-price-alerts` with `Bearer $SERVICE_ROLE_KEY` → expect 200.
- `curl` `post-trip-email` with a user JWT for a trip the user owns → 200; for a trip they don't own → 403.

### 5. Memory
Append a new memory `mem://constraints/security/cron-email-functions-service-role-only` referencing the 3 functions + the "no user-triggered fallback path" rule, and add a one-liner to `mem://index.md` Core.

## Out of scope
- Other edge functions surfaced in the broader security view (info-level / already-resolved).
- Refactoring cron schedules — only the auth gate changes.
