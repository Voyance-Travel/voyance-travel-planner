/**
 * Itinerary Content Coherence (CC4)
 *
 * Three regressions guarded:
 *   1. Every non-departure day ends with hotel return / freshen up / stay-at-hotel.
 *   2. Activity descriptions never reference events that aren't actually scheduled
 *      ("tonight's dinner" with no dinner card; "tomorrow's flight" on a non-departure day).
 *   3. Departure-day checkout time is at or before noon.
 *
 * Depends on data-testid attributes for day-card / activity-card / activity-title /
 * activity-description / activity-start-time. Spec will skip cleanly when sign-in
 * or trip generation can't complete.
 */

import { test, expect } from '../playwright-fixture';
import { signInAsTestUser, generateTrip } from './fixtures/auth';

test.describe('Itinerary Content Coherence', () => {
  test('every non-departure day ends with hotel return or at-hotel activity', async ({ page }) => {
    const signedIn = await signInAsTestUser(page);
    test.skip(!signedIn, 'Test user could not sign in (env not configured).');

    const tripId = await generateTrip(page, { destination: 'Paris', days: 3 });
    test.skip(!tripId, 'Trip generation could not complete in this environment.');

    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('[data-testid="day-card"]', { timeout: 30_000 });

    const days = await page.locator('[data-testid="day-card"]').all();

    for (let i = 0; i < days.length - 1; i++) {
      const activities = await days[i].locator('[data-testid="activity-card"]').all();
      if (activities.length === 0) continue;
      const last = activities[activities.length - 1];
      const lastTitle = ((await last.locator('[data-testid="activity-title"]').textContent()) ?? '').toLowerCase();

      const endsAtHotel =
        lastTitle.includes('return to') ||
        lastTitle.includes('hotel') ||
        lastTitle.includes('freshen up');

      expect(endsAtHotel, `Day ${i + 1} doesn't end at hotel: "${lastTitle}"`).toBe(true);
    }
  });

  test('activity descriptions never reference events not in the schedule', async ({ page }) => {
    const signedIn = await signInAsTestUser(page);
    test.skip(!signedIn, 'Test user could not sign in (env not configured).');

    const tripId = await generateTrip(page, { destination: 'Madrid', days: 3 });
    test.skip(!tripId, 'Trip generation could not complete in this environment.');

    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('[data-testid="day-card"]', { timeout: 30_000 });

    const days = await page.locator('[data-testid="day-card"]').all();

    for (let i = 0; i < days.length; i++) {
      const activities = await days[i].locator('[data-testid="activity-card"]').all();

      const titles = (
        await Promise.all(
          activities.map((a) => a.locator('[data-testid="activity-title"]').textContent())
        )
      )
        .join(' ')
        .toLowerCase();

      const descriptions = await Promise.all(
        activities.map((a) => a.locator('[data-testid="activity-description"]').textContent())
      );

      for (const desc of descriptions) {
        const descLower = (desc ?? '').toLowerCase();

        if (/tonight'?s?\s+(michelin|dinner|meal)/i.test(descLower)) {
          expect(titles, `Day ${i + 1} mentions tonight's dinner but has none`).toMatch(
            /dinner|restaurant|trattoria|bistro|osteria/i
          );
        }

        if (i < days.length - 1) {
          expect(
            descLower,
            `Day ${i + 1} mentions tomorrow's flight but isn't the departure day`
          ).not.toMatch(/tomorrow'?s?\s+(flight|airport|departure)/i);
        }
      }
    }
  });

  test('departure-day checkout time is before noon', async ({ page }) => {
    const signedIn = await signInAsTestUser(page);
    test.skip(!signedIn, 'Test user could not sign in (env not configured).');

    const tripId = await generateTrip(page, { destination: 'Florence', days: 3 });
    test.skip(!tripId, 'Trip generation could not complete in this environment.');

    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('[data-testid="day-card"]', { timeout: 30_000 });

    const days = await page.locator('[data-testid="day-card"]').all();
    const lastDay = days[days.length - 1];

    const checkoutActivity = lastDay
      .locator('[data-testid="activity-card"]')
      .filter({ hasText: /checkout/i });
    const checkoutTimeText = await checkoutActivity
      .locator('[data-testid="activity-start-time"]')
      .first()
      .textContent();

    const match = checkoutTimeText?.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
    expect(match, `Could not parse checkout time: "${checkoutTimeText}"`).toBeTruthy();

    let hours = Number(match![1]);
    const isPm = /pm/i.test(match![3] ?? '');
    if (isPm && hours < 12) hours += 12;
    if (!isPm && hours === 12) hours = 0;

    expect(hours, `Checkout at ${hours}:00 — must be ≤ 11:59`).toBeLessThanOrEqual(11);
  });
});
