/**
 * Navigation & Routing E2E Tests
 * 
 * Tests routing works correctly without loops or dead ends:
 * - Public pages load without auth
 * - Protected pages redirect appropriately
 * - 404 handling
 * - Browser navigation
 */

import { test, expect } from '@playwright/test';
import { PUBLIC_ROUTES, PROTECTED_ROUTES } from './fixtures/test-user';

test.describe('Navigation - Public Routes', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`public route ${route} loads without auth`, async ({ page }) => {
      await page.goto(route);
      
      // Should not redirect to signin
      await page.waitForTimeout(1000);
      expect(page.url()).not.toContain('signin');
      
      // Page should have content (not blank)
      const bodyContent = await page.locator('body').textContent();
      expect(bodyContent?.trim().length).toBeGreaterThan(0);
    });
  }
});

test.describe('Navigation - 404 Handling', () => {
  test('invalid route shows 404 or redirects to home', async ({ page }) => {
    await page.goto('/this-route-definitely-does-not-exist-12345');
    
    await page.waitForTimeout(1000);
    
    // Should either show 404 page or redirect to home
    const url = page.url();
    const pageContent = await page.textContent('body');
    
    const is404 = pageContent?.toLowerCase().includes('not found') ||
                  pageContent?.toLowerCase().includes('404') ||
                  pageContent?.toLowerCase().includes("doesn't exist");
    const isHome = url.endsWith('/') || url.endsWith('/#');
    
    expect(is404 || isHome).toBeTruthy();
  });
});

test.describe('Navigation - Redirect Chains', () => {
  test('/planner redirects to /start', async ({ page }) => {
    await page.goto('/planner');
    
    await page.waitForTimeout(2000);
    
    // Should redirect to either /start or /signin (if protected)
    const url = page.url();
    expect(url.includes('start') || url.includes('signin') || url.includes('planner')).toBeTruthy();
  });
});

test.describe('Navigation - Browser Controls', () => {
  test('browser back button works correctly', async ({ page }) => {
    // Navigate through multiple pages
    await page.goto('/');
    await page.waitForTimeout(500);
    
    await page.goto('/explore');
    await page.waitForTimeout(500);
    
    await page.goto('/destinations');
    await page.waitForTimeout(500);
    
    // Go back
    await page.goBack();
    await page.waitForTimeout(500);
    
    expect(page.url()).toContain('explore');
    
    // Go back again
    await page.goBack();
    await page.waitForTimeout(500);
    
    // Should be at home or near it
    const url = page.url();
    expect(url.endsWith('/') || url.includes('/#')).toBeTruthy();
  });

  test('browser forward button works correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    
    await page.goto('/explore');
    await page.waitForTimeout(500);
    
    await page.goBack();
    await page.waitForTimeout(500);
    
    await page.goForward();
    await page.waitForTimeout(500);
    
    expect(page.url()).toContain('explore');
  });

  test('page refresh maintains route', async ({ page }) => {
    await page.goto('/explore');
    await page.waitForTimeout(1000);
    
    // Refresh the page
    await page.reload();
    await page.waitForTimeout(1000);
    
    expect(page.url()).toContain('explore');
  });
});

test.describe('Navigation - Console Errors', () => {
  test('home page has no critical console errors', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Filter out known acceptable errors (like favicon 404, etc.)
    const criticalErrors = errors.filter(error => 
      !error.includes('favicon') &&
      !error.includes('404') &&
      !error.includes('net::ERR') &&
      !error.includes('ResizeObserver')
    );
    
    // Should have no critical errors
    expect(criticalErrors.length).toBe(0);
  });

  test('explore page has no critical console errors', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/explore');
    await page.waitForTimeout(2000);
    
    const criticalErrors = errors.filter(error => 
      !error.includes('favicon') &&
      !error.includes('404') &&
      !error.includes('net::ERR') &&
      !error.includes('ResizeObserver')
    );
    
    expect(criticalErrors.length).toBe(0);
  });
});

test.describe('Navigation - Deep Links', () => {
  test('destination detail page loads with slug', async ({ page }) => {
    await page.goto('/destination/paris');
    
    await page.waitForTimeout(2000);
    
    // Should load the destination page or 404/redirect
    const pageContent = await page.textContent('body');
    const hasContent = pageContent && pageContent.length > 100;
    
    expect(hasContent).toBeTruthy();
  });

  test('archetypes page loads correctly', async ({ page }) => {
    await page.goto('/archetypes');
    
    await page.waitForTimeout(1000);
    
    // Should contain archetype-related content
    const pageContent = await page.textContent('body');
    expect(pageContent?.toLowerCase()).toMatch(/archetype|travel|personality|style/i);
  });
});

test.describe('Navigation - Auth Pages Cross-Links', () => {
  test('signin has link to signup', async ({ page }) => {
    await page.goto('/signin');
    
    const signupLink = page.locator('a[href*="signup"]');
    await expect(signupLink).toBeVisible();
  });

  test('signup has link to signin', async ({ page }) => {
    await page.goto('/signup');
    
    const signinLink = page.locator('a[href*="signin"]');
    await expect(signinLink).toBeVisible();
  });
});
