/**
 * AI Concierge Note Persistence (CC2)
 *
 * A note saved on an activity card via the concierge sheet must persist
 * across a full page reload. Closes the regression where the in-memory
 * note state was lost on refresh.
 *
 * Depends on data-testid attributes on the activity card + concierge sheet.
 * Skip cleanly if signin or trip generation fails in this environment.
 */

import { test, expect } from '../playwright-fixture';
import { signInAsTestUser, generateTrip } from './fixtures/auth';

test.describe('AI Concierge Note Persistence', () => {
  test('saved note persists after closing concierge and reloading', async ({ page }) => {
    const signedIn = await signInAsTestUser(page);
    test.skip(!signedIn, 'Test user could not sign in (env not configured).');

    const tripId = await generateTrip(page, { destination: 'Lisbon', days: 3 });
    test.skip(!tripId, 'Trip generation could not complete in this environment.');

    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('[data-testid="activity-card"]', { timeout: 30_000 });

    // Open concierge on first activity
    await page
      .locator('[data-testid="activity-card"]')
      .first()
      .locator('[data-testid="concierge-button"]')
      .click();

    await expect(page.locator('[data-testid="concierge-sheet"]')).toBeVisible();
    await page.waitForSelector('[data-testid="concierge-tip"]', { timeout: 30_000 });

    // Save tip as note
    await page.locator('[data-testid="save-tip-as-note"]').click();
    await expect(page.getByText(/saved|note added/i)).toBeVisible();

    // Close + reload to confirm DB persistence
    await page.locator('[data-testid="concierge-close"]').click();
    await page.reload();
    await page.waitForSelector('[data-testid="activity-card"]');

    // Reopen concierge on same activity
    await page
      .locator('[data-testid="activity-card"]')
      .first()
      .locator('[data-testid="concierge-button"]')
      .click();

    const savedNotes = page.locator('[data-testid="saved-note"]');
    expect(await savedNotes.count()).toBeGreaterThan(0);
  });
});
