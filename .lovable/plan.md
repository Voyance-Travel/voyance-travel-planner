# Playwright Stabilization + Invite Contract + New Spec Scaffolding

Three independent slices. None require database migrations except possibly BB2.

---

## Slice 1 — BB1: Playwright config + 6 test fixes

### 1. `playwright.config.ts` (line 34)

The current default already lives on `https://travelwithvoyance.com` (custom domain). Switch the default to the published URL the user specified, keep the `PLAYWRIGHT_BASE_URL` override, and keep the existing inline warning about `id-preview--*.lovable.app`.

```ts
baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://voyance-travel-planner.lovable.app',
```

### 2. `e2e/README.md` — create or replace

Short doc covering: install (`npx playwright install chromium`), run all (`npx playwright test`), run one suite, env override (`PLAYWRIGHT_BASE_URL=http://localhost:8080 npx playwright test`), and the "do not point at id-preview--*.lovable.app" warning mirroring the config comment.

### 3a. `e2e/edge-functions.spec.ts:147` — flights endpoint

Convert to `test.skip(...)` with TODO comment explaining the endpoint was deprecated. (Skip preferred over delete so the intent is recoverable.)

### 3b. `e2e/navigation.spec.ts:16` — **PROMPT IS WRONG, needs adjustment**

The line in question is inside the `for (const route of PUBLIC_ROUTES)` loop. `PUBLIC_ROUTES` includes `/`, `/about`, `/signin`, `/signup`, etc. Flipping to `expect(page.url()).toContain('/signin')` as written would break every non-signin public route.

Real fix: keep the assertion conditional on the route under test.

```ts
if (route === '/signin' || route === '/signup') {
  expect(page.url()).toContain(route);
} else {
  expect(page.url()).not.toContain('signin');
}
```

This satisfies the spirit of the prompt (the `/signin` test was failing because it asserted `not.toContain('signin')` against a URL that legitimately contains 'signin') without breaking the rest of the loop.

### 3c. `e2e/navigation.spec.ts` (signup→signin link, ~line 196)

Scope the locator to the form to avoid strict-mode collision with the nav link:

```ts
await expect(page.locator('form').locator('a[href*="signin"]')).toBeVisible();
```

### 3d / 3e. `e2e/onboard-conversation.spec.ts` (story input + submit button)

`test-results/` doesn't exist locally — I cannot read the failure screenshots. I'll apply role-based selectors as the prompt suggests, which are more robust than the current `page.locator('textarea')` / `button[type="submit"]` chains:

- Story input (line ~32 region, "has story input" test): replace the textarea-count assertion with
  ```ts
  const input = page.getByRole('textbox', { name: /story|adventure|tell|describe|share/i })
    .or(page.getByPlaceholder(/share|tell|story|describe/i))
    .or(page.locator('textarea'));
  expect(await input.count()).toBeGreaterThan(0);
  ```
- Submit button (line ~90 region, "submit button exists and is clickable"): replace the existing `button[type="submit"], button:has-text(...)` chain with
  ```ts
  const submit = page.getByRole('button', { name: /continue|next|submit|create|start|analyze/i });
  expect(await submit.count()).toBeGreaterThan(0);
  ```

Same edits applied to the sibling tests in the file that share these selectors so the suite stays consistent.

### 3f. `e2e/trip-itinerary.spec.ts:83` — mobile nav

Without the failure screenshot, I'll apply a tolerant chained-or selector covering the three common patterns and let the suite tell us which sticks:

```ts
const mobileNav = page.getByRole('button', { name: /menu|navigation/i })
  .or(page.locator('[role="navigation"][aria-label*="mobile" i]'))
  .or(page.locator('[data-testid*="mobile-nav"]'));
```

If this still fails on re-run, paste the actual failure and I'll narrow.

---

## Slice 2 — BB2: Invite-info RPC return contract

The prompt premise was off (`/api/resolve-invite-token` doesn't exist). The correct target is the **`get_trip_invite_info` RPC**, which is what `e2e/critical-paths.spec.ts:136` actually hits (anon-callable, takes `p_token`) and what `src/pages/AcceptInvite.tsx` consumes via `info.valid` and `inviteInfo?.valid`.

`resolve_or_rotate_invite` is a separate owner-only RPC for rotating share links — not in scope for this contract.

### Steps

1. Locate the current `get_trip_invite_info` definition under `supabase/migrations/`. Read every return path.
2. Confirm the contract matches what `AcceptInvite.tsx` and the e2e test expect:
   - Valid token → `{ valid: true, trip_id, role, expires_at, ... }`
   - Invalid / expired / used / soft-deleted token → `{ valid: false, reason: 'TOKEN_NOT_FOUND' | 'TOKEN_EXPIRED' | 'TOKEN_USED' | ... }`
3. If any return path violates the contract (e.g. returns NULL, throws, or omits `valid`), ship a migration replacing the function with one that always returns a JSONB with a boolean `valid`. Auth failures stay as Postgres exceptions / 401 from PostgREST.
4. Audit consumers:
   - `src/pages/AcceptInvite.tsx` — already uses `inviteInfo?.valid` (good); verify the `info.valid` check at line 192 is null-safe.
   - Grep `resolve-invite|get_trip_invite_info|inviteInfo`/`info\.valid` across `src/services`, `src/hooks`, `src/pages` and tighten any `if (data.valid)` to `if (data?.valid === true)`.
5. Verify by re-running `npx playwright test e2e/critical-paths.spec.ts -g "invalid invite token"`. Manual spot-check both valid + invalid tokens through the AcceptInvite UI.

If the RPC already conforms (likely — `AcceptInvite` already consumes `valid` and the test only fails when missing), this slice is a no-op confirmed by re-running the test.

---

## Slice 3 — CC1–CC5: New Playwright spec files (no UI testid wiring)

User confirmed: ship spec files + helpers only. Specs will fail until `data-testid` attributes land in the production UI in a future pass — this is intentional regression scaffolding.

### Helpers — `e2e/fixtures/auth.ts` (new)

Two exports the new specs depend on:

- `signInAsTestUser(page)` — navigates to `/signin`, fills `TEST_USER` credentials from `e2e/fixtures/test-user.ts`, submits, waits for nav off `/signin`. If signin fails (e.g. user doesn't exist in the published env), the helper signs up first then signs in. Documented as best-effort — tests using it will skip rather than hard-fail when auth env isn't configured.
- `generateTrip(page, { destination, days })` — minimal happy-path: navigate to `/plan` (or current trip-builder route), fill required fields, submit, wait for redirect to `/trip/:id`, return the parsed trip id from the URL.

### Spec files — created verbatim from the prompt

- `e2e/dna-pairing.spec.ts` — forbidden-pair check + category-presence check
- `e2e/concierge-notes.spec.ts` — note save → reload → note still visible
- `e2e/budget-propagation.spec.ts` — itinerary sum vs. Budget tab + edit propagation
- `e2e/itinerary-content.spec.ts` — hotel-return rule + phantom-ref guard + checkout < noon
- `e2e/stripe.spec.ts` — **CC5 modified**: only the network-interception idempotency test (S1.2) ships fully. S1.1 (success purchase) and S1.3 (decline) are scaffolded as `test.skip(...)` with TODO comments explaining the Stripe-checkout iframe automation is too flaky and should be replaced with webhook-fixture / network-interception assertions before un-skipping. This matches the user's own fallback recommendation in the prompt.

Each spec file is committed even though most tests will fail today — they form the permanent regression net for the recent audit work.

---

## Out of scope (explicitly deferred)

- Adding the ~15 `data-testid` attributes to DNA reveal, concierge sheet, activity cards, budget tab, credits page, itinerary day cards. Tracked as the next pass.
- S2–S6 of the Stripe checklist (refunds, subscription lifecycle, webhooks, disputes).
- Security batch (Y1/Y2/Y3/Z1–Z4/X1/AA1) — already shipped in prior turns or out of scope for this batch.

## Verification

After implementation:

1. `npx playwright test` — expect BB1 fixes resolve 6 specific failures; new CC specs will fail until testids wired (expected, documented).
2. `npx playwright test e2e/critical-paths.spec.ts -g "invalid invite token"` passes.
3. Manual: open `/invite/<bad-token>` in published env — sees "invite no longer valid" UI cleanly (no white screen / runtime error).
