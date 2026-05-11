## Diagnosis: Not a route-guard regression

I followed Steps 1–2 from the request and verified ProtectedRoute is wired and working. The Playwright failure has a different root cause.

### Step 1 — guard exists and is wired correctly

- `src/components/layout/ProtectedRoute.tsx` — `if (!isAuthenticated) return <Navigate to={ROUTES.SIGNIN} state={{ from }} replace />` (correct pattern).
- `src/App.tsx` lines 226–261 — every route the failing tests hit IS wrapped:
  - `/profile`, `/profile/edit`, `/profile/settings`, `/profile/credits` — `<ProtectedRoute><…/></ProtectedRoute>`
  - `/start` — wrapped
  - `/trip/dashboard`, `/trip/:tripId`, `/trip/:tripId/active`, etc. — all wrapped
- `AuthContext` resolves `isLoading=false` within ~500ms of mount when there's no session (single retry then bail), with an 8s safety timeout.

### Step 2 — manual verification: redirect works

Hit the live sandbox at `/profile` while unauthenticated → browser landed on `/signin`. ProtectedRoute is doing its job.

### Actual root cause: Playwright is hitting a Lovable-gated URL

`playwright.config.ts` line 34:

```
baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://id-preview--bbef7015-…-7d36d59f8dcd.lovable.app'
```

`curl -I https://id-preview--…lovable.app/profile` returns:

```
302 → https://lovable.dev/auth-bridge?project_id=…&return_url=…/profile
```

Every request to `id-preview--*.lovable.app` is intercepted by Lovable's preview auth-bridge before the SPA loads. Playwright follows the 302, lands on a Lovable login page (no `input[type="email"]`, no `/signin` URL, no `<h1>` matching `/journey|account/i`), and every assertion times out at 5–40 s. That explains the symptom (15 failures across `auth.spec.ts` + `profile.spec.ts`) without any code regression.

### What to change

```text
playwright.config.ts
└── baseURL default → public URL the React app actually serves
```

The project has two publicly reachable origins (no Lovable gate, SPA fallback enabled):

- Published: `https://voyance-travel-planner.lovable.app`
- Custom domain: `https://travelwithvoyance.com`

Switch the default to the published URL (custom domain is fine too — same hosting). CI/local runs that need a different target keep the `PLAYWRIGHT_BASE_URL` env override.

### Plan

1. **`playwright.config.ts`** — change line 34 default from `id-preview--*.lovable.app` to `https://voyance-travel-planner.lovable.app`. Add a one-line comment that `id-preview--*` is auth-gated and must not be used as Playwright's target.

2. **`e2e/README.md` (create or append)** — short note: tests must run against the published URL or a custom domain; never against `id-preview--*.lovable.app`. Override with `PLAYWRIGHT_BASE_URL` for local dev servers.

3. **No app-code changes.** ProtectedRoute, AuthContext, and `App.tsx` route wrapping are correct — leave them alone.

4. **Verify** — re-run `npx playwright test e2e/auth.spec.ts e2e/profile.spec.ts` against the new baseURL. Expect ~25 passing.

5. **Step 5 audit (deferred / quick scan only)** — `grep -rn "useAuth\|useUser" src/pages` to flag any user-state-reading page that's NOT wrapped in `ProtectedRoute` and doesn't gracefully handle null user. Will report findings; not changing wiring unless something obvious appears.

### Out of scope

- The 4 unrelated Supabase security findings shown in the security panel (JWT-claim role check, `trip_intents` collaborator SELECT, `activities`/`transfer-pricing` paid-API auth, `test-email`) — `test-email` was already fixed earlier this turn; the others are separate work.
