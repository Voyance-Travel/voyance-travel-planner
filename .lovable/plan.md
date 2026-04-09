

# Deploy 4 Undeployed Edge Functions

## What

Deploy the 4 edge functions that exist in code but are missing from `supabase/config.toml`:

1. **`activity-concierge`** — Activity recommendations
2. **`generation-canary`** — Pipeline health check
3. **`moderate-guide-content`** — Content moderation for guides
4. **`send-push`** — Push notification delivery

Also clean up the stale `enrich-itinerary` config entry (no matching code exists).

## Steps

1. Add config entries for all 4 functions in `supabase/config.toml` with `verify_jwt = false`
2. Remove the stale `[functions.enrich-itinerary]` entry
3. Deploy all 4 functions

