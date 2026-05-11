/**
 * Budget Tracker Propagation (CC3)
 *
 * Two regressions guarded:
 *   1. The Budget tab "Trip Expenses" total agrees with the sum of all
 *      activity card prices on the itinerary (within 5% rounding tolerance).
 *   2. Editing an activity cost from the itinerary updates the Budget tab
 *      within a few seconds.
 *
 * Depends on data-testid attributes for budget/itinerary controls.
 */

import { test, expect } from '../playwright-fixture';
import { signInAsTestUser, generateTrip } from './fixtures/auth';

test.describe('Budget Tracker Propagation', () => {
  test('Budget tab Trip Expenses matches sum of itinerary card prices', async ({ page }) => {
    const signedIn = await signInAsTestUser(page);
    test.skip(!signedIn, 'Test user could not sign in (env not configured).');

    const tripId = await generateTrip(page, { destination: 'Tokyo', days: 3 });
    test.skip(!tripId, 'Trip generation could not complete in this environment.');

    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('[data-testid="activity-card-price"]', { timeout: 30_000 });

    const priceElements = await page.locator('[data-testid="activity-card-price"]').all();
    let itineraryTotal = 0;
    for (const el of priceElements) {
      const text = (await el.textContent()) ?? '0';
      itineraryTotal += Number(text.replace(/[^0-9.]/g, '') || '0');
    }

    await page.locator('[data-testid="budget-tab"]').click();
    const tripExpenses =
      (await page.locator('[data-testid="trip-expenses-total"]').textContent()) ?? '0';
    const expensesNum = Number(tripExpenses.replace(/[^0-9.]/g, '') || '0');

    const diff = Math.abs(expensesNum - itineraryTotal);
    const tolerance = Math.max(itineraryTotal * 0.05, 1);
    expect(diff, `Budget ${expensesNum} vs itinerary ${itineraryTotal}`).toBeLessThanOrEqual(tolerance);
  });

  test('editing activity cost updates Budget tab within 5 seconds', async ({ page }) => {
    const signedIn = await signInAsTestUser(page);
    test.skip(!signedIn, 'Test user could not sign in (env not configured).');

    const tripId = await generateTrip(page, { destination: 'Madrid', days: 2 });
    test.skip(!tripId, 'Trip generation could not complete in this environment.');

    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('[data-testid="activity-card"]', { timeout: 30_000 });

    await page.locator('[data-testid="budget-tab"]').click();
    const originalTotal = await page.locator('[data-testid="trip-expenses-total"]').textContent();

    await page.locator('[data-testid="itinerary-tab"]').click();
    await page
      .locator('[data-testid="activity-card"]')
      .first()
      .locator('[data-testid="edit-button"]')
      .click();
    await page.locator('[data-testid="cost-input"]').fill('99.99');
    await page.locator('[data-testid="save-button"]').click();
    await expect(page.getByText(/saved|updated/i)).toBeVisible();

    await page.locator('[data-testid="budget-tab"]').click();
    await page.waitForTimeout(5000);

    const newTotal = await page.locator('[data-testid="trip-expenses-total"]').textContent();
    expect(newTotal).not.toBe(originalTotal);
  });
});
