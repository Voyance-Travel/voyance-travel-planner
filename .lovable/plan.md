## RS.M4 — Split onboarding save error paths

**File:** `src/pages/OnboardConversation.tsx`

The race-condition guard already exists (lines 124–129) and the `try/catch/finally` correctly clears `savingInProgressRef` (line 214). Only the **error reporting** is currently merged into one branch.

### Current (lines 200–205)
```ts
const result = data as { success?: boolean; error?: string } | null;
if (error || !result?.success) {
  console.error('[OnboardConversation] save_onboarding_dna failed', { error, data });
  toast.error('Failed to save your Travel DNA. Please try again.');
  return;
}
```

A single toast hides whether the RPC layer failed (network / auth / function missing) or the function ran and returned `success:false` (DB write rejection inside the SECURITY DEFINER body).

### Change
Replace lines 200–205 with two distinct branches matching the spec:

1. **`error` truthy → RPC layer error.** Log `[OnboardConversation] save_onboarding_dna RPC error` with the error object, toast `Couldn't save your Travel DNA: ${error.message}. Please try again.`, return.
2. **`!result?.success` → DB write inside RPC failed.** Log `[OnboardConversation] save_onboarding_dna returned failure` with the data payload, toast `Save failed: ${result?.error || 'unknown error'}. Please try again.`, return.

The success path (`toast.success` + `navigate`) and the outer `catch (err)` / `finally` (which already clears both flags) stay as-is. The race-condition guard at 124–129 already matches the spec; no changes there.

### Out of scope
- The RPC contract itself (DNA-2 `save_onboarding_dna` atomic 3-table write) — already shipped.
- Refactoring the trait-scoring block (lines 134–176).
- Changing the redirect target on success.

### Verification
- `grep -c "save_onboarding_dna RPC error\|returned failure" src/pages/OnboardConversation.tsx` → ≥ 2.
- Manual: simulating network failure surfaces the RPC-error toast with `error.message`; a `success:false` RPC payload surfaces the in-function failure toast with the function's `error` field.
- The race guard still releases on every exit path (return / throw / success) via the existing `finally`.