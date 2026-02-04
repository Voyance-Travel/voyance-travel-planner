
# Add Budget, Payment & Need to Know to Itinerary Teaser

## Overview

Enhance the homepage itinerary preview (what users see after entering a destination) to include practical travel information upfront: daily budget estimates, payment/currency tips, and essential "need to know" details like visa requirements and safety level.

This transforms the teaser from a pure itinerary preview into a more complete "trip at a glance" that demonstrates Voyance's depth of knowledge.

## Current State vs. Proposed

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                          CURRENT TEASER                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  Your Tokyo Preview                                                     │
│  Built as a "Slow Traveler"                                             │
│                                                                         │
│  [Day 1] Cultural Immersion...                                          │
│  [Day 2] Local Discovery...                                             │
│  [Day 3] Hidden Gems...                                                 │
│                                                                         │
│  + 4 more days                                                          │
└─────────────────────────────────────────────────────────────────────────┘

                              ▼

┌─────────────────────────────────────────────────────────────────────────┐
│                          ENHANCED TEASER                                │
├─────────────────────────────────────────────────────────────────────────┤
│  Your Tokyo Preview                                                     │
│  Built as a "Slow Traveler"                                             │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ BUDGET      │ PAYMENT              │ NEED TO KNOW                 │  │
│  │ $85–$180    │ Yen (¥)              │ Visa-free 90 days            │  │
│  │ per day     │ Cards + cash both    │ Low-risk destination         │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  [Day 1] Cultural Immersion...                                          │
│  [Day 2] Local Discovery...                                             │
│  [Day 3] Hidden Gems...                                                 │
│                                                                         │
│  + 4 more days                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### 1. Backend: Enhance Quick Preview Edge Function

Update `generate-quick-preview` to fetch and return practical travel data alongside the itinerary.

**Data sources:**
- **Budget**: Query `destination_cost_index` table for cost multipliers and base prices
- **Payment/Need to Know**: Call the existing `lookup-travel-advisory` function inline (or fetch from Perplexity directly)

**New response fields:**
```typescript
interface QuickPreviewResponse {
  // Existing fields
  destination: string;
  days: QuickPreviewDay[];
  totalDays: number;
  archetypeUsed: string;
  archetypeTagline: string;
  
  // New fields
  budgetEstimate?: {
    dailyLow: number;     // e.g., 85 (in USD)
    dailyHigh: number;    // e.g., 180
    currency: string;     // "USD"
    costLevel: 'budget' | 'moderate' | 'expensive' | 'luxury';
  };
  paymentInfo?: {
    localCurrency: string;      // "Yen (¥)"
    currencyCode: string;       // "JPY"
    paymentTips: string;        // "Cards + cash both common"
  };
  needToKnow?: {
    visaSummary: string;        // "Visa-free 90 days"
    safetyLevel: string;        // "low-risk"
    keyRequirement?: string;    // "Passport valid 6+ months" (optional)
  };
}
```

**Implementation approach:**
1. After AI generates itinerary, query `destination_cost_index` for budget data
2. Call Perplexity for travel advisory (cached for 12 hours)
3. Combine and return with preview response

### 2. Frontend: Update Type Definitions

Extend the `PreviewData` interface in `DestinationEntry.tsx`:

```typescript
interface PreviewData {
  destination: string;
  days: Day[];
  totalDays: number;
  archetypeUsed: string;
  archetypeTagline: string;
  // New
  budgetEstimate?: {
    dailyLow: number;
    dailyHigh: number;
    currency: string;
    costLevel: string;
  };
  paymentInfo?: {
    localCurrency: string;
    currencyCode: string;
    paymentTips: string;
  };
  needToKnow?: {
    visaSummary: string;
    safetyLevel: string;
    keyRequirement?: string;
  };
}
```

### 3. Frontend: Enhance ItineraryTeaser Component

Add a new "Trip Snapshot" bar between the header and day cards.

**New UI Section:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│  [💰 Budget]        [💳 Payment]         [📋 Need to Know]             │
│   $85–$180/day       Yen (¥)             Visa-free 90 days              │
│   moderate cost      Cards + cash        Low-risk                       │
└─────────────────────────────────────────────────────────────────────────┘
```

**Component structure:**
- Three equal columns on desktop, stacked on mobile
- Subtle glass-morphism styling to match existing teaser aesthetic
- Icons for visual hierarchy: DollarSign, CreditCard, Shield
- Fallback gracefully if data not available (don't show section)

### 4. Fallback Strategy

For destinations not in `destination_cost_index`:
- Use `_default` row values with cost_multiplier of 1.0
- Label as "Moderate" cost level

For travel advisory failures:
- Skip the needToKnow section entirely
- Don't block the preview from showing

## Files to Create/Modify

| File | Action | Changes |
|------|--------|---------|
| `supabase/functions/generate-quick-preview/index.ts` | Modify | Add budget lookup from `destination_cost_index`, add travel advisory lookup, extend response |
| `src/components/home/DestinationEntry.tsx` | Modify | Extend `PreviewData` interface, pass new fields to teaser |
| `src/components/home/ItineraryTeaser.tsx` | Modify | Add `TripSnapshotBar` section with budget, payment, need-to-know display |

## UI Design Details

**Trip Snapshot Bar Styling:**
- Background: `bg-black/30 backdrop-blur-sm` (matches existing cards)
- Border: `border border-white/20 rounded-xl`
- Grid: `grid grid-cols-1 sm:grid-cols-3 gap-3 p-4`
- Icons: Small (w-4 h-4), muted color, left of label
- Labels: `text-xs text-white/60 uppercase tracking-wide`
- Values: `text-sm text-white font-medium`
- Subtitles: `text-xs text-white/50`

**Budget Cost Level Mapping:**
| Cost Multiplier | Label | Daily Range (base) |
|-----------------|-------|--------------------|
| < 0.6 | Budget | $40–$80 |
| 0.6–0.9 | Moderate | $60–$120 |
| 0.9–1.3 | Expensive | $100–$200 |
| > 1.3 | Luxury | $150–$300+ |

**Safety Level Display:**
| Level | Display | Color |
|-------|---------|-------|
| low-risk | Low-risk | text-green-400 |
| moderate | Moderate | text-yellow-400 |
| elevated | Elevated | text-orange-400 |
| high-risk | High-risk | text-red-400 |

## Example Output (Tokyo)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  [💰 Budget]           [💳 Payment]         [📋 Need to Know]          │
│   $95–$200 / day        Yen (¥)              Visa-free 90 days          │
│   Expensive             Cards + cash ok      Low-risk                   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Performance Considerations

- **Parallel fetching**: Budget lookup and travel advisory fetch happen in parallel with AI generation
- **Caching**: Travel advisory responses are cached 12 hours (already implemented in enrichmentService)
- **Graceful degradation**: If either lookup fails, the teaser still works — just without that section
- **No blocking**: Preview generation completes even if enrichment fails

## Summary

This enhancement surfaces practical travel intelligence at the earliest touchpoint (homepage destination entry), demonstrating Voyance's value before any commitment. The information reinforces that we understand real travel concerns — not just activities, but costs, logistics, and requirements.
