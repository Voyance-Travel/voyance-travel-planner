
# Comprehensive End-to-End Testing Plan

## Overview

This plan creates **Playwright E2E tests** that verify critical user flows work correctly - from signup through trip creation to itinerary generation. These tests will catch breaking issues before they reach users.

---

## Test Coverage Matrix

| Flow | Priority | Risk Level | Test Count |
|------|----------|------------|------------|
| Authentication | Critical | High | 12 tests |
| Quiz & Onboarding | Critical | High | 10 tests |
| Trip Planning | Critical | High | 15 tests |
| Itinerary Generation | High | High | 8 tests |
| Edge Functions | High | Medium | 10 tests |
| Navigation & Routing | Medium | Medium | 8 tests |
| Profile Management | Medium | Low | 6 tests |

**Total: 69 E2E tests**

---

## Test Suites to Create

### 1. Authentication Suite (`e2e/auth.spec.ts`)

Tests the complete authentication flow to ensure users can access the app:

- Sign up with valid email/password → redirects to quiz
- Sign up form validates required fields (first name, last name, email, password)
- Sign up shows password strength indicator
- Sign up fails gracefully with invalid email format
- Sign up fails gracefully with weak password (< 8 chars)
- Sign in with valid credentials → redirects to profile
- Sign in fails with invalid credentials → shows error message
- Sign in preserves redirect destination (e.g., `/start` → signin → `/start`)
- Forgot password page loads and accepts email
- Sign out clears session and redirects to home
- Protected routes redirect to signin when not authenticated
- Social login buttons (Google) are present and functional

### 2. Quiz Flow Suite (`e2e/quiz.spec.ts`)

Tests the Travel DNA quiz that personalizes itineraries:

- Quiz intro screen loads with "Begin Discovery" button
- Quiz intro shows credit bonus nudge for new users
- Quiz step 1 renders questions with selectable options
- Multi-select questions allow multiple answers
- Single-select questions replace previous answer
- Progress bar updates as user advances
- Navigation works: back button, step dots
- Quiz completion triggers archetype calculation
- Quiz completion shows personalized result screen
- Skip quiz option exists and warns about consequences

### 3. Onboard Conversation Suite (`e2e/onboard-conversation.spec.ts`)

Tests the alternative "Just Tell Us" onboarding path:

- Intro screen loads with story input prompt
- User can type travel story and submit
- Loading state shows during AI analysis
- Follow-up question appears if confidence is low
- Result screen shows detected archetype
- Confirmation saves to database
- Error states are handled gracefully
- Race condition guard prevents duplicate saves

### 4. Trip Planning Suite (`e2e/trip-planning.spec.ts`)

Tests the `/start` trip creation wizard - the most critical flow:

- Step 1: Destination autocomplete loads and accepts input
- Step 1: Date pickers work and validate (start < end)
- Step 1: Traveler count selection works
- Step 1: Trip type chips are selectable
- Step 1: Budget presets are selectable
- Step 1: Continue button only enabled when required fields filled
- Step 2: Flight section renders (manual entry or import)
- Step 2: Hotel autocomplete works
- Step 2: "Skip hotel" option works
- Step 2: First time visiting checkbox works
- Step 2: Must-do activities textarea accepts input
- Form submission creates trip in database
- After creation, redirects to `/trip/{id}?generate=true`
- Draft limit banner appears when limit reached
- Error handling shows toast on API failure

### 5. Trip Detail & Itinerary Suite (`e2e/trip-itinerary.spec.ts`)

Tests viewing and generating itineraries:

- Trip detail page loads for valid trip ID
- Trip header shows destination, dates, traveler count
- "Generate Itinerary" button triggers generation
- Generation shows progress indicators
- Generated itinerary renders day-by-day view
- Each day shows activities with times
- Editorial view toggle works
- AI Assistant chat panel opens and accepts messages
- Hotel information displays correctly
- Flight information displays correctly

### 6. Edge Function Health Suite (`e2e/edge-functions.spec.ts`)

Tests that critical edge functions respond correctly:

- `generate-itinerary` accepts valid payload and returns 200
- `analyze-preferences` uses correct AI Gateway URL
- `flights` search returns valid response structure
- `hotels` search returns valid response structure
- `spend-credits` deducts correctly for authenticated user
- `create-booking-checkout` creates Stripe session
- `parse-travel-story` returns archetype analysis
- `calculate-travel-dna` computes archetype from quiz answers
- CORS preflight (OPTIONS) returns correct headers
- Invalid auth token returns 401 (not 500)

### 7. Navigation Guard Suite (`e2e/navigation.spec.ts`)

Tests routing works correctly without loops or dead ends:

- Public pages load without auth: `/`, `/explore`, `/destinations`
- Protected pages redirect to signin: `/profile`, `/trip/dashboard`
- 404 page shows for invalid routes
- Redirect chains work: `/planner` → `/start`
- Deep links preserve state after login
- Browser back/forward navigation works
- Page refresh maintains auth state
- No console errors on navigation

### 8. Profile Management Suite (`e2e/profile.spec.ts`)

Tests user profile and settings:

- Profile page loads for authenticated user
- Edit profile form pre-fills current data
- Profile update saves to database
- Settings page shows preferences
- Home airport selection works
- Travel agent mode toggle works

---

## Technical Implementation

### File Structure
```
e2e/
├── auth.spec.ts           # Authentication flows
├── quiz.spec.ts           # Quiz completion flow
├── onboard-conversation.spec.ts  # Story-based onboarding
├── trip-planning.spec.ts  # Trip creation wizard
├── trip-itinerary.spec.ts # Itinerary viewing/generation
├── edge-functions.spec.ts # Backend function health
├── navigation.spec.ts     # Routing guards
├── profile.spec.ts        # Profile management
└── fixtures/
    └── test-user.ts       # Test user credentials helper
```

### Test User Strategy
- Create a dedicated test user during test setup
- Use unique email per test run to avoid conflicts
- Clean up test data after each suite

### Key Testing Patterns

**Page Object Pattern**: Encapsulate selectors for maintainability
```typescript
// Example: SignUpPage
class SignUpPage {
  readonly firstNameInput = page.locator('[data-testid="firstName"]');
  readonly submitButton = page.locator('button[type="submit"]');
}
```

**Wait for Network**: Ensure API calls complete
```typescript
await Promise.all([
  page.waitForResponse(r => r.url().includes('/functions/v1/')),
  page.click('button[type="submit"]')
]);
```

**Visual Assertions**: Screenshot comparison for critical UI
```typescript
await expect(page).toHaveScreenshot('quiz-result.png');
```

---

## Critical Flows Verified

1. **New User Journey**: Home → Sign Up → Quiz → Start Trip → Generate Itinerary
2. **Returning User Journey**: Sign In → Dashboard → View Trip → Modify
3. **Story Onboarding**: Sign Up → "Just Tell Us" → Story Analysis → Profile
4. **Trip Creation**: Start → Destination → Dates → Budget → Create → Generate

---

## Test Data Fixtures

```typescript
// e2e/fixtures/test-user.ts
export const TEST_USER = {
  email: `test-${Date.now()}@voyance-e2e.test`,
  password: 'TestPassword123!',
  firstName: 'E2E',
  lastName: 'Tester'
};

export const TEST_TRIP = {
  destination: 'Paris',
  startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days out
  endDate: new Date(Date.now() + 37 * 24 * 60 * 60 * 1000),   // 7 day trip
  travelers: 2,
  tripType: 'romantic'
};
```

---

## Error Scenarios to Test

| Scenario | Expected Behavior |
|----------|-------------------|
| Network timeout | Toast error, retry button |
| Invalid session | Redirect to signin |
| Edge function 500 | Error toast, fallback UI |
| Database constraint violation | User-friendly error message |
| Rate limit exceeded | "Too many requests" message |
| Empty search results | "No results" placeholder |

---

## Execution Strategy

1. **CI Integration**: Run on every PR
2. **Parallel Execution**: Split suites across workers
3. **Retry Logic**: 2 retries for flaky tests
4. **Screenshot on Failure**: Auto-capture for debugging
5. **Video Recording**: Optional for debugging complex flows

---

## Summary

This plan creates **69 E2E tests** across **8 test suites** covering:
- Complete user journeys from signup to itinerary generation
- Edge function health verification
- Navigation and routing guards
- Error handling and edge cases

Tests will run automatically and catch breaking changes before they impact your users.
