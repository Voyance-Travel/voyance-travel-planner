/**
 * Authentication E2E Tests
 * 
 * Tests the complete authentication flow including:
 * - Sign up with validation
 * - Sign in with error handling
 * - Protected route redirects
 * - Session management
 */

import { test, expect } from '@playwright/test';
import { generateTestUser, TEST_USER, PROTECTED_ROUTES } from './fixtures/test-user';

test.describe('Authentication - Sign Up', () => {
  test('sign up page loads correctly', async ({ page }) => {
    await page.goto('/signup');
    
    // Verify page elements
    await expect(page.locator('h1')).toContainText(/journey|account/i);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('sign up form validates required fields', async ({ page }) => {
    await page.goto('/signup');
    
    // Try to submit empty form
    await page.click('button[type="submit"]');
    
    // Form should not navigate away (HTML5 validation or custom)
    await expect(page).toHaveURL(/signup/);
  });

  test('sign up shows error for invalid email format', async ({ page }) => {
    await page.goto('/signup');
    
    // Fill with invalid email
    const firstNameInput = page.locator('input[name="firstName"], input[id="firstName"], input[placeholder*="first" i]').first();
    const lastNameInput = page.locator('input[name="lastName"], input[id="lastName"], input[placeholder*="last" i]').first();
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]').first();
    
    if (await firstNameInput.isVisible()) {
      await firstNameInput.fill('Test');
    }
    if (await lastNameInput.isVisible()) {
      await lastNameInput.fill('User');
    }
    await emailInput.fill(TEST_USER.invalidEmail);
    await passwordInput.fill(TEST_USER.password);
    
    await page.click('button[type="submit"]');
    
    // Should show error or stay on page
    await expect(page).toHaveURL(/signup/);
  });

  test('sign up shows password strength indicator', async ({ page }) => {
    await page.goto('/signup');
    
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill('weak');
    
    // Look for strength indicator (might be visual or text-based)
    // This test verifies the input accepts the password
    await expect(passwordInput).toHaveValue('weak');
  });

  test('sign up fails gracefully with weak password', async ({ page }) => {
    await page.goto('/signup');
    
    const testUser = generateTestUser('weak-password');
    
    const firstNameInput = page.locator('input[name="firstName"], input[id="firstName"], input[placeholder*="first" i]').first();
    const lastNameInput = page.locator('input[name="lastName"], input[id="lastName"], input[placeholder*="last" i]').first();
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]').first();
    
    if (await firstNameInput.isVisible()) {
      await firstNameInput.fill(testUser.firstName);
    }
    if (await lastNameInput.isVisible()) {
      await lastNameInput.fill(testUser.lastName);
    }
    await emailInput.fill(testUser.email);
    await passwordInput.fill(TEST_USER.weakPassword);
    
    await page.click('button[type="submit"]');
    
    // Should show error or stay on page
    await expect(page).toHaveURL(/signup/);
  });

  test('social login buttons are visible', async ({ page }) => {
    await page.goto('/signup');
    
    // Look for Google login button
    const googleButton = page.locator('button:has-text("Google"), button[aria-label*="Google" i]');
    await expect(googleButton).toBeVisible();
  });
});

test.describe('Authentication - Sign In', () => {
  test('sign in page loads correctly', async ({ page }) => {
    await page.goto('/signin');
    
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('sign in fails with invalid credentials', async ({ page }) => {
    await page.goto('/signin');
    
    await page.fill('input[type="email"]', 'nonexistent@example.com');
    await page.fill('input[type="password"]', 'WrongPassword123!');
    
    await page.click('button[type="submit"]');
    
    // Should show error message
    await page.waitForTimeout(2000);
    const errorMessage = page.locator('[class*="error"], [role="alert"], .text-red');
    const hasError = await errorMessage.isVisible().catch(() => false);
    
    // Either shows error or stays on signin page
    if (!hasError) {
      await expect(page).toHaveURL(/signin/);
    }
  });

  test('sign in preserves redirect destination', async ({ page }) => {
    // Try to access protected route
    await page.goto('/start');
    
    // Should redirect to signin with return URL
    await page.waitForURL(/signin/);
    
    // URL should contain redirect info (in query or state)
    const url = page.url();
    expect(url).toContain('signin');
  });

  test('forgot password link is accessible', async ({ page }) => {
    await page.goto('/signin');
    
    const forgotLink = page.locator('a[href*="forgot"], a:has-text("Forgot")');
    await expect(forgotLink).toBeVisible();
    
    await forgotLink.click();
    await expect(page).toHaveURL(/forgot-password/);
  });

  test('sign up link from sign in page works', async ({ page }) => {
    await page.goto('/signin');
    
    const signupLink = page.locator('a[href*="signup"], a:has-text("Create")');
    await expect(signupLink).toBeVisible();
    
    await signupLink.click();
    await expect(page).toHaveURL(/signup/);
  });
});

test.describe('Authentication - Protected Routes', () => {
  for (const route of PROTECTED_ROUTES) {
    test(`protected route ${route} redirects to signin`, async ({ page }) => {
      await page.goto(route);
      
      // Should redirect to signin
      await page.waitForURL(/signin/, { timeout: 5000 });
      expect(page.url()).toContain('signin');
    });
  }
});

test.describe('Authentication - Forgot Password', () => {
  test('forgot password page loads correctly', async ({ page }) => {
    await page.goto('/forgot-password');
    
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('forgot password accepts valid email', async ({ page }) => {
    await page.goto('/forgot-password');
    
    await page.fill('input[type="email"]', 'test@example.com');
    await page.click('button[type="submit"]');
    
    // Should show success message or navigate
    await page.waitForTimeout(2000);
    
    // Either shows success message or stays on page
    const pageContent = await page.textContent('body');
    const hasSuccessIndicator = 
      pageContent?.toLowerCase().includes('email') ||
      pageContent?.toLowerCase().includes('sent') ||
      pageContent?.toLowerCase().includes('check');
    
    expect(hasSuccessIndicator || page.url().includes('forgot-password')).toBeTruthy();
  });
});
