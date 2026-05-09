## M8 — Weighted rating null guard in `mergePlaceDetails`

File: `supabase/functions/fetch-reviews/index.ts`, lines 788–807.

The existing inline loop already filters `p.rating > 0 && p.totalReviews > 0`, so weight distortion is already prevented. The **behavioral gap** vs. spec is the fallback: when no source has reviews, current code returns `primary.rating` (whatever stub rating the primary carried); spec wants `null`.

### Edit (lines 788–807)

Replace the weighted-average block with a `validSources`-based version:

```ts
// Calculate weighted average rating.
// Exclude sources with no reviews — log10(0+1)=0 weight, but keeping them in
// the source list distorts downstream consumers and the null-fallback semantics.
const candidates = [google, tripAdvisor, foursquare, openTripMap];
const validSources = candidates.filter((p): p is PlaceDetails =>
  !!p &&
  Number.isFinite(p.rating) && p.rating > 0 &&
  Number.isFinite(p.totalReviews) && p.totalReviews > 0
);

const weightedSum = validSources.reduce(
  (acc, s) => acc + s.rating * Math.log10(s.totalReviews + 1), 0
);
const totalWeight = validSources.reduce(
  (acc, s) => acc + Math.log10(s.totalReviews + 1), 0
);
const totalReviews = validSources.reduce((acc, s) => acc + s.totalReviews, 0);
const avgRating = totalWeight > 0
  ? Math.round((weightedSum / totalWeight) * 10) / 10
  : null;

return {
  ...primary,
  rating: avgRating ?? null,
  totalReviews,
  photos: allPhotos.slice(0, 8),
};
```

### Behavioral change

- **Before:** no valid sources → `rating = primary.rating` (could be 0/stale).
- **After:** no valid sources → `rating = null`. Downstream UI must already handle null (other code paths return null ratings).

### Note on user's spec

The user's snippet shows an early `return { rating: null, totalReviews: 0, sources: [] }`. That shape doesn't match `PlaceDetails` (no `sources` field, would drop `name/address/photos/etc.` from `primary`). I'm preserving the `...primary` spread and just nulling `rating` — same null-guard semantics, no broken contract for callers.

### Verification

```bash
grep -c "validSources" supabase/functions/fetch-reviews/index.ts   # ≥ 1
```

Then deploy `fetch-reviews`.