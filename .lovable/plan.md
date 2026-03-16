

# Preventing Regressions: A Practical Plan

## The Real Problem

Your `generate-itinerary/index.ts` is **12,322 lines** in a single file. That's why bugs like the `context is not defined` crash happen - it's nearly impossible to reason about variable scope across 12K lines. You fix one thing, and something 4,000 lines away breaks because they silently shared assumptions.

You have good satellite modules (30+ extracted files), but the core orchestration logic - all the action handlers - is still one massive file.

## What To Do (In Priority Order)

### 1. Split the monolith edge function into action handlers

The single biggest win. Each action (`generate-day`, `regenerate-day`, `generate-trip-day`, etc.) becomes its own file with its own clearly-defined inputs. The `index.ts` becomes a thin router:

```text
index.ts (router, ~200 lines)
├── actions/generate-day.ts
├── actions/regenerate-day.ts
├── actions/generate-trip-day.ts
├── actions/enrich.ts
└── actions/... (one per action)
```

Each handler file explicitly declares what variables it needs as function parameters - no more relying on variables that happen to be in scope 6,000 lines above. The `context is not defined` bug would have been **impossible** with this structure because `context` would either be a parameter or a compile error.

### 2. Add edge function smoke tests

You have zero tests for the edge function. Add a test file that calls each action with minimal valid inputs and asserts it doesn't crash. Use the existing `supabase--test_edge_functions` tooling. This catches `ReferenceError` and `TypeError` crashes before they hit users.

### 3. Add a "generation canary" health check

A lightweight scheduled check that generates a 1-day trip for a test user. If it fails, you get notified before real users hit it. This would be a simple edge function that runs the happy path and logs success/failure.

### 4. Improve the error tracker to capture edge function crashes

Your `useErrorTracker` logs client-side errors, but the Day 2 crash happened server-side. The client just saw "generation stalled." Add a check: if polling shows no progress for 60+ seconds, log a `generation_stalled` event with the trip ID and day number so you can correlate with edge function logs.

## What NOT To Do

- Don't add more client-side error handling - you already have good coverage there (GlobalErrorHandler, ErrorBoundary, useErrorTracker, friendlyErrors)
- Don't try to rewrite the generation system - just split the file

## Implementation Approach

**Phase 1** (immediate): Extract each `if (action === '...')` block from `index.ts` into separate handler files. Pure mechanical refactor - no logic changes. Each handler becomes an exported async function that receives the parsed params, auth result, and supabase client.

**Phase 2** (same session): Add basic smoke tests that invoke each action and verify no runtime crashes.

**Phase 3** (follow-up): Add the stall-detection logic to the frontend poller and the generation canary.

### Files to create/modify:
- `supabase/functions/generate-itinerary/actions/generate-day.ts` (extracted from index.ts)
- `supabase/functions/generate-itinerary/actions/regenerate-day.ts`
- `supabase/functions/generate-itinerary/actions/[other actions].ts`
- `supabase/functions/generate-itinerary/index.ts` (shrink to router)
- `supabase/functions/generate-itinerary/index.test.ts` (smoke tests)
- `src/hooks/useItineraryPoller.ts` or equivalent (stall detection)

