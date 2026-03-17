

## Fix: Curated Images Still Not Matching — The Edge Function Has the Same Blind Spot

### What I Found

The frontend `useActivityImage.ts` was fixed last time to search `alt_text`. But that fix only helps when the frontend reaches tier 4 (curated_images query). There are **two other paths that ALSO query `curated_images` and still use `entity_key` exact match only**:

**Path A — Edge function `destination-images/index.ts` (called as tier 5 fallback from frontend, AND during backend generation)**

Line 69 of `checkCuratedCache`:
```typescript
.eq("entity_key", normalizedKey)   // ← EXACT MATCH ONLY
```

This means: when the frontend falls through to the edge function, OR when the backend generates a new itinerary, the curated cache check **also misses all 3,758 Place ID-keyed rows**. The edge function then makes a paid Google Places API call to fetch the same photo that's already in your CDN.

**Path B — Backend `generate-itinerary/index.ts` Stage 4 enrichment**

Calls `destination-images` edge function via HTTP, which hits the same broken `checkCuratedCache`.

### Data Impact

| Source | Rows | entity_key format | Searchable by name? |
|--------|------|-------------------|---------------------|
| google_places_cached | 4,316 | Place ID (`chij...`) | Only via `alt_text` |
| google_places (live) | 4,183 | Venue name | Yes |
| tripadvisor | 1,676 | Mixed | Mostly via `alt_text` |
| **Total invisible** | **~3,758** | Place ID keys | **No — missed by edge function** |

### The Fix

**1. `supabase/functions/destination-images/index.ts` — `checkCuratedCache` function**

Add `alt_text` fuzzy search as a fallback when exact `entity_key` match returns nothing:

```typescript
// Current (line 64-69): exact entity_key match only
.eq("entity_key", normalizedKey)

// New: Try exact first, then fall back to alt_text search
// First query: exact entity_key (fast, indexed)
// If no results: second query with alt_text ilike
```

This is the single change that unlocks curated photos for both frontend fallback AND backend generation.

**2. `src/hooks/useActivityImage.ts` — Harden the `.or()` filter**

The current `.or()` filter may break with multi-word venue names due to PostgREST parsing. Wrap the clean title to avoid comma/space ambiguity in the filter string.

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `supabase/functions/destination-images/index.ts` | Add `alt_text` fallback search in `checkCuratedCache` when exact key match returns 0 |
| 2 | `src/hooks/useActivityImage.ts` | Harden `.or()` filter syntax for multi-word names |

Per your preference: existing trip photos stay untouched. These fixes apply to new generations and future image lookups only.

