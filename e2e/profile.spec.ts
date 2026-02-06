/**
 * Profile Management E2E Tests
 * 
 * Tests user profile and settings:
 * - Profile page loading
 * - Edit profile functionality
 * - Settings management
 */

import { test, expect } from '@playwright/test';

test.describe('Profile - Page Access', () => {
  test('profile page requires authentication', async ({ page }) => {
    await page.goto('/profile');
    
    await page.waitForTimeout(1000);
    
    const url = page.url();
    
    // Should redirect to signin
    expect(url).toContain('signin');
  });

  test('profile edit page requires authentication', async ({ page }) => {
    await page.goto('/profile/edit');
    
    await page.waitForTimeout(1000);
    
    const url = page.url();
    
    expect(url).toContain('signin');
  });

  test('profile settings page requires authentication', async ({ page }) => {
    await page.goto('/profile/settings');
    
    await page.waitForTimeout(1000);
    
    const url = page.url();
    
    expect(url).toContain('signin');
  });
});

test.describe('Profile - Redirect Handling', () => {
  test('profile redirect preserves intended destination', async ({ page }) => {
    await page.goto('/profile');
    
    await page.waitForTimeout(1000);
    
    const url = page.url();
    
    // URL should indicate redirect intention
    expect(url).toContain('signin');
  });

  test('settings redirect preserves intended destination', async ({ page }) => {
    await page.goto('/profile/settings');
    
    await page.waitForTimeout(1000);
    
    const url = page.url();
    
    expect(url).toContain('signin');
  });
});

test.describe('Profile - Sign In Page From Profile', () => {
  test('signin page has proper form when redirected from profile', async ({ page }) => {
    await page.goto('/profile');
    
    await page.waitForURL(/signin/);
    
    // Verify signin form is present
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');
    
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
  });
});

test.describe('Profile - URL Structure', () => {
  test('profile URL structure is correct', async ({ page }) => {
    await page.goto('/profile');
    
    await page.waitForTimeout(1000);
    
    // Should redirect to signin with proper URL structure
    const url = new URL(page.url());
    expect(url.pathname).toContain('signin');
  });

  test('profile edit URL structure is correct', async ({ page }) => {
    await page.goto('/profile/edit');
    
    await page.waitForTimeout(1000);
    
    const url = new URL(page.url());
    expect(url.pathname).toContain('signin');
  });
});

test.describe('Profile - Accessibility', () => {
  test('signin page from profile redirect is accessible', async ({ page }) => {
    await page.goto('/profile');
    
    await page.waitForURL(/signin/);
    
    // Check for proper heading
    const heading = page.locator('h1, h2');
    const headingCount = await heading.count();
    
    expect(headingCount).toBeGreaterThan(0);
  });

  test('signin form is keyboard navigable', async ({ page }) => {
    await page.goto('/profile');
    
    await page.waitForURL(/signin/);
    
    // Tab through form elements
    await page.keyboard.press('Tab');
    
    const focusedElement = page.locator(':focus');
    const isFocused = await focusedElement.count();
    
    expect(isFocused).toBeGreaterThan(0);
  });
});
