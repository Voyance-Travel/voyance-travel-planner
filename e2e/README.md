# Playwright E2E Tests

End-to-end browser tests for Voyance, run against a publicly reachable origin.

## Running

```bash
npx playwright install chromium   # one-time, installs the browser
npx playwright test               # run the full suite
npx playwright test e2e/auth.spec.ts   # run a single suite
npx playwright test --grep "invalid invite"  # run by name
```

HTML report (after a run):

```bash
npx playwright show-report
```

## Base URL

The default target is the published URL:

```
https://voyance-travel-planner.lovable.app
```

Override with an env var to point at a local dev server, a preview deploy, or
the custom domain:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:8080 npx playwright test
PLAYWRIGHT_BASE_URL=https://travelwithvoyance.com npx playwright test
```

### ⚠️ Do NOT use `id-preview--*.lovable.app`

That origin is gated by Lovable's auth-bridge (302 → `lovable.dev/auth-bridge`),
so the SPA never loads and every assertion times out. Use the published URL,
the custom domain, or a local dev server.

## Layout

```
e2e/
  fixtures/         # shared test data + helpers (auth, test users, sample trips)
  *.spec.ts         # one suite per concern (auth, navigation, trip-itinerary, …)
```

## Writing tests

- Prefer `page.getByRole(...)` / `page.getByPlaceholder(...)` over CSS selectors —
  they survive markup churn better.
- For form-scoped links/buttons that collide with nav links, scope the locator
  (`page.locator('form').locator('a[href*="signin"]')`) to avoid strict-mode errors.
- Cross-page flows that depend on auth should use the helpers in
  `fixtures/auth.ts` and skip cleanly when test credentials aren't available.

Some new specs (`dna-pairing`, `concierge-notes`, `budget-propagation`,
`itinerary-content`, `stripe`) depend on `data-testid` attributes that are still
being wired into the production UI. Those specs may fail today — they form the
regression net for in-progress work and will pass once the testids land.
