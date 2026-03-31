

## Fix: Restaurant Repetition Across Days

### Problem
Same restaurants appear on multiple days because name normalization doesn't handle common variations:
- "Facil" vs "Facil (2 Michelin Stars)" — parentheticals not stripped
- "Cocolo Ramen" vs "Cocolo Ramen Restaurant" — trailing type suffixes not stripped
- "Benedict" appearing on consecutive days — AI ignores blocklist, and post-generation dedup normalization misses the match

### Root Cause Analysis
Three normalization functions are involved, with inconsistent coverage:

1. **`extractRestaurantVenueName`** (generation-utils.ts) — strips meal prefixes but NOT parentheticals or trailing suffixes like "Restaurant"
2. **`normalizeForDedup`** (repair-day.ts, local) — strips meal prefixes and punctuation but NOT parentheticals or trailing type suffixes
3. **`normalizeVenueName`** (generation-utils.ts) — strips punctuation only

None of them strip `(2 Michelin Stars)`, `Restaurant`, `Café`, `Bar & Grill` etc., so "Facil" and "Facil (2 Michelin Stars)" are treated as different venues.

### Fix

**File: `supabase/functions/generate-itinerary/generation-utils.ts`**

Enhance `extractRestaurantVenueName` to strip parentheticals and trailing venue-type suffixes. This is the canonical normalizer used by validate-day, compile-prompt, and the used_restaurants tracker:

```typescript
export function extractRestaurantVenueName(title: string): string {
  let name = title
    .replace(/^(breakfast|brunch|lunch|dinner|supper)\s+at\s+/i, '')
    .replace(/^(breakfast|brunch|lunch|dinner|supper)\s*[:–—-]\s*/i, '')
    // NEW: Strip parentheticals like "(2 Michelin Stars)", "(Kreuzberg)"
    .replace(/\s*\(.*?\)\s*/g, ' ')
    // NEW: Strip trailing venue-type suffixes
    .replace(/\s+(?:restaurant|ristorante|trattoria|osteria|brasserie|bistro|café|cafe|bar(?:\s*&\s*grill)?|gastropub|pub|eatery|kitchen|diner|grill|steakhouse|pizzeria|bakery|patisserie|konditorei)$/i, '')
    .trim();

  return normalizeVenueName(name);
}
```

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`**

Replace the local `normalizeForDedup` with the canonical `extractRestaurantVenueName` from generation-utils. This ensures repair-day uses the same normalization as validate-day and compile-prompt. Around line 178:

```typescript
// BEFORE (local function):
const normalizeForDedup = (name: string): string => { ... };

// AFTER (use canonical normalizer):
const normalizeForDedup = extractRestaurantVenueName;
```

This requires adding `extractRestaurantVenueName` to the existing imports from `../generation-utils.ts` at the top of repair-day.ts.

**File: `supabase/functions/generate-itinerary/action-generate-trip-day.ts`**

The used_restaurants accumulation (lines 1132-1146) already uses `extractRestaurantVenueName` — this will automatically benefit from the enhanced normalization. No changes needed here.

### Summary

| File | Change |
|---|---|
| `generation-utils.ts` | Enhance `extractRestaurantVenueName` to strip parentheticals and trailing venue-type suffixes |
| `repair-day.ts` | Replace local `normalizeForDedup` with canonical `extractRestaurantVenueName` for consistent matching |

