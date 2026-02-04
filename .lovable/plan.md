

# Fix Hotel-to-DNA Mapper: Correct Signal Mapping for 8 Traits

## Summary
The current hotel ranking maps signals to the wrong Travel DNA dimensions (socialScore uses review ratings, priceScore normalizes against result set, amenity stacking has no caps). This plan corrects the three critical mapping errors and expands coverage to all 8 DNA traits.

---

## The Three Priority Fixes

### Fix 1: socialScore → Measure Social Character, Not Review Quality

**Current Problem:**
Review rating (4.8) feeds socialScore, but a private villa and a party hostel both score high despite being opposite ends of the social spectrum.

**Corrected Signal Mapping:**
| Signal | Score Logic |
|--------|-------------|
| Hotel type: hostel | +0.8 (inherently social) |
| Hotel type: boutique (<30 rooms) | +0.6 (intimate, conversational) |
| Hotel type: resort (300+ rooms) | +0.3 (anonymous, less social) |
| Hotel type: villa/apartment | +0.1 (private, antisocial) |
| Amenity: rooftop bar, lounge, communal kitchen | +0.15 each (social spaces) |
| Amenity: private pool, private terrace | −0.1 each (isolation signals) |
| Stars 2-3 | +0.1 (backpacker/social crowd) |
| Stars 5 | −0.1 (privacy-oriented crowd) |

**Review ratings move to a new `qualityScore`** used as a baseline filter (e.g., hide hotels below 6.5/10) but not as a personality dimension.

---

### Fix 2: priceScore → Normalize Against User Budget, Not Result Set

**Current Problem:**
```typescript
// BROKEN: $350/night gets priceScore=1.0 if it's cheapest in set
const normalizedScore = 100 - ((price - min) / (max - min)) * 100;
```

A budget traveler searching a luxury destination sees $350 as "good" because it's relatively cheaper—but $350 is not aligned with their travel style.

**Corrected Logic:**
```text
┌─────────────────────────────────────────────────────────────────┐
│ User's budget_tier from Travel DNA or trip context:            │
│   budget    → target = ~$80/night                               │
│   moderate  → target = ~$180/night                              │
│   premium   → target = ~$350/night                              │
│   luxury    → target = ~$600/night                              │
├─────────────────────────────────────────────────────────────────┤
│ Scoring:                                                        │
│   price ≤ target           → 1.0 (perfect alignment)            │
│   price ≤ target × 1.3     → 0.7 (acceptable stretch)           │
│   price ≤ target × 1.6     → 0.4 (significant stretch)          │
│   price > target × 1.6     → 0.1 (misaligned)                   │
│                                                                 │
│   If budget_tier = luxury: invert sensitivity                   │
│   (price below target gets slight penalty—they want premium)    │
└─────────────────────────────────────────────────────────────────┘
```

---

### Fix 3: Amenity Stacking → Diminishing Returns, Not Flat +0.1

**Current Problem:**
```typescript
// BROKEN: spa+pool+sauna+hot-tub+terrace = +0.5 to comfortScore
// This dominates ranking even for travelers who don't prioritize comfort
amenityScore += amenities.length * 0.1;
```

**Corrected Logic: Tiered Bucketing**
```text
Luxury amenity tier:
  0 luxury amenities   → 0.0
  1-2 luxury amenities → 0.3
  3-4 luxury amenities → 0.6
  5+ luxury amenities  → 0.8 (capped)

Luxury amenity list: spa, pool, sauna, hot tub, private terrace, 
                     butler service, michelin restaurant, helipad
```

This keeps the dimension proportional without runaway stacking that biases input before the weighting engine applies trait priorities.

---

## Complete 8-Dimension Mapping

| Dimension | What It Measures | Hotel Signals |
|-----------|------------------|---------------|
| `comfortScore` | Physical comfort priority | Star rating (3★=0.5, 4★=0.75, 5★=1.0), luxury amenity tier (capped), room size if available |
| `adventureScore` | Appetite for unfamiliar | Hotel type (ryokan/riad/treehouse=high, Marriott=low), distance from tourist center (>5km boost), unique property features |
| `cultureScore` | Cultural engagement depth | Proximity to UNESCO sites/museums (Google Places), locally-owned flag, architectural character, neighborhood type |
| `socialScore` | Social orientation | Hotel size/type (hostel=social, villa=private), communal spaces, bar on-site, solo-friendly positioning |
| `priceScore` | Budget alignment | Price vs. user's stated budget target (not result set), value indicators (included breakfast, free transport) |
| `paceScore` | Energy management | Transit accessibility (near subway=fast-paced easy), walkability score, distance to activity clusters |
| `authenticityScore` | Genuine local experience | Locally owned, residential vs. tourist neighborhood, cultural design elements, staff-to-guest ratio |
| `simplicityScore` | Planning friction tolerance | Free cancellation (+0.2), airport transfer (+0.1), multilingual staff, flexible check-in, transit proximity |

---

## Technical Implementation

### New File: `src/utils/hotelMetadataMapper.ts`

```text
┌─────────────────────────────────────────────────────────────────┐
│ mapHotelToMetadata(hotel: HotelOption, context: MappingContext) │
├─────────────────────────────────────────────────────────────────┤
│ Input:                                                          │
│   - hotel: HotelOption (from hotelAPI.ts)                       │
│   - context: {                                                  │
│       userBudgetTarget: number,                                 │
│       userBudgetTier: string,                                   │
│       destinationPOIs?: { unesco: [], museums: [] }             │
│     }                                                           │
│                                                                 │
│ Output: OptionMetadata                                          │
│   {                                                             │
│     priceScore, comfortScore, adventureScore, cultureScore,     │
│     socialScore, authenticityScore, simplicityScore, paceScore, │
│     qualityScore (for filtering), tags[]                        │
│   }                                                             │
└─────────────────────────────────────────────────────────────────┘
```

**Key Functions:**
1. `inferHotelType(name, amenities, stars)` → hostel | boutique | chain | resort | villa
2. `scoreSocialEnvironment(type, amenities, stars)` → 0-1
3. `scorePriceAlignment(pricePerNight, userBudgetTarget, budgetTier)` → 0-1
4. `scoreLuxuryAmenityTier(amenities)` → 0-1 (with diminishing returns)
5. `scoreProximityToCulture(neighborhood, destinationPOIs)` → 0-1
6. `scoreSimplicity(cancellationPolicy, amenities)` → 0-1

### New Hook: `src/hooks/useTravelDNAHotelRanking.ts`

```text
┌─────────────────────────────────────────────────────────────────┐
│ useTravelDNAHotelRanking(hotels: HotelOption[])                 │
├─────────────────────────────────────────────────────────────────┤
│ 1. Fetch user's travel_dna_profiles                             │
│    - Extract trait_scores, budget_tier from DNA or preferences  │
│ 2. Calculate userBudgetTarget from budget_tier                  │
│ 3. Map each hotel → OptionMetadata using hotelMetadataMapper    │
│ 4. Initialize UserPreferenceWeightingEngine with DNA            │
│ 5. Call engine.rankOptions() with mapped hotels                 │
│ 6. Return:                                                      │
│    - rankedHotels with dnaMatchScore (0-100)                    │
│    - matchReasons per hotel                                     │
│    - isPersonalized flag (false if no DNA)                      │
└─────────────────────────────────────────────────────────────────┘
```

### Modified Files

| File | Changes |
|------|---------|
| `src/pages/planner/PlannerHotelEnhanced.tsx` | Import hook, add "Best for You" sort option, display DNA match badges |
| `src/components/planner/hotel/HotelFilters.tsx` | Add "Best for You (DNA)" to sortBy dropdown |
| `src/components/planner/hotel/EnhancedHotelCard.tsx` | Show match percentage badge + match reasons tooltip |

### New Component: `src/components/hotels/DNAMatchBadge.tsx`

```text
┌──────────────────────────────────────────────┐
│ DNAMatchBadge                                │
│ Props: { matchScore: number, reasons: [] }   │
├──────────────────────────────────────────────┤
│ Visual:                                      │
│   🧬 92% Match  ← Green if ≥80               │
│   🧬 71% Match  ← Yellow if 60-79            │
│   🧬 54% Match  ← Gray if <60                │
│                                              │
│ Hover/click: shows match reasons tooltip     │
│   "Matches your comfort-first travel style"  │
│   "Great value for your budget"              │
└──────────────────────────────────────────────┘
```

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| No Travel DNA | Fall back to current rating-based sort; show prompt "Take the quiz for personalized matches" |
| Incomplete DNA (missing traits) | Score available dimensions, weight missing ones at 0.5 (neutral) |
| Guest users | Standard ranking, no DNA badge shown |
| Budget tier undefined | Default to "moderate" ($180/night target) |
| Hotel type inference fails | Default to "chain" (neutral social score) |

---

## File Summary

| File | Action |
|------|--------|
| `src/utils/hotelMetadataMapper.ts` | **Create** - Core mapping logic with corrected signals |
| `src/hooks/useTravelDNAHotelRanking.ts` | **Create** - Orchestrates DNA fetch + ranking |
| `src/components/hotels/DNAMatchBadge.tsx` | **Create** - Visual match indicator |
| `src/pages/planner/PlannerHotelEnhanced.tsx` | **Modify** - Integrate DNA ranking + sort option |
| `src/components/planner/hotel/HotelFilters.tsx` | **Modify** - Add DNA sort option |
| `src/components/planner/hotel/EnhancedHotelCard.tsx` | **Modify** - Display DNA badge |
| `src/services/hotelRankingAPI.ts` | **Deprecate** - Replace client-side logic with new mapper |

---

## What Ships vs. What's Deferred

### Ships Now (v1)
- ✅ Fixed socialScore (hotel type + amenity-based, not reviews)
- ✅ Fixed priceScore (user budget target, not result set)
- ✅ Capped amenity stacking (tiered bucketing)
- ✅ All 8 dimensions mapped with available signals
- ✅ DNA match badge + sort option
- ✅ Star rating as comfort proxy (acceptable for v1)

### Deferred to v2 (Based on User Feedback)
- Per-destination neighborhood character index
- Room size / bathroom quality signals (not in current API data)
- Staff-to-guest ratio (data not available)
- Refined hotel type inference using external APIs

