

# Cost Leak Audit: Where You're Bleeding Money

## Overview

After auditing all edge functions and frontend services, I found **7 major cost leak categories** -- places where you're paying for API calls without caching, duplicating calls, or generating data nobody uses.

---

## LEAK 1: Perplexity calls with ZERO server-side caching (HIGH -- ~$0.01-0.05 per call)

These 5 edge functions call Perplexity every single time with no database cache. If a user revisits the same page or another user visits the same destination, you pay again:

| Function | What it does | Cache? |
|---|---|---|
| `enrich-attraction` | Hours, prices, closures | None -- only in-memory client cache (lost on refresh) |
| `lookup-activity-url` | Booking URLs | None -- only in-memory client cache |
| `lookup-restaurant-url` | Restaurant websites | None at all |
| `lookup-local-events` | Events during dates | None -- only in-memory client cache |
| `lookup-travel-advisory` | Visa, safety info | None -- only in-memory client cache |

The frontend `enrichmentService.ts` has in-memory `Map` caches, but these reset on every page refresh/navigation. The data (restaurant URLs, attraction hours, visa info) is stable enough to cache in `search_cache` for 12-48 hours.

**Fix**: Add `search_cache` table lookups (like `fetch-reviews` and `profile-ideal-hotel` already do) to all 5 functions. These are your most-called Perplexity endpoints.

---

## LEAK 2: `lookup-destination-insights` called fresh every itinerary view (MEDIUM)

In `EditorialItinerary.tsx` (line 5250), destination insights (language phrases, voltage, emergency numbers, timezone) are fetched from Perplexity every time the itinerary page renders. The `fetchedRef` only guards against double-fetching within a single component mount -- not across sessions or users.

This data is **100% static** (voltage in France doesn't change). It should be cached per destination indefinitely (or 90+ days) in a table.

**Fix**: Cache in `search_cache` with key `dest-insights:{destination}` and a 90-day TTL.

---

## LEAK 3: `check-subscription` called 4 separate times from different code paths (MEDIUM)

Four different functions all independently call `check-subscription`:
- `getBillingOverview()` 
- `getSubscription()` 
- `getBillingProfileSummary()` 
- `checkSubscription()` (stripeAPI.ts)

Each creates its own React Query cache entry with different keys (`billing-overview`, `subscription`, `billing-profile-summary`). If a page uses multiple billing components, you're hitting Stripe's API 3-4x when 1 call would suffice.

**Fix**: Consolidate to a single `useCheckSubscription` query and derive all views from that one cached response.

---

## LEAK 4: `ActivityLink` fires Perplexity on mount for EVERY activity (HIGH)

`ActivityLink.tsx` calls `lookupActivityUrl` (Perplexity) in a `useEffect` on mount. If an itinerary has 15 activities visible, that's **15 Perplexity API calls** just to find booking URLs -- most of which the user never clicks.

**Fix**: Make it on-demand (click to find URL) instead of auto-lookup. Or batch-resolve URLs during itinerary generation and store them in the activity data.

---

## LEAK 5: `generate-quick-preview` Perplexity cost not tracked (LOW)

The `fetchTravelAdvisory` function inside `generate-quick-preview` (line 263) calls Perplexity but the cost tracking comment on line 641 says "Perplexity tracking should happen in fetchTravelAdvisory, but we track here for simplicity" -- and it doesn't actually record the Perplexity call in the cost tracker. You're paying for it but not measuring it.

**Fix**: Add `costTracker.recordPerplexity(1)` inside `fetchTravelAdvisory`.

---

## LEAK 6: Duplicate preview generation paths (LOW-MEDIUM)

You have 3 separate preview edge functions:
- `generate-quick-preview` -- homepage destination entry
- `generate-trip-preview` -- trip preview service  
- `generate-full-preview` -- full preview with gated details

These likely share significant prompt/logic overlap and none cache their results server-side. If a user generates a preview for "Paris" then navigates away and comes back, it regenerates.

**Fix**: Cache preview results in a `preview_cache` table keyed by destination + parameters, with a 24-hour TTL.

---

## LEAK 7: `explain-recommendation` has no caching (LOW)

Each time a user expands an activity explanation, it fires an AI call. The same activity for the same archetype will always produce a near-identical explanation.

**Fix**: Cache explanations in `search_cache` keyed by `explain:{activityId}:{archetypeId}`.

---

## Priority Action Plan

### Phase 1: Highest ROI (stops the biggest leaks)
1. Add `search_cache` lookups to all 5 Perplexity enrichment functions (attraction, activity URL, restaurant URL, events, advisory)
2. Make `ActivityLink` on-demand instead of auto-fire
3. Cache `destination-insights` per destination (90-day TTL)

### Phase 2: Consolidation
4. Unify `check-subscription` to a single cached query
5. Track Perplexity cost in `generate-quick-preview`

### Phase 3: Nice-to-have
6. Cache preview generation results
7. Cache `explain-recommendation` results

### Technical approach for caching

All 5 Perplexity functions would follow the same pattern (already used by `fetch-reviews` and `profile-ideal-hotel`):

```text
1. Build cache key from inputs (e.g., "attraction:louvre:paris")
2. Query search_cache WHERE search_key = key AND expires_at > now()
3. If hit -> return cached data (zero API cost)
4. If miss -> call Perplexity -> save to search_cache with TTL -> return
```

TTLs by data type:
- Destination insights (voltage, language): 90 days
- Restaurant/activity URLs: 30 days  
- Attraction hours/prices: 24 hours
- Local events: 6 hours
- Travel advisories: 7 days

