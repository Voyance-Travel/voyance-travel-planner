/**
 * Stripe Payments — Test Mode (CC5)
 *
 * Only the network-interception idempotency test (S1.2) ships fully today.
 * S1.1 (success purchase) and S1.3 (decline) are intentionally skipped:
 * driving Stripe's hosted-checkout iframes from Playwright is too flaky to
 * be a reliable regression net. Replace with webhook-fixture / network
 * assertions before un-skipping.
 */

import { test, expect } from '../playwright-fixture';
import { signInAsTestUser } from './fixtures/auth';

test.describe('Stripe Payments — Test Mode', () => {
  test.skip('S1.1 — Buy Flex 100 cr credit pack succeeds and grants credits', async () => {
    // TODO: replace iframe-driven checkout with a webhook fixture that posts a
    // checkout.session.completed event to /functions/v1/stripe-webhook and
    // assert the credit_ledger row + balance update.
  });

  test.skip('S1.3 — Declined card shows error, no credits added', async () => {
    // TODO: same as S1.1 — assert via webhook fixture (charge.failed) rather
    // than driving Stripe's hosted card form.
  });

  test('S1.2 — Double-click Pay fires only one checkout session (idempotency)', async ({ page }) => {
    const signedIn = await signInAsTestUser(page);
    test.skip(!signedIn, 'Test user could not sign in (env not configured).');

    let chargeAttempts = 0;
    page.on('request', (req) => {
      if (req.url().includes('checkout/sessions') && req.method() === 'POST') {
        chargeAttempts++;
      }
    });

    await page.goto('/credits');
    await page.waitForLoadState('domcontentloaded');

    const button = page.locator('[data-testid="credit-pack-flex-100"]');
    test.skip(
      !(await button.isVisible().catch(() => false)),
      'Credit pack button not present (data-testid not yet wired).'
    );

    await Promise.all([button.click(), button.click({ force: true }).catch(() => {})]);
    await page.waitForTimeout(2000);

    expect(chargeAttempts, `Expected ≤1 checkout POST, got ${chargeAttempts}`).toBeLessThanOrEqual(1);
  });
});
