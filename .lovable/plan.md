

# Comprehensive Trip Path & Feature Smoke Testing Strategy

## Current State

You have **~100 edge functions**, a **11,400-line monolith** (`generate-itinerary/index.ts`) with ~15 action handlers, and existing E2E tests that are mostly shallow page-load checks. Your tests don't actually exercise the generation pipeline, multi-city logic, or any edge function beyond CORS checks.

## What Breaks And Why

The recent Day 2 crash was a **server-side** `ReferenceError` invisible to all existing tests. Your E2E tests never call the generation pipeline with real parameters. Your unit tests don't test the edge function at all. There's no automated way to catch "variable undefined in a code path that only runs for Day 2+."

## The Plan: Three Layers of Protection

### Layer 1: Edge Function Smoke Tests (catches crashes like the Day 2 bug)

**File**: `supabase/functions/generate-itinerary/index.test.ts`

Test each action handler with minimal valid inputs via the deployed function. These aren't full integration tests — they just verify the function doesn't crash with a `ReferenceError`/`TypeError`.

Actions to test:
- `get-trip` — needs a valid tripId
- `save-itinerary` — needs tripId + minimal data
- `get-itinerary` — needs tripId
- `generate-trip` — needs tripId, destination, dates (the entry point)
- `generate-day` — needs tripId, dayNumber, date, destination (this is what broke)
- `regenerate-day` — same params as generate-day
- `generate-trip-day` — the chained call (Day 2+)
- `toggle-activity-lock`, `sync-itinerary-tables`, `repair-trip-costs`

Each test: POST with minimal body → assert status is not 500. A 400 or 401 is fine — it means the code parsed without crashing.

### Layer 2: Critical Path E2E Tests (catches UI/flow breaks)

**File**: `e2e/critical-paths.spec.ts`

Test the actual user journeys that matter:

1. **Quiz → Trip Creation**: Complete quiz, verify trip record created
2. **Single-city generation start**: Create trip, hit generate, verify polling starts and Day 1 appears
3. **Multi-city generation start**: Create multi-city trip, verify journey split + first leg starts
4. **Trip dashboard**: Verify trips list loads, shows correct statuses
5. **Itinerary view**: Load a completed trip, verify all days render with activities
6. **Day regeneration**: Trigger regenerate on a day, verify it completes
7. **Collaboration invite flow**: Generate invite link, verify token resolves

These require an authenticated test user. We'll create a test fixture that logs in via the auth API.

### Layer 3: Generation Canary (catches regressions in production)

**File**: `supabase/functions/generation-canary/index.ts`

A lightweight edge function that:
1. Creates a 2-day test trip for a canary user
2. Calls `generate-trip` action
3. Polls until complete or timeout (3 min)
4. Logs success/failure to a `canary_runs` table
5. Cleans up the test trip

Can be invoked manually or on a schedule. If it fails, you know the pipeline is broken before real users hit it.

### Supporting Changes

**File**: `src/hooks/useGenerationPoller.ts`
- Already has stall detection (added in last session) — no changes needed.

**File**: `e2e/fixtures/test-user.ts`
- Add authenticated session helper using `supabase.auth.signInWithPassword()`

## Implementation Order

1. **Edge function smoke tests** — highest value, catches the exact class of bug you just hit
2. **Generation canary** — catches pipeline breaks in deployed environment
3. **Critical path E2E tests** — catches UI flow breaks

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/generate-itinerary/index.test.ts` | Create — smoke tests for all actions |
| `e2e/critical-paths.spec.ts` | Create — authenticated user journey tests |
| `e2e/fixtures/test-user.ts` | Update — add auth login helper |
| `supabase/functions/generation-canary/index.ts` | Create — automated pipeline health check |

