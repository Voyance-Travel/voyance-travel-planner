# Why the AI Concierge says "Invalid token"

`src/hooks/useActivityConcierge.ts` calls the `activity-concierge` edge function with a hand-rolled `fetch`. It sends:

```ts
Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
```

The edge function (`supabase/functions/activity-concierge/index.ts:133`) then does:

```ts
const { data: { user }, error } = await authClient.auth.getUser(token);
if (authError || !user) return 401 "Invalid token";
```

`auth.getUser()` expects a **user JWT**, not the project's publishable/anon key. With Supabase's new signing-keys flow this is strictly rejected — historically it silently returned `user=null`, the function probably worked when auth wasn't gated, and recent backend pinning now surfaces the 401. Result: every concierge request fails with the literal string "Invalid token", which the hook bubbles into the chat bubble as "Sorry, I couldn't process that request. Invalid token".

Two other call sites have the same anti-pattern and will trip the same way once their edge functions tighten auth:

- `src/utils/quizMapping.ts:517`
- `src/pages/OnboardConversation.tsx:70`

# Fix

## 1. Send the user's real session token in the concierge fetch

In `src/hooks/useActivityConcierge.ts`, before the `fetch`:

```ts
import { supabase } from '@/integrations/supabase/client';
const { data: { session } } = await supabase.auth.getSession();
if (!session?.access_token) {
  // Surface "Sign in to use the concierge" instead of a confusing error,
  // and short-circuit before we burn a network round-trip.
}
Authorization: `Bearer ${session.access_token}`
```

When `session` is null, render an assistant bubble that says the user must be signed in instead of throwing.

## 2. Apply the same fix to the other two leak sites

Same change in `quizMapping.ts:517` and `OnboardConversation.tsx:70` — read the session once and send `access_token`. These are user-scoped endpoints and would 401 next time their auth gets tightened; better to fix all three in one pass than wait for the next user report.

## 3. Add a memory entry

`mem://constraints/security/edge-fn-bearer-must-be-user-jwt` — short rule: client fetches to authed edge functions MUST send `session.access_token`, never `VITE_SUPABASE_PUBLISHABLE_KEY`, because the gateway and our `parseAuth` / `auth.getUser` paths both validate the JWT against the user. Use `supabase.functions.invoke()` when possible (it threads the session automatically); when a hand-rolled `fetch` is required for streaming, pull `session.access_token` first.

## Out of scope

- Refactoring the streaming `fetch` to `supabase.functions.invoke()`. Possible later but unnecessary for the fix.
- Changing the edge function — the function is correct; the client is the bug.
- Re-touching the destination-images / hero-image work from the prior turn.

# Verification after build

1. Open any activity card → AI Concierge → ask a question. Expect a streamed reply, no "Invalid token".
2. Sign out → open concierge → expect the friendly "sign in" message, no network call.
3. Quiz mapping + onboarding conversation flows still work end-to-end signed in.
