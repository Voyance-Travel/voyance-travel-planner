
What’s going on is not “Gemini can’t find restaurants.” The pipeline is leaking in two specific places, and the logs you pasted match that exactly.

## What I found

### 1. We are not actually carrying a restaurant pool into the failing generation path
For the trip I inspected, `trips.metadata.used_restaurants` is populated, but `trips.metadata.restaurant_pool` is `null`.

That means:
- prompt-level “pick from this list” enforcement is not active for chained trip generation
- `action-generate-trip-day.ts` logs `Restaurant pool EMPTY`
- then it tries `verified_venues`
- then `generation-core.ts` still runs its own final meal guard **without any fallback venues passed in**
- so retries happen, and final-attempt fallback still fires

This is the biggest issue. The system is refactored, but the authoritative chained trip path is missing the preloaded pool data you expect it to have.

### 2. The retry loop is using a meal guard that still has no real venues
In `generation-core.ts`, the post-validation meal guard calls:

- `enforceRequiredMealsFinalGuard(...)`

but does **not** pass `fallbackVenues`.

So even if `action-generate-day.ts` has a better guard later, the core retry loop still treats “missing meal” as a retry condition based on a guard that has no venue candidates. That’s why you keep seeing guard/retry behavior repeatedly.

So the current behavior is:
```text
AI misses breakfast/lunch/dinner
-> generation-core meal guard sees missing meal
-> no fallback venue list available there
-> triggers retry
-> repeat
-> later another layer injects generic/type fallback
```

That is why this feels like it keeps “coming back.” The problem exists in the shared core path, not just the outer wrapper.

### 3. The duplicate Day 1 / Day 2 entries in logs are a logging bug, not necessarily day generation running twice
`GenerationTimer.resume()` reloads existing `day_timings`, and each chained day call appends again with `addDayTiming(...)`.

So generation logs can look like:
- day 1
- day 2
- day 1 again
- day 2 again
- day 3
- day 4

That’s because resumed timer state is accumulating duplicate entries instead of upserting/replacing by `day`.

So yes, the log is misleading you. It makes it look like the engine generated days 1 and 2 twice, but the more likely issue is duplicated timing records, not duplicated saved itinerary days.

## Why this is still happening after the refactor

Because the refactor helped isolate ownership, but two cross-cutting pieces were left inconsistent:

1. **Restaurant pool lifecycle**
   - trip-day chain expects `metadata.restaurant_pool`
   - but the current trip had none stored
   - so the “pre-verified 12 restaurants” assumption never becomes true in runtime

2. **Meal guard ownership**
   - the shared core retry loop still owns meal-missing retries
   - but it does not receive the same fallback venue context as the outer day action

So the architecture is better, but the handoff is incomplete.

## The fix I would implement

### 1. Make restaurant pool generation/storage mandatory before chained day generation
In `action-generate-trip.ts`:
- ensure the pre-chain setup creates/fetches a per-city restaurant pool
- store it in `trips.metadata.restaurant_pool`
- fail loudly if full-day meal generation is expected and the pool is missing

This should not be “optional enrichment.” It needs to be a required precondition for trip generation.

### 2. Pass fallback venues into `generation-core.ts`
Refactor the core day-generation function so it accepts:
- `restaurantPool`
- `usedRestaurants`
- `fallbackVenues`

Then the retry-triggering meal guard inside `generation-core.ts` must use the same real venue candidates as the outer guard.

That removes the current split-brain behavior.

### 3. Stop allowing the core loop to retry on a guard that lacks venue data
If `requiredMeals.length > 0` and no venue source exists:
- log a hard diagnostic
- fail as “missing restaurant pool context”
- do not keep pretending retries will fix it

That will surface the true issue immediately instead of looping into fallback behavior.

### 4. Deduplicate day timing logs by `day`
In `GenerationTimer`:
- replace append-only `addDayTiming(...)`
- with upsert-by-day behavior

So the admin log reflects one entry per day and stops looking like days 1 and 2 ran twice.

### 5. Tighten diagnostics so you can see the real cause
Add explicit diagnostics fields per day:
- `restaurantPoolCount`
- `verifiedVenueFallbackCount`
- `coreMealGuardHadFallbacks`
- `outerMealGuardHadFallbacks`
- `poolMissing: true/false`

That will make the next failure obvious in one glance.

## Expected result after this fix

For a 4-day Lisbon trip:
- pre-chain setup stores a real restaurant pool before day generation starts
- each day gets meal candidates from the same source
- the core retry loop no longer retries blindly without venues
- the guard only fires when the AI truly missed a meal despite having candidates
- logs show Day 1, 2, 3, 4 once each, not duplicated
- no more “why are we still falling back when we should already have 12 restaurants?”

## Files to update

- `supabase/functions/generate-itinerary/action-generate-trip.ts`
  - guarantee restaurant pool creation/storage before chain starts

- `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
  - consume guaranteed pool and surface hard diagnostics if missing

- `supabase/functions/generate-itinerary/generation-core.ts`
  - accept and use fallback venue context in the retrying meal guard

- `supabase/functions/generate-itinerary/generation-timer.ts`
  - upsert day timings instead of append-only duplicates

- possibly `supabase/functions/generate-itinerary/action-generate-day.ts`
  - align diagnostics and shared fallback contract with core path

## Bottom line

You’re right to be upset: this is not a “hard AI problem.” The issue is that the refactored system still has one broken contract:
- restaurant pool is not guaranteed to exist in chained generation
- and the core meal guard is still running without the same venue context

So yes: this should be a focused fix now, not another broad rewrite.
