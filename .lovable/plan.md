

## Fix: Itinerary Pricing Clarity & Consistency

### Problem Summary
Card prices don't match day totals, day totals don't match the trip total, hotel costs appear with random numbers ($836, $850) on activity cards, free attractions show ~$50, and /pp suffix is inconsistent.

### Root Causes (from code audit)
1. **`getActivityCostInfo()`** (EditorialItinerary.tsx:1028) treats accommodation cards like any other activity — if AI sets `cost.amount = 836`, it's displayed as-is. No special handling for hotel check-in/return/freshen-up cards.
2. **`basisLabel()`** (line 1128) only returns `/pp` when `basis === 'per_person'`. Hotel/accommodation cards infer `basis = 'flat'` (via `FLAT_RATE_KEYWORDS`), so they show no suffix — creating ambiguity.
3. **`estimateCostSync()`** has no mapping for `accommodation`/`sightseeing` in `CATEGORY_TO_BASE_FIELD`, so it falls back to `activity_base_usd` ($30 × budget multiplier), producing ~$50 for free temples and crossings.
4. **`getDayTotalCost()`** (line 1172) skips estimated costs (`info.isEstimated ? 0 : info.amount`), but accommodation cards have *confirmed* costs from the AI — so $836 is included in the day total while ~$50 estimates are excluded. This creates the unpredictable gap between card sums and day headers.
5. **Trip total** (line 3051) uses financial snapshot (activity_costs DB) which includes hotel as a separate row, but the AI *also* puts hotel costs on day cards — double-counting.

---

### Fix 1: Accommodation Cards → Always $0/Free
**File:** `src/components/itinerary/EditorialItinerary.tsx`

In `getActivityCostInfo()` (~line 1036), add an early return for accommodation:
```typescript
// After the walk check (~line 1047):
const isAccommodation = ['accommodation', 'hotel', 'stay'].includes(catLower) ||
  /check.?in|check.?out|checkout|freshen up|return to.*hotel|return to.*four|return to.*aman/i.test(titleLower);
if (isAccommodation) {
  return { amount: 0, isEstimated: false, confidence: 'high', basis: 'flat' };
}
```
This ensures hotel check-in, freshen-up, return-to-hotel, and checkout cards all show **Free** regardless of what the AI generated.

### Fix 2: Always Show /pp When Travelers > 1
**File:** `src/components/itinerary/EditorialItinerary.tsx`

Update `basisLabel()` (~line 1128):
```typescript
function basisLabel(basis: CostBasis, travelers: number): string {
  if (travelers <= 1) return '';
  return '/pp';  // Always show /pp for multi-guest trips
}
```
This eliminates the confusing mix of "$X/pp" and "$X" (no suffix) on the same page.

### Fix 3: Free Attractions → "Free" Instead of ~$50
**File:** `src/components/itinerary/EditorialItinerary.tsx`

In `getActivityCostInfo()`, add a known-free-attraction check before the estimation fallback (~line 1100):
```typescript
// Before calling estimateCostSync:
const FREE_ATTRACTION_KEYWORDS = [
  'crossing', 'gardens', 'park', 'shrine', 'temple', 'plaza',
  'square', 'bridge', 'waterfront', 'promenade', 'boulevard',
  'viewpoint', 'lookout', 'market stroll', 'neighborhood walk'
];
const looksLikelyFree = FREE_ATTRACTION_KEYWORDS.some(kw => titleLower.includes(kw)) &&
  ['sightseeing', 'explore', 'cultural', 'activity'].includes(catLower);
if (looksLikelyFree && !shouldNeverBeFree) {
  return { amount: 0, isEstimated: false, confidence: 'medium', basis: 'flat' };
}
```

Also in `isNeverFreeCategory()`, ensure `accommodation`, `stay`, `explore` are NOT in the never-free list (they already aren't — confirmed).

### Fix 4: Day Total = Sum of Visible Card Costs
**File:** `src/components/itinerary/EditorialItinerary.tsx`

Currently `getDayTotalCost()` (line 1180) skips estimated costs in non-manual mode. Since Fix 1 and Fix 3 now zero out accommodation and free attractions, the day total will naturally match what's visible. No formula change needed — the fixes upstream solve the mismatch.

**Verification**: After Fixes 1-3, the day total will exclude:
- Accommodation cards (now $0)
- Free attractions (now $0)
- And correctly sum only dining/activity/nightlife cards (all /pp)

### Fix 5: Trip Total — No Double-Counting Hotel
**File:** `src/components/itinerary/EditorialItinerary.tsx`

In the trip total calculation (~line 3023), the `getDayTotalCost` already sums activity costs per day. After Fix 1, accommodation cards contribute $0, so hotel is only counted via `hotelCost` (line 3025). No double-counting.

Add a breakdown tooltip on the trip total header:
```
Trip Total: $9,772
  Activities: $3,586/pp × 2 = $7,172
  Hotel: $2,600
  Flights: $0
```

**Location:** The trip summary section (~line 3046-3053) where `totalCost` is computed. Add a `Tooltip` showing the formula.

### Fix 6: Cost Estimation Engine — Block Accommodation
**File:** `src/lib/cost-estimation.ts`

In `estimateCostSync()`, add early return for accommodation categories so even if the upstream check is bypassed, the engine won't produce phantom costs:
```typescript
// At top of estimateCostSync:
if (['accommodation', 'hotel', 'stay', 'check-in', 'checkout'].includes(normalizedCategory)) {
  return { amount: 0, currency: 'USD', isEstimated: false, confidence: 'high', source: 'explicit', reason: 'Accommodation excluded from activity costs' };
}
```

---

### Files Changed
| File | Changes |
|------|---------|
| `src/components/itinerary/EditorialItinerary.tsx` | Fix 1 (accommodation → $0), Fix 2 (/pp always), Fix 3 (free attractions), Fix 5 (breakdown tooltip) |
| `src/lib/cost-estimation.ts` | Fix 6 (block accommodation estimation) |

### What This Does NOT Fix (Separate Tickets)
- Departure day sequence (breakfast after checkout) — already tracked separately
- Breakfast location validation (Aman Tokyo when staying at Four Seasons) — tracked in departure validator
- Backend `activity_costs` table reconciliation — tracked under table-driven cost architecture goal

