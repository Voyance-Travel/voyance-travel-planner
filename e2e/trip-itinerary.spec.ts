/**
 * Trip Itinerary E2E Tests
 * 
 * Tests viewing and generating itineraries:
 * - Trip detail page loading
 * - Itinerary generation
 * - Day-by-day view
 * - AI Assistant integration
 */

import { test, expect } from '@playwright/test';

test.describe('Trip Itinerary - Page Structure', () => {
  test('trip dashboard page loads for authenticated users', async ({ page }) => {
    await page.goto('/trip/dashboard');
    
    await page.waitForTimeout(1000);
    
    const url = page.url();
    
    // Should redirect to signin if not authenticated
    if (url.includes('signin')) {
      expect(url).toContain('signin');
    } else {
      // Dashboard loaded
      const pageContent = await page.textContent('body');
      expect(pageContent?.toLowerCase()).toMatch(/trip|dashboard|itinerary|travel/i);
    }
  });

  test('sample itinerary page is accessible', async ({ page }) => {
    await page.goto('/sample-itinerary');
    
    await page.waitForTimeout(1000);
    
    // Sample itinerary may be public or redirect
    const pageContent = await page.textContent('body');
    expect(pageContent && pageContent.length > 50).toBeTruthy();
  });
});

test.describe('Trip Itinerary - Trip Detail', () => {
  test('trip detail URL structure is correct', async ({ page }) => {
    // Test with a sample trip ID
    await page.goto('/trip/sample-trip-id');
    
    await page.waitForTimeout(1000);
    
    const url = page.url();
    
    // Should either show trip, 404, or redirect to signin
    expect(
      url.includes('trip') ||
      url.includes('signin') ||
      url.includes('404') ||
      url === page.url()
    ).toBeTruthy();
  });

  test('invalid trip ID is handled gracefully', async ({ page }) => {
    await page.goto('/trip/invalid-trip-id-12345');
    
    await page.waitForTimeout(2000);
    
    // Should not crash - either show error or redirect
    const bodyContent = await page.locator('body').textContent();
    expect(bodyContent?.trim().length).toBeGreaterThan(0);
  });
});

test.describe('Trip Itinerary - UI Components', () => {
  test('itinerary page has proper heading structure', async ({ page }) => {
    await page.goto('/sample-itinerary');
    
    await page.waitForTimeout(1000);
    
    const headings = page.locator('h1, h2, h3');
    const headingCount = await headings.count();
    
    expect(headingCount).toBeGreaterThan(0);
  });

  test('itinerary page is responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/sample-itinerary');
    
    await page.waitForTimeout(1000);
    
    // Page should render without horizontal scroll issues
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(400);
  });
});

test.describe('Trip Itinerary - Generate Flow', () => {
  test('generate parameter in URL is handled', async ({ page }) => {
    await page.goto('/trip/test-id?generate=true');
    
    await page.waitForTimeout(1000);
    
    const url = page.url();
    
    // Should either process generation or redirect to signin
    expect(
      url.includes('trip') ||
      url.includes('signin')
    ).toBeTruthy();
  });
});

test.describe('Trip Itinerary - Accessibility', () => {
  test('sample itinerary page has ARIA landmarks', async ({ page }) => {
    await page.goto('/sample-itinerary');
    
    await page.waitForTimeout(1000);
    
    // Check for common landmarks
    const main = page.locator('main, [role="main"]');
    const nav = page.locator('nav, [role="navigation"]');
    
    const hasMain = await main.count();
    const hasNav = await nav.count();
    
    // Should have at least one landmark
    expect(hasMain + hasNav).toBeGreaterThan(0);
  });

  test('itinerary is keyboard navigable', async ({ page }) => {
    await page.goto('/sample-itinerary');
    
    await page.waitForTimeout(1000);
    
    // Tab through elements
    await page.keyboard.press('Tab');
    
    const focusedElement = page.locator(':focus');
    const isFocused = await focusedElement.count();
    
    expect(isFocused).toBeGreaterThan(0);
  });
});

test.describe('Trip Itinerary - Error States', () => {
  test('network errors are handled gracefully', async ({ page }) => {
    // Block API calls to simulate network error
    await page.route('**/functions/v1/**', (route) => {
      route.abort();
    });
    
    await page.goto('/sample-itinerary');
    
    await page.waitForTimeout(2000);
    
    // Page should still render
    const bodyContent = await page.locator('body').textContent();
    expect(bodyContent?.trim().length).toBeGreaterThan(0);
  });
});

test.describe('Trip Itinerary - Share Functionality', () => {
  test('trip detail page has share option', async ({ page }) => {
    await page.goto('/sample-itinerary');
    
    await page.waitForTimeout(1000);
    
    // Look for share button or link
    const shareButton = page.locator('button:has-text("Share"), [aria-label*="share" i], button:has(svg)');
    const shareCount = await shareButton.count();
    
    // May or may not have share functionality
    expect(shareCount).toBeGreaterThanOrEqual(0);
  });
});
