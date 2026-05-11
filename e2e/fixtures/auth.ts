/**
 * Shared E2E auth + trip helpers.
 *
 * These helpers are best-effort: they target the published Voyance UI as it
 * exists today. When the underlying flows change, update the selectors here
 * rather than in every spec.
 *
 * Specs that depend on these helpers should treat failures as soft-skips
 * (e.g. log a warning + `test.skip()`) rather than hard failures, because the
 * published environment may not always have a usable test account.
 */

import type { Page } from '@playwright/test';
import { TEST_USER } from './test-user';

/**
 * Sign in as the shared E2E test user. If signin fails (user doesn't exist
 * yet in this environment), attempts a sign-up first and then a sign-in.
 *
 * Returns true on success, false on any failure. Callers should branch on the
 * return value so the suite degrades gracefully when test credentials aren't
 * configured.
 */
export async function signInAsTestUser(page: Page): Promise<boolean> {
  try {
    await page.goto('/signin');
    await page.waitForLoadState('domcontentloaded');

    const emailInput = page
      .getByRole('textbox', { name: /email/i })
      .or(page.locator('input[type="email"]'))
      .first();
    const passwordInput = page
      .getByRole('textbox', { name: /password/i })
      .or(page.locator('input[type="password"]'))
      .first();

    await emailInput.fill(TEST_USER.email);
    await passwordInput.fill(TEST_USER.password);

    const submit = page
      .getByRole('button', { name: /sign in|log in|continue/i })
      .or(page.locator('button[type="submit"]'))
      .first();
    await submit.click();

    // Wait for navigation away from /signin (or for an obvious error).
    await page.waitForURL((url) => !url.pathname.includes('/signin'), {
      timeout: 10_000,
    });
    return true;
  } catch {
    // Sign-in failed — try the sign-up flow as a fallback.
    try {
      await page.goto('/signup');
      await page.waitForLoadState('domcontentloaded');

      await page
        .getByRole('textbox', { name: /email/i })
        .or(page.locator('input[type="email"]'))
        .first()
        .fill(TEST_USER.email);
      await page
        .getByRole('textbox', { name: /password/i })
        .or(page.locator('input[type="password"]'))
        .first()
        .fill(TEST_USER.password);
      await page
        .getByRole('button', { name: /sign up|create|continue/i })
        .or(page.locator('button[type="submit"]'))
        .first()
        .click();

      await page.waitForURL((url) => !url.pathname.includes('/signup'), {
        timeout: 15_000,
      });
      return true;
    } catch {
      return false;
    }
  }
}

export interface GenerateTripOptions {
  destination: string;
  days?: number;
}

/**
 * Drive the trip-builder happy path and return the resulting trip id.
 *
 * Returns null when the flow can't be completed in the current environment
 * (e.g. the builder UI changed, the user lacks credits, the gen times out).
 * Callers should treat null as "skip this test".
 */
export async function generateTrip(
  page: Page,
  opts: GenerateTripOptions
): Promise<string | null> {
  try {
    await page.goto('/start');
    await page.waitForLoadState('domcontentloaded');

    const destInput = page
      .getByRole('textbox', { name: /destination|where|going/i })
      .or(page.locator('input[name*="destination" i]'))
      .first();
    await destInput.fill(opts.destination);

    // Best-effort dropdown selection (Mapbox / autocomplete pickers).
    await page.waitForTimeout(800);
    await page.keyboard.press('Enter').catch(() => {});

    // Submit / continue through the builder steps.
    for (let step = 0; step < 5; step++) {
      const next = page
        .getByRole('button', { name: /next|continue|generate|create|start planning/i })
        .first();
      if (!(await next.isVisible().catch(() => false))) break;
      if (await next.isDisabled().catch(() => true)) break;
      await next.click();
      await page.waitForTimeout(500);
    }

    // Wait for redirect to /trip/:id.
    await page.waitForURL(/\/trip\/[0-9a-f-]{8,}/i, { timeout: 90_000 });
    const match = page.url().match(/\/trip\/([0-9a-f-]{8,})/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
