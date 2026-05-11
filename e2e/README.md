# Voyance E2E Tests

Run with: `npx playwright test`

## Target URL

Tests must run against a **publicly reachable** origin where the React SPA actually serves:

- ✅ Published: `https://voyance-travel-planner.lovable.app` (default)
- ✅ Custom domain: `https://travelwithvoyance.com`
- ✅ Local dev: `http://localhost:8080` (set `PLAYWRIGHT_BASE_URL`)

## Do NOT target `id-preview--*.lovable.app`

That origin is gated by Lovable's auth-bridge: every request 302-redirects to
`lovable.dev/auth-bridge`, so Playwright follows the redirect, never loads the
SPA, and every assertion times out (5–40 s). This produced a false-positive
"protected routes don't redirect" regression in the past — the routes were
fine, the test target was wrong.

## Override

```bash
PLAYWRIGHT_BASE_URL=http://localhost:8080 npx playwright test e2e/auth.spec.ts
```
