

## Slash Google Places API Costs — Root Cause Analysis & Fix Plan

### The Real Problem

Your Google bill is **$470/month**. Your internal cost tracker shows **$125.53**. The gap is **$344 in untracked or underpriced calls**. Here's why:

### Root Causes (5 leaks found)

**LEAK 1 — Wrong pricing in cost tracker ($170 undercount)**
The cost tracker uses `$0.017/call` for Text Search. Google actually charges **$0.032/call** for Text Search (New) — nearly 2x more. With 5,042 tracked calls, that's $85 tracked vs $161 actual. This alone accounts for $76 in undercount.

**LEAK 2 — `fetch-reviews` returns RAW Google photo URLs to the browser (BIGGEST LEAK)**
Line 192-193 of `fetch-reviews/index.ts` sends URLs like:
`https://places.googleapis.com/v1/{photo}/media?key=YOUR_KEY`
Every time a user's browser renders a review photo, Google charges **$0.007**. These are completely untracked. If 10 users view 5 venues with 5 photos each = 250 photo loads/day = $1.75/day = **$52/month** just from browser-rendered review photos.

**LEAK 3 — No negative caching (0 entries)**
When Google returns nothing for a venue, we don't remember that. The same failed lookups repeat endlessly. Currently **zero** negative cache entries exist. This likely causes 20-30% of all Google calls to be wasted repeats.

**LEAK 4 — 5 separate functions all calling Google Places independently**
- `destination-images` — activity/destination photos
- `fetch-reviews` — venue reviews + photos
- `recommend-restaurants` — restaurant search + photos
- `generate-itinerary/venue-enrichment.ts` — venue validation
- `hotels` — hotel search (up to 3 Text Search calls + 24 photo downloads per search!)

Each function makes its own Google Places Text Search call — no shared venue cache across functions.

**LEAK 5 — AI quality scoring triggers cascading retries**
When `scoreImageQuality` fails an image (score < 0.6), the code tries scoring MORE candidates (line 1381-1398), each costing an AI call. If ALL fail, the image is rejected and the next user triggers the SAME Google lookup again (no negative cache).

### Fix Plan

#### Change 1: Fix cost tracker pricing
**File:** `supabase/functions/_shared/cost-tracker.ts`
Update `places_text_search` price from `0.017` to `0.032` and the save calculation from `0.017` to `0.032`.

#### Change 2: Cache `fetch-reviews` photos in storage (kill the biggest leak)
**File:** `supabase/functions/fetch-reviews/index.ts`
Replace raw Google photo URLs (line 192-193) with `getCachedPhotoUrl()` calls — download once to our storage bucket, return our CDN URL. Same pattern already used in `hotels/index.ts` and `destination-images/index.ts`.

#### Change 3: Add negative caching
**File:** `supabase/functions/destination-images/index.ts`
After all tiers return nothing (before Tier 5 AI / Tier 6 fallback at ~line 1420), insert a `source: 'no_result'` record into `curated_images` with a 14-day expiry. In `checkCuratedCache`, detect `source = 'no_result'` and return the category fallback immediately.

#### Change 4: Disable AI quality scoring
**File:** `supabase/functions/destination-images/index.ts`
Remove the `scoreImageQuality` call (lines 1361-1405). It burns AI credits, adds latency, and when it rejects images it causes cascade retries with no negative caching. The match-score filtering (0.55 threshold) + content mismatch detection is already sufficient quality control.

#### Change 5: Client-side request batching
**File:** `src/hooks/useActivityImage.ts`
Collect image requests in a 150ms window, send as single batch POST. Add batch mode to `destination-images/index.ts` accepting `venues: Array<{name, category}>` (max 20). Reduces edge function invocations by ~80%.

#### Change 6: Cross-function venue cache
**File:** `supabase/functions/_shared/venue-cache.ts` (new)
Create a shared `checkVenueCache` / `cacheVenueResult` utility that all 5 functions use. When `venue-enrichment.ts` resolves a Google Place for "Trattoria da Mario, Rome", `destination-images` should find it without calling Google again.

### Expected Impact

| Leak | Current Cost | After Fix | Savings |
|------|-------------|-----------|---------|
| Wrong pricing (tracking only) | $0 real | $0 | Accurate visibility |
| Raw review photo URLs | ~$50-80/mo | ~$0 | $50-80/mo |
| No negative caching | ~$80-120/mo | ~$0 | $80-120/mo |
| AI quality scoring | ~$30/mo AI + retries | $0 | $30+/mo |
| No batching | ~$40/mo overhead | ~$8/mo | $32/mo |
| No cross-function cache | ~$60-100/mo | ~$10/mo | $50-90/mo |
| **Total** | **~$470/mo** | **~$100-130/mo** | **~$340-370/mo (70-75%)** |

### Files Modified

| File | Change |
|---|---|
| `supabase/functions/_shared/cost-tracker.ts` | Fix pricing constants |
| `supabase/functions/fetch-reviews/index.ts` | Cache photo URLs via `getCachedPhotoUrl` |
| `supabase/functions/destination-images/index.ts` | Add negative caching, remove AI scoring, add batch mode |
| `supabase/functions/_shared/venue-cache.ts` | New shared venue cache utility |
| `src/hooks/useActivityImage.ts` | Client-side 150ms batch queue |

