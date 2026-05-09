## M1 — Hotel ranking divergence

Replace the hardcoded "top 3" recommendation with a confidence-threshold + visible-count alignment so "Recommended only" filters render a stable subset.

### File
`src/services/hotelRankingAPI.ts` (lines 276–280)

### Scale note
`matchScore` in this file is on a **1–100 scale** (see `calculateMatchScore`, line 200, clamped to `Math.max(1, Math.min(100, matchScore))`), not 0–1. So the threshold needs to be `65`, not `0.65`. Otherwise the proposed snippet drops in unchanged.

### Change

Replace:
```ts
// Mark top 3 as recommended
return scored.map((hotel, index) => ({
  ...hotel,
  isRecommended: index < 3,
}));
```

With:
```ts
// Mark all hotels above a confidence threshold as recommended, OR top N if
// scoring is ambiguous. Caller knows how many to display via .length.
const RECOMMEND_SCORE_THRESHOLD = 65; // matchScore is 1–100
const MIN_RECOMMENDED = 3;
const MAX_RECOMMENDED = 8;

const aboveThreshold = scored.filter(h => (h.matchScore ?? 0) >= RECOMMEND_SCORE_THRESHOLD);
const recommendedCount = Math.min(
  MAX_RECOMMENDED,
  Math.max(MIN_RECOMMENDED, aboveThreshold.length),
);

return scored.map((hotel, idx) => ({
  ...hotel,
  isRecommended: idx < recommendedCount,
}));
```

`scored` is already sorted desc by `matchScore` at line 274, so no extra sort needed.

### Verify
- `grep -n "RECOMMEND_SCORE_THRESHOLD\|recommendedCount" src/services/hotelRankingAPI.ts` → 3+ hits
- Toggling "Recommended only" in the UI returns a deterministic subset across clicks.
