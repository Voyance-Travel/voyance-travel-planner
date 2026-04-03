## Google Places API Cost Reduction — Implemented

### Changes Made (April 3, 2026)

All 6 cost-reduction measures have been implemented and deployed:

| # | Change | File(s) | Status |
|---|--------|---------|--------|
| 1 | Fix cost tracker pricing (0.017 → 0.032 for Text Search) | `_shared/cost-tracker.ts` | ✅ Done |
| 2 | Cache fetch-reviews photos in storage (kill raw URL leak) | `fetch-reviews/index.ts` | ✅ Done |
| 3 | Add negative caching (14-day TTL for no-result venues) | `destination-images/index.ts` | ✅ Done |
| 4 | Remove AI quality scoring (eliminate cascade retries) | `destination-images/index.ts` | ✅ Done |
| 5 | Client-side batch queue (150ms window, max 20/batch) | `useActivityImage.ts` + `destination-images/index.ts` | ✅ Done |
| 6 | Shared venue cache across edge functions | `_shared/venue-cache.ts` (new) | ✅ Done |

### Expected Impact
- **Before**: ~$470/month Google Places API costs
- **After**: ~$100-130/month (70-75% reduction)
