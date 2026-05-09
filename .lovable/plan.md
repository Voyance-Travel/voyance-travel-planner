# Quiet "Backend API errors at page load"

## What's actually happening

The four console errors are real fetch failures, but every call site already returns a safe fallback (empty list, cached balance). The reason they look like "errors" is that all four sites unconditionally `console.error(...)` on every failure — including transient/expected ones (anonymous user, RLS denial, Functions cold-start, brief network blip). Recent edge logs confirm `trip-notifications` and `get-entitlements` are healthy in production.

So this is a **noise + resilience** problem, not a broken-feature problem. We will:

1. Classify errors into *expected/transient* vs *unexpected*.
2. Downgrade transient ones to `console.warn` (or silence) and only `console.error` for genuinely unexpected failures.
3. Add a single retry with backoff to the 4 affected reads so brief blips self-heal.
4. Keep the existing UI fallbacks (cached credits, empty notifications, empty friend requests) — no UX regressions.
5. Stop firing `reportConnectionFailure()` on a single read miss (it currently inflates the recovery banner counter on every refresh).

No DB changes. No edge function changes. Frontend-only.

## Files & changes

### 1. `src/lib/backendError.ts` (new, ~40 lines)

Single helper used by all four sites:

```ts
export function classifyBackendError(err: unknown): {
  kind: 'transient' | 'auth' | 'rls' | 'unexpected';
  shouldLog: boolean;       // true → console.warn; false → silent
  shouldEscalate: boolean;  // true → console.error + reportConnectionFailure
};
export async function withRetry<T>(fn: () => Promise<T>, opts?: { tries?: number; delayMs?: number }): Promise<T>;
```

Rules:
- `FunctionsFetchError` / `TypeError: Failed to fetch` / status 0/502/503/504 → `transient`, warn-only, retry once.
- 401 / `JWT expired` / `Auth session missing` → `auth`, silent (AuthContext handles).
- Postgres `42501` / `PGRST301` → `rls`, silent (expected for anon).
- Anything else → `unexpected`, escalate.

### 2. `src/services/tripNotificationsAPI.ts`

- `getEdgeFunctionNotifications`: wrap invoke in `withRetry(..., { tries: 2, delayMs: 400 })`. Replace `console.error` with `classifyBackendError`-driven logging. Continue returning `[]` on failure (UI fallback unchanged).
- `getDbNotifications`: same treatment; do NOT log when error code is `42501`/`PGRST301` (expected when not signed in).

### 3. `src/components/common/NotificationBell.tsx` (`usePendingFriendRequests`)

- Wrap the `friendships` select in `withRetry`. Use `classifyBackendError`. Keep `return []` fallback.

### 4. `src/hooks/useCredits.ts`

- In `fetchCredits`, wrap the parallel `Promise.all` in `withRetry` (single retry).
- Only call `reportConnectionFailure()` when `classifyBackendError` returns `unexpected` (today it fires on every error → drives the recovery banner toward its threshold on a routine blip).
- Replace `console.error` with classified logging.

### 5. `src/hooks/useBonusCredits.ts`

- `fetchClaimedBonuses`: same pattern (retry once, classified logging, keep `[]` fallback).

### 6. Memory

Add a one-liner under Core in `mem://index.md` and a small note `mem://constraints/observability/backend-error-noise-policy.md`:

> All page-load reads (notifications, friend requests, credits, bonuses) MUST go through `classifyBackendError` + `withRetry`. Only `unexpected` failures may `console.error` or call `reportConnectionFailure`. Transient/auth/RLS failures stay silent or `warn`.

## Out of scope

- No edge-function changes; logs show they're healthy.
- No changes to RLS, schema, or auth flow.
- No UX changes — the user already sees correct fallback state; the goal is to stop leaking handled errors to the console and to stop those handled errors from inflating the connection-recovery banner counter.

## Verification

- Reload `/` while signed out → console clean (no red errors from these 4 sites).
- Reload `/` while signed in → same; if the edge function genuinely fails twice, a single `console.warn` appears, UI still shows empty notifications.
- Force a 503 on `trip-notifications` (DevTools network override) → one warn, one retry, then warn + empty list. No `reportConnectionFailure` fired.
