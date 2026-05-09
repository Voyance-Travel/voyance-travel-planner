## Fix 7.4 — send-contact-email opt-out preference check

Gate the user-confirmation email on `user_preferences.email_notifications`. The support-internal email keeps firing unconditionally.

### Changes

**`supabase/functions/send-contact-email/index.ts`**

1. Extend `ContactRequest` and the destructure to accept an optional `userId?: string`. Read it from `rawBody.userId` (UUID-validated; ignore if malformed).
2. Reuse the existing `supabaseAdmin` pattern (currently created inside `isRateLimited`); lift a single admin client to the handler scope so we don't instantiate twice.
3. Before the confirmation `sendEmail` (lines 178-197), insert the opt-out check:
   - If `userId` present → `select('email_notifications').from('user_preferences').eq('user_id', userId).maybeSingle()`.
   - If `prefs?.email_notifications === false` → set `userOptedOut = true`, log skip, do not send.
   - Anonymous (no `userId`) → always send (explicit opt-in via form submission).
4. Wrap the existing confirmation `sendEmail(...)` in `if (!userOptedOut) { ... }`. Keep the support email send untouched.

**Caller (frontend):** Locate the `supabase.functions.invoke('send-contact-email', ...)` call site and pass `userId: session?.user?.id ?? null` in the body so authenticated submissions are gated. (Will grep for the caller during build.)

### Verify

```
grep -n "user_preferences\|email_notifications" supabase/functions/send-contact-email/index.ts
```
Expected: 2+ hits.

### Notes

- No DB migration needed — `user_preferences.email_notifications` already exists from prior fixes.
- No edge-function redeploy needed beyond standard Lovable auto-deploy.
- Anonymous flow unchanged → no regression for logged-out contact form users.
