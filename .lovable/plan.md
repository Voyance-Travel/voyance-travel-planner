## Fix 4.1 — IAP receipt validation network retry

`supabase/functions/validate-iap-receipt/index.ts`:

1. Add `fetchWithRetry(url, init, maxAttempts=3)` helper near the top (after imports, before `serve`). Retries on 5xx and thrown network errors with 250ms / 750ms / 2250ms backoff. Apple status-code responses (HTTP 200 + status field) pass through untouched.
2. Replace prod `fetch(appleVerifyUrl, …)` (lines 76–84) with `fetchWithRetry(...)`.
3. Replace sandbox-fallback `fetch('https://sandbox.itunes.apple.com/verifyReceipt', …)` (lines 90–98) with `fetchWithRetry(...)`.

### Verify
```
grep -n "fetchWithRetry" supabase/functions/validate-iap-receipt/index.ts   # 3 hits
```
