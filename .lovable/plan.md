

## Analysis: Day-by-Day Backend Loop Already Exists — But Has a Critical Auth Bug

The `generate-trip` → `generate-trip-day` → `generate-day` self-chaining architecture you described is **already implemented** in the codebase (lines 12086–12504 of `generate-itinerary/index.ts`). The frontend already calls `generate-trip` which fires off `generate-trip-day` via fetch, which chains to the next day, exactly as your spec describes.

**However, there is a critical bug that prevents it from working:**

### The Auth Bug (Showstopper)

All actions in `generate-itinerary` pass through `validateAuth()` at line 7142, which calls `supabase.auth.getUser(token)`. When `generate-trip-day` self-chains using `SERVICE_ROLE_KEY`, `getUser()` fails because a service role key is not a user JWT. Every chained call returns **401 Unauthorized**, so only Day 1 ever generates.

### Fix Required

**File: `supabase/functions/generate-itinerary/index.ts`**

1. **Bypass user-auth for server-to-server calls**: Detect when the request uses the `SERVICE_ROLE_KEY` (by checking if the bearer token matches the service role key, or by adding a shared internal secret header). For `generate-trip-day` specifically, the `userId` is already passed in the request body from the initial `generate-trip` call — so we can trust it when the caller authenticates with the service role key.

   Concretely:
   - After line 7131 (`const supabaseKey = ...`), extract the bearer token from the request
   - If the bearer token equals `supabaseKey` (the service role key), treat it as an **internal server call** and skip `validateAuth()` — instead, use the `userId` from the request body directly
   - Only apply this bypass for `generate-trip-day` action to minimize attack surface

2. **No other backend changes needed** — the self-chaining, progressive persistence, heartbeat updates, refund logic, and resume support are all already correctly implemented.

### Frontend — Already Correct

The frontend (`TripDetail.tsx` line 215, `useItineraryGeneration.ts` line 467) already calls `generate-trip` and polls via `useGenerationPoller`. The resume flow at line 200 already works. The welcome-back toast in `TripDashboard.tsx` was added in the previous conversation turn.

### Zombie Cleanup (Data Fix)

Run a one-time data update to fix stuck trips that failed due to the auth bug:
- Mark trips stuck in `generating` for >15 min as `partial` with appropriate metadata

### Summary of Changes

| # | Where | What |
|---|-------|------|
| 1 | Edge Function `index.ts` | Add service-role auth bypass for `generate-trip-day` action |
| 2 | Database | Clean up zombie trips stuck in `generating` |

Everything else in your spec (self-chaining, progressive saves, resume, polling, welcome-back toast) is already built and will start working once the auth bypass is in place.

