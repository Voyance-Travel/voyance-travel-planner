## Fix 4.3 — Bundle ID env-driven

**File:** `supabase/functions/send-push/index.ts` (line 121)

Replace the hardcoded literal with an env lookup that falls back to the current value:

```ts
const bundleId = Deno.env.get('APNS_BUNDLE_ID') ?? 'app.lovable.bbef7015a2df45af893d7d36d59f8dcd';
```

After the edit, add the `APNS_BUNDLE_ID` secret via the secrets tool (value: `app.lovable.bbef7015a2df45af893d7d36d59f8dcd`, or the production bundle ID if different) so prod doesn't rely on the inline fallback.

**Verify:** `grep -n "APNS_BUNDLE_ID\|bundleId" supabase/functions/send-push/index.ts` — bundleId line uses `Deno.env.get('APNS_BUNDLE_ID')`.