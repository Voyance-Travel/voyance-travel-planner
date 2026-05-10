## RS.M.P6 — Apple IAP receipt-not-found graceful handling

### Findings
- Two Apple-validation failure paths in `validate-iap-receipt/index.ts`:
  - Line 142–143: sandbox-retry path returns generic 400.
  - Line 146–147: production path returns generic 400.
- Both currently call `errorResponse(...)` from `_shared/cors.ts` which doesn't accept structured fields. Need to switch to `jsonResponse(...)` (already imported) so we can return `{success:false, error, code, userActionable, appleStatus}` plus a 400 status.

### Plan

**1. Add a status-message map** at module scope (top of file, after `IAP_PRODUCTS`):

```ts
// Apple status code → user-friendly message + retryability hint for the FE
const APPLE_STATUS_MESSAGES: Record<number, { msg: string; userActionable: boolean }> = {
  21000: { msg: 'Receipt could not be read by Apple. Please try again.', userActionable: true },
  21002: { msg: 'Receipt data was malformed. Please contact support.', userActionable: false },
  21003: { msg: 'Receipt authentication failed. Please try restoring your purchases.', userActionable: true },
  21004: { msg: 'Shared secret mismatch. Please contact support.', userActionable: false },
  21005: { msg: 'Apple is temporarily unavailable. Please try again in a few minutes.', userActionable: true },
  21006: { msg: 'This subscription has expired.', userActionable: false },
  21007: { msg: 'Sandbox receipt sent to production — should auto-retry.', userActionable: false },
  21008: { msg: 'Production receipt sent to sandbox — should auto-retry.', userActionable: false },
  21010: { msg: 'Apple cannot find this user account. Please contact support.', userActionable: false },
};

function appleStatusError(status: number) {
  const friendly = APPLE_STATUS_MESSAGES[status] || {
    msg: `Apple receipt validation returned status ${status}. Please contact support.`,
    userActionable: false,
  };
  return jsonResponse(
    {
      success: false,
      error: friendly.msg,
      code: `APPLE_STATUS_${status}`,
      userActionable: friendly.userActionable,
      appleStatus: status,
    },
    400,
  );
}
```

**2. Replace both failure returns** (lines 142–143 and 146–147) with `return appleStatusError(<status>);`. Keep the `console.error` log lines for observability.

### Verification
- `grep -c "APPLE_STATUS_MESSAGES\|userActionable" supabase/functions/validate-iap-receipt/index.ts` ≥ 2 (will hit ~5).
- Smoke test isn't possible from the sandbox without a real Apple receipt, but the response shape is unit-checkable: any non-zero `appleResult.status` → 400 with the new payload.

### Out of scope
- Frontend rendering of the `userActionable` flag (separate ticket — backend just returns the contract).
- Status-21006 special handling (auto-mark subscription expired) — out of scope; current ticket is messaging only.
- Changes to `errorResponse` helper — leaving it in place for other callers.