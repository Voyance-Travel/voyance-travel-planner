## Fix 3.1 — Push 410 token cleanup

Update `supabase/functions/send-push/index.ts` to detect APNs dead-token signals and delete them from `push_tokens`.

### Changes

**1. Extend `PushResult` interface** (lines 101–107)
Add optional `shouldDeleteToken?: boolean` field.

**2. Update `sendApns` error branch** (lines 154–156)
After logging the APNs error, set `shouldDeleteToken = true` when:
- `res.status === 410` (any reason)
- `res.status === 400` AND parsed JSON body `reason` is `BadDeviceToken` or `Unregistered`

Return the flag on the `PushResult`.

**3. Cleanup pass in main handler** (lines 244–251)
After tallying `sent`/`failed`:
- Collect `deadTokens = results.filter(r => r.shouldDeleteToken).map(r => r.token)`
- If non-empty, create a service-role Supabase client and run `.from('push_tokens').delete({ count: 'exact' }).in('token', deadTokens)`
- Log `Deleted N dead tokens`; swallow errors (log only — don't fail the response)
- Include `deleted` in the JSON response and the final summary log

### Notes
- `createClient` is already imported at the top.
- Cleanup is idempotent — re-deleting an already-deleted token is a no-op.
- No DB schema or other file changes required.

### Verification
```
grep -n "shouldDeleteToken" supabase/functions/send-push/index.ts        # 3+ hits
grep -n "push_tokens" supabase/functions/send-push/index.ts              # includes .delete().in('token', ...)
```
