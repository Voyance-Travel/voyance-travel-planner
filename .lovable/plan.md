

## Fix: DNA match scores are compressed into a narrow high range (all ~99%)

### Root cause

The scoring formula in `scoreAndRankHotels` (line 165-168 of `useDNAHotelRecommendations.ts`) uses an alignment model that produces raw scores in a narrow ~60-80 range, then applies an aggressive linear stretch:

```typescript
rawScore = Math.min(100, rawScore * 1.25 + 12);
```

This maps the typical 60-80 raw range to 87-112 (clamped to 100). After quality bonuses (+3) and neighborhood bonuses (+8), nearly everything lands at 95-99. A budget ibis and a Four Seasons both produce similar alignment scores because:

1. **Alignment = `1 - |hotelScore - userTrait|`** — when traits cluster around 0.5 (moderate user), every hotel within ±0.2 of center scores 0.8+, yielding almost no differentiation.
2. **The `*1.25 + 12` inflation** then pushes everything to the ceiling.
3. **Price dimension uses `userTrait: 1.0`** (hardcoded) instead of the user's actual budget trait, meaning price alignment always contributes maximally.

### Fix

**File: `src/hooks/useDNAHotelRecommendations.ts`** — `scoreAndRankHotels` function (lines 128-210)

1. **Use squared-distance alignment** instead of linear, to amplify small differences:
   ```typescript
   const diff = Math.abs(hotelScore - clampedTrait);
   const alignment = 1 - diff * diff; // Quadratic: penalizes mismatches more
   ```

2. **Remove the artificial inflation** (`*1.25 + 12`). Replace with percentile-based rescaling across the result set so scores use the full 50-98 range:
   ```typescript
   // After computing raw scores for all hotels:
   const rawScores = scored.map(h => h.rawScore);
   const minRaw = Math.min(...rawScores);
   const maxRaw = Math.max(...rawScores);
   const range = maxRaw - minRaw || 1;
   // Rescale to 50-98
   scored.forEach(h => {
     h.dnaMatchScore = Math.round(50 + ((h.rawScore - minRaw) / range) * 48);
   });
   ```

3. **Wire the budget trait properly** — use `traitScores.budget` for the price dimension instead of hardcoded `1.0`:
   ```typescript
   { hotelScore: metadata.priceScore, userTrait: traitScores.budget, weight: 0.18 },
   ```
   A budget-conscious user (budget=0.8) will penalize expensive hotels; a luxury user (budget=0.2) will penalize cheap ones.

4. **Increase weight differentiation** — give comfort and price slightly more weight since they're the strongest differentiators between an ibis and a Four Seasons:
   - comfort: 0.15 → 0.20
   - price: 0.18 → 0.20
   - Reduce social and pace to 0.08 each to compensate

5. **Cap the neighborhood bonus** to +5 (from +8) and quality bonus to +2/+1 (from +3/+1) to prevent these from washing out the core scoring.

### Result
- An ibis budget hotel might score ~62% for a moderate traveler, while a Four Seasons scores ~88%
- Scores will spread across the 50-98 range with meaningful differentiation
- The top pick will genuinely be the best DNA match, not just alphabetically first among tied 99% scores

