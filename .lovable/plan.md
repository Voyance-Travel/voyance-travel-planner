

# Fix: Initial Generation Timeout on Long Trips

## Problem

The `generate-full` action in `generate-itinerary` processes ALL days in a single edge function call. For a 16-day trip, this takes ~55 seconds, hitting the Deno edge runtime wall clock limit. When the runtime kills the function, no response (including CORS headers) is returned, causing the browser to report a CORS error.

The **regeneration** flow was already fixed to use day-by-day calls. The **initial generation** in `useItineraryGeneration.ts` still uses the monolithic `generate-full` action.

## Solution

Refactor `useItineraryGeneration.ts` to use the same progressive day-by-day pattern that regeneration already uses:

1. **Call `generate-full` only for Stage 1 (context/profile loading) + Stage 2 setup** -- or switch entirely to calling `generate-day` in a loop from the frontend
2. Each day call completes in ~5-10 seconds, well within timeout limits
3. Auto-save after each day so partial progress is preserved
4. Show progress UI during generation

## Changes

### 1. `src/hooks/useItineraryGeneration.ts`
- Replace the single `generate-full` invocation with a two-phase approach:
  - **Phase 1**: Call `generate-full` with a new flag like `setupOnly: true` or just call a lightweight setup/context action to initialize the trip in the database
  - **Phase 2**: Loop through days 1..N calling `generate-day` for each, with progress callbacks, auto-save, and retry logic (matching the regeneration pattern in `EditorialItinerary.tsx`)
- Add progress state/callback so the UI can show "Generating day 3 of 16..."
- Add per-day timeout (120s) and retry with backoff (matching regeneration)

### 2. `supabase/functions/generate-itinerary/index.ts` (minor)
- Optionally add a `setup-only` action that runs Stages 1 + context loading without generating any days, returning the trip context needed for subsequent `generate-day` calls
- Or: keep `generate-full` but have it bail after early save (Stage 3) if `setupOnly` is set

### 3. UI progress indicator
- The generation flow already has loading states -- wire the day-by-day progress percentage into the existing loading UI in the trip planner

## Technical Details

- Matches the proven pattern already working in `EditorialItinerary.tsx` lines 2595-2738
- Each `generate-day` call is self-contained (~5-10s) and well within edge function limits
- Partial saves mean users never lose progress even if one day fails
- Retry logic (4 attempts with exponential backoff) handles transient failures
- No backend schema changes needed

## Risk

Low -- `generate-day` is already battle-tested via regeneration. This just changes the orchestration from server-side to client-side for initial generation.
