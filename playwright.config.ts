import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Voyance E2E Tests
 * 
 * Run tests with: npx playwright test
 * Run specific suite: npx playwright test e2e/auth.spec.ts
 */
export default defineConfig({
  // Look for test files in the e2e directory
  testDir: './e2e',
  
  // Run tests in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry failed tests
  retries: process.env.CI ? 2 : 1,
  
  // Limit parallel workers
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter configuration
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  
  // Shared settings for all projects
  use: {
    // Public published URL — DO NOT change to id-preview--*.lovable.app (auth-gated, breaks suite).
    // Override locally with PLAYWRIGHT_BASE_URL=http://localhost:8080 if needed.
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://voyance-travel-planner.lovable.app',
    
    // Capture screenshot on failure
    screenshot: 'only-on-failure',
    
    // Capture trace on first retry
    trace: 'on-first-retry',
    
    // Timeout for each action
    actionTimeout: 10000,
    
    // Navigation timeout
    navigationTimeout: 30000,
  },
  
  // Global timeout for each test
  timeout: 60000,
  
  // Test projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment for cross-browser testing:
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
    // Mobile viewport testing:
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
  ],
});
