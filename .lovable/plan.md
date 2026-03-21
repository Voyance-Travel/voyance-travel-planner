

## Fix: DNA Match Scores Clustered at 98% — Insufficient Differentiation

### Root cause

Two separate scoring paths exist, both with inflation problems:

**1. `useTravelDNAHotelRanking.ts` (main hotel page)** — lines 216-237:
- Uses **linear** alignment: `1 - |diff|` — a 0.2 difference only costs 20%, so most hotels score 70-85 raw
- Static inflation: `rawScore * 1.25 + 12` pushes 70 raw → 99.5 display — everything above ~70 raw hits 98-99
- `priceScore` user trait is **hardcoded to 1.0** (line 207), meaning budget hotels always score high on this 18%-weighted dimension, while luxury hotels are penalized regardless of the user's actual budget preference
- Quality bonus adds +3 on top, further compressing into the ceiling

**2. `useDNAHotelRecommendations.ts` (DNA picks sidebar)** — lines 144-200:
- Uses **quadratic** penalty (`1 - diff²`) — better, but when raw scores cluster tightly (e.g., 85-92), the percentile rescaling `50 + ((raw - min) / range) * 48` stretches them to fill 50-98 — so the top 3 all hit 98

### Fix

**File 1: `src/hooks/useTravelDNAHotelRanking.ts`** (main scoring)

1. Switch from linear to **quadratic** alignment (match the DNA picks formula): `1 - diff * diff`
2. Replace hardcoded `userTrait: 1.0` for price with `traitScores.budget` — use the user's actual budget preference
3. Replace static inflation (`* 1.25 + 12`) with **percentile rescaling** (same approach as DNA picks): map raw scores across the result set to a 30-95 range, guaranteeing spread
4. Increase quality bonus cap differentiation: 5-star → +4, 4-star → +2, 3-star → 0

**File 2: `src/hooks/useDNAHotelRecommendations.ts`** (sidebar picks)

1. Widen the rescaling output range from `50-98` to `35-96` — this gives more room for meaningful gaps between hotels
2. Add a **minimum gap** rule: if top N scores would be identical after rounding, apply a tie-breaking spread (e.g., 96, 93, 90 instead of 98, 98, 98)

### Expected result
- Top hotel might score 92-95%, second hotel 85-88%, third 78-82% — meaningful visual differentiation
- Luxury hotels won't be penalized if the user's DNA indicates a premium budget preference
- Airport/budget hotels score lower for comfort-oriented travelers, not arbitrarily
- No hotel can trivially hit 98% without genuinely matching most traits

### Scope
Two files: `useTravelDNAHotelRanking.ts` and `useDNAHotelRecommendations.ts`. No backend changes.

