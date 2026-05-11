/**
 * DNA Pairing Coherence (CC1)
 *
 * Regression net for the DNA system overhaul:
 *   - Forbidden archetype pairs must never appear together
 *   - Primary + secondary categories should both render
 *
 * Depends on data-testid attributes on the DNA reveal page:
 *   [data-testid="dna-primary-archetype"]
 *   [data-testid="dna-secondary-archetype"]
 *   [data-testid="dna-primary-category"]
 *   [data-testid="dna-secondary-category"]
 *
 * These will be wired in a follow-up pass; until then this spec will fail and
 * surface as a TODO in the suite report.
 */

import { test, expect } from '../playwright-fixture';
import { signInAsTestUser } from './fixtures/auth';

const FORBIDDEN_PAIRS: Array<[string, string]> = [
  ['Sanctuary Seeker', 'Adrenaline Architect'],
  ['Sanctuary Seeker', 'Bucket List Conqueror'],
  ['Zen Seeker', 'Bucket List Conqueror'],
  ['Slow Traveler', 'Bucket List Conqueror'],
  ['Retreat Regular', 'Adrenaline Architect'],
  ['Escape Artist', 'Social Butterfly'],
  ['Healing Journeyer', 'Adrenaline Architect'],
];

test.describe('DNA Pairing Coherence', () => {
  test('forbidden archetype pairs never appear together in the same DNA profile', async ({ page }) => {
    const signedIn = await signInAsTestUser(page);
    test.skip(!signedIn, 'Test user could not sign in (env not configured).');

    await page.goto('/profile/dna');
    await page.waitForLoadState('domcontentloaded');

    const primary = (await page.locator('[data-testid="dna-primary-archetype"]').textContent()) ?? '';
    const secondary = (await page.locator('[data-testid="dna-secondary-archetype"]').textContent()) ?? '';

    for (const [a, b] of FORBIDDEN_PAIRS) {
      const isForbidden =
        (primary.includes(a) && secondary.includes(b)) ||
        (primary.includes(b) && secondary.includes(a));
      expect(isForbidden, `Forbidden pair: ${a} + ${b} (got ${primary} / ${secondary})`).toBe(false);
    }
  });

  test('primary and secondary categories both render', async ({ page }) => {
    const signedIn = await signInAsTestUser(page);
    test.skip(!signedIn, 'Test user could not sign in (env not configured).');

    await page.goto('/profile/dna');
    await page.waitForLoadState('domcontentloaded');

    const primaryCategory = (await page.locator('[data-testid="dna-primary-category"]').textContent()) ?? '';
    const secondaryCategory = (await page.locator('[data-testid="dna-secondary-category"]').textContent()) ?? '';

    expect(primaryCategory.trim().length).toBeGreaterThan(0);
    expect(secondaryCategory.trim().length).toBeGreaterThan(0);
  });
});
