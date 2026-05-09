## Fix 4 — Await `updateUser` profile upsert

### Verified
- `AuthContext.tsx:600` defines `updateUser` as a **synchronous** function (return type `void`, not `Promise<void>` as the brief claimed). Interface line 45: `updateUser: (updates: Partial<User>) => void;`
- The Supabase upsert at lines 616–623 is a fire-and-forget `.then()` chain. Errors only `console.error`; no caller can react.
- Only one in-app caller: `src/pages/ProfileEdit.tsx:31` — `updateUser({ name: data.name.trim() })` inside an already-`async` submit handler. (All other matches in the codebase are `supabase.auth.updateUser`, unrelated.)
- `ProfileEdit` already persists name via `updateProfile()` (line 22) before calling `updateUser`, so the AuthContext upsert is a redundant DB write — but it should still surface failures rather than swallow them.

### Changes

**1. `src/contexts/AuthContext.tsx` — make `updateUser` async and propagate errors**

- Interface (line 45): change to `updateUser: (updates: Partial<User>) => Promise<void>;`
- Implementation (lines 600–626): change signature to `const updateUser = async (updates: Partial<User>): Promise<void> => { … }`
- Convert the `.then()` block to `await … upsert(…)`; on error, `console.error` AND `throw error` so the caller's catch can show a toast / surface UI feedback.
- Keep early-`return`s for invalid name/email and the optimistic `setUser({ ...user, ...updates })` exactly as today — local state still updates immediately for snappy UI; only the DB sync becomes awaitable.

**2. `src/pages/ProfileEdit.tsx` — await the call**

Line 31: `await updateUser({ name: data.name.trim() });`
The handler is already `async`, so this is a one-token change. If the upsert throws, the existing `await updateProfile(...)` already succeeded (it's the canonical write), so propagating the error here mostly just blocks the `navigate` and lets any wrapping toast/error UI react. Acceptable — failure here implies a real auth/session problem worth surfacing.

### Out of scope
- No change to `updateProfile()` service or the `profiles` schema.
- No new validation, no new fields written.
- Other `supabase.auth.updateUser` call sites (Settings, ResetPassword, voyanceAuth, accountManagementAPI) are unrelated — they call the Supabase auth API directly, not our context method.

### Validation
1. Edit name in `/profile/edit` → save. Network tab shows `profiles` upsert completes before navigate. No regression.
2. Simulate failure (offline / RLS denial) → `updateProfile` likely also fails first; if it succeeds but the AuthContext upsert fails, an error is now thrown and bubbles up rather than being silently swallowed.
3. TypeScript: every other call site of `updateUser` in the codebase — there are none beyond `ProfileEdit.tsx` — so the interface change only requires the one `await`.
