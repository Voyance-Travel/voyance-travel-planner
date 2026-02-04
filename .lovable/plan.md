
# Comprehensive Image Quality Assurance Plan

## ✅ IMPLEMENTED (2025-02-04)

## Problem Summary

The image pipeline has multiple points where wrong/irrelevant images can slip through and appear in production:

1. **Destination Hero Images** - Wrong photos (canyons for Paris, etc.)
2. **Activity Images** - Mismatched images (yoga for hotel dining, sumo for breakfast)
3. **Cached Bad Data** - 137+ entries in `curated_images` table with mismatched content
4. **Weak Validation** - Match scoring exists but thresholds may be too permissive

## Current Image Resolution Chain

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        HERO / DESTINATION IMAGES                         │
├─────────────────────────────────────────────────────────────────────────┤
│ 1. Seeded Metadata (trip.metadata.hero_image)                           │
│ 2. Curated Local (CURATED_DESTINATION_IMAGES in destinationImages.ts)   │
│ 3. API Fetch (destination-images edge function)                         │
│ 4. Gradient Fallback (deterministic SVG)                                │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                          ACTIVITY IMAGES                                 │
├─────────────────────────────────────────────────────────────────────────┤
│ 1. Existing Photo (activity.photoUrl)                                    │
│ 2. Database Cache (curated_images table)                                │
│ 3. Google Places API (with match scoring)                               │
│ 4. TripAdvisor API (with match scoring)                                 │
│ 5. Wikimedia Commons                                                     │
│ 6. AI Generation (Lovable AI)                                           │
│ 7. Category Fallback (curated Unsplash by category)                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Root Causes of Bad Images

| Issue | Where | Impact |
|-------|-------|--------|
| Low match score threshold | Backend (0.3-0.4) | Allows weak matches through |
| Cached bad images | Database (137+) | Served from cache before validation |
| Generic activity titles | Frontend/Backend | "Breakfast at Hotel" returns irrelevant results |
| Missing category awareness | Cache lookup | Doesn't validate category matches content |
| No image content validation | All tiers | Can't detect if image shows wrong subject |

---

## Solution: Multi-Layer Quality Assurance

### Layer 1: Database Cleanup (Immediate)

Delete all suspicious cached images:

```sql
DELETE FROM curated_images
WHERE 
  -- Content clearly mismatches common activity types
  (entity_key ILIKE '%breakfast%' AND alt_text ILIKE '%sumo%')
  OR (entity_key ILIKE '%breakfast%' AND alt_text ILIKE '%yoga%')
  OR (entity_key ILIKE '%hotel%' AND alt_text ILIKE '%sumo%')
  OR (entity_key ILIKE '%hotel%' AND alt_text ILIKE '%yoga%')
  OR (entity_key ILIKE '%hotel%' AND alt_text ILIKE '%canyon%')
  OR (entity_key ILIKE '%hotel%' AND alt_text ILIKE '%swimming%')
  OR (entity_key ILIKE '%checkout%' AND alt_text NOT ILIKE '%hotel%')
  OR (entity_key ILIKE '%check-out%' AND alt_text NOT ILIKE '%hotel%')
  -- City/destination mismatches
  OR (destination = 'Paris' AND (alt_text ILIKE '%NYC%' OR alt_text ILIKE '%canyon%'))
  OR (destination = 'Tokyo' AND alt_text ILIKE '%sumo%' AND entity_key NOT ILIKE '%sumo%')
  -- Yoga studio results for non-yoga activities
  OR (alt_text ILIKE '%yoga studio%' AND entity_key NOT ILIKE '%yoga%' AND entity_key NOT ILIKE '%wellness%');
```

### Layer 2: Stricter Match Scoring (Backend)

Update `destination-images/index.ts` to raise thresholds:

| Source | Current | Proposed |
|--------|---------|----------|
| Google Places | 0.40 | 0.50 |
| TripAdvisor | 0.30 | 0.45 |

### Layer 3: Content Keyword Validation (Backend)

Add a validation layer that checks if the returned image's `alt_text` / `displayName` contains suspicious mismatches:

```typescript
// Reject if alt_text contains activity-type keywords that don't match the request
const MISMATCH_KEYWORDS: Record<string, string[]> = {
  'dining': ['yoga', 'sumo', 'canyon', 'hiking', 'pool', 'swimming'],
  'accommodation': ['sumo', 'canyon', 'hiking', 'wrestling'],
  'breakfast': ['yoga', 'sumo', 'canyon', 'tour', 'wrestling'],
};

function hasMismatchedContent(category: string, altText: string): boolean {
  const forbidden = MISMATCH_KEYWORDS[category] || [];
  const lower = altText.toLowerCase();
  return forbidden.some(kw => lower.includes(kw));
}
```

### Layer 4: Cache Validation on Read (Backend)

When reading from cache, validate the cached entry makes sense for the request:

```typescript
// In checkCuratedCache()
// After finding a cached entry, validate it matches the expected category
if (entityType === 'activity' && category) {
  const altLower = (pick.alt_text || '').toLowerCase();
  if (hasMismatchedContent(category, altLower)) {
    console.log(`[Images] Cache entry rejected (content mismatch): ${pick.alt_text}`);
    // Optionally: mark for deletion
    return null;
  }
}
```

### Layer 5: Frontend Image Verification (Frontend)

Add an `onError` handler that falls back gracefully when images fail to load:

This is already implemented in `useTripHeroImage` and `useActivityImage` but can be enhanced to detect invalid image dimensions or broken URLs.

---

## Files to Change

| File | Changes |
|------|---------|
| `supabase/functions/destination-images/index.ts` | Raise match thresholds, add content mismatch validation |
| Database | Delete 137+ bad cached images |

---

## Technical Details

### destination-images/index.ts Changes

**1. Raise match thresholds:**

```typescript
// Line ~226: Google Places threshold
const MIN_MATCH_SCORE = 0.50; // Was 0.40

// Line ~383: TripAdvisor threshold
const MIN_MATCH_SCORE = 0.45; // Was 0.30
```

**2. Add mismatch keyword detection (~after line 188):**

```typescript
// Keywords that indicate a mismatch between activity category and image content
const CATEGORY_MISMATCH_KEYWORDS: Record<string, string[]> = {
  'dining': ['yoga', 'sumo', 'canyon', 'hiking', 'pool', 'swimming', 'wrestling', 'gym'],
  'breakfast': ['yoga', 'sumo', 'canyon', 'hiking', 'tour', 'wrestling', 'gym'],
  'lunch': ['yoga', 'sumo', 'canyon', 'hiking', 'tour', 'wrestling', 'gym'],
  'dinner': ['yoga', 'sumo', 'canyon', 'hiking', 'tour', 'wrestling', 'gym'],
  'accommodation': ['sumo', 'canyon', 'hiking', 'wrestling', 'restaurant', 'cafe'],
  'hotel': ['sumo', 'canyon', 'hiking', 'wrestling', 'restaurant', 'cafe'],
  'cafe': ['sumo', 'canyon', 'hiking', 'wrestling', 'gym'],
};

function hasMismatchedContent(category: string, altTextOrName: string): boolean {
  const cat = category.toLowerCase();
  const text = altTextOrName.toLowerCase();
  
  for (const [catKey, forbidden] of Object.entries(CATEGORY_MISMATCH_KEYWORDS)) {
    if (cat.includes(catKey)) {
      for (const kw of forbidden) {
        if (text.includes(kw)) {
          console.log(`[Images] Content mismatch detected: category=${cat}, found keyword="${kw}" in "${altTextOrName}"`);
          return true;
        }
      }
    }
  }
  return false;
}
```

**3. Apply mismatch check in Google Places (~line 288):**

```typescript
// After match score check, before accepting
if (hasMismatchedContent(category || 'activity', displayName)) {
  console.log(`[Images] Rejecting (content mismatch):`, displayName);
  continue;
}
```

**4. Apply mismatch check in TripAdvisor (~line 386):**

```typescript
// After match score check
if (hasMismatchedContent(category || 'activity', locationName)) {
  console.log(`[Images] Rejecting TripAdvisor (content mismatch): ${locationName}`);
  return null;
}
```

**5. Apply mismatch check in cache lookup (~line 88):**

```typescript
// When finding cached entries, validate content matches category
const pick = data.find((row: any) => {
  if (entityType !== "destination") {
    // For activities, validate content doesn't mismatch category
    const alt = String(row.alt_text || "").toLowerCase();
    const key = String(row.entity_key || "").toLowerCase();
    
    // Existing airport filter
    if (entityType === 'destination' && (alt.includes("airport") || key.includes("airport"))) {
      return false;
    }
    
    // NEW: Category mismatch filter
    if (entityType === 'activity' && category) {
      if (hasMismatchedContent(category, alt)) {
        return false;
      }
    }
  }
  return true;
});
```

---

## Database Cleanup Query

```sql
-- Comprehensive cleanup of mismatched cached images
DELETE FROM curated_images
WHERE 
  -- Breakfast/dining with wrong content
  ((entity_key ILIKE '%breakfast%' OR entity_key ILIKE '%lunch%' OR entity_key ILIKE '%dinner%' OR entity_key ILIKE '%dining%')
   AND (alt_text ILIKE '%sumo%' OR alt_text ILIKE '%yoga%' OR alt_text ILIKE '%canyon%' OR alt_text ILIKE '%wrestling%' OR alt_text ILIKE '%gym%'))
  -- Hotel with wrong content  
  OR ((entity_key ILIKE '%hotel%' OR entity_key ILIKE '%check%')
   AND (alt_text ILIKE '%sumo%' OR alt_text ILIKE '%yoga%' OR alt_text ILIKE '%canyon%' OR alt_text ILIKE '%wrestling%' OR alt_text ILIKE '%swimming%' AND alt_text NOT ILIKE '%pool%'))
  -- Yoga studio results for non-yoga activities
  OR (alt_text ILIKE '%yoga studio%' AND entity_key NOT ILIKE '%yoga%' AND entity_key NOT ILIKE '%wellness%' AND entity_key NOT ILIKE '%morning wellness%')
  -- Destination mismatches (Paris with canyon, etc.)
  OR (destination ILIKE 'Paris' AND (alt_text ILIKE '%canyon%' OR alt_text ILIKE '%NYC%' OR alt_text ILIKE '%new york%'))
  OR (destination ILIKE 'London' AND (alt_text ILIKE '%canyon%' OR alt_text ILIKE '%NYC%'))
  OR (destination ILIKE 'Rome' AND (alt_text ILIKE '%canyon%' OR alt_text ILIKE '%NYC%'))
  OR (destination ILIKE 'Tokyo' AND alt_text ILIKE '%sumo%' AND entity_key NOT ILIKE '%sumo%');
```

---

## Impact

- **Immediate**: Removes 137+ bad cached images from database
- **Ongoing**: Higher match thresholds prevent low-quality matches
- **Defense in Depth**: Content mismatch detection catches semantically wrong results
- **Backward Compatible**: Falls back to category images when validation fails (always shows something reasonable)

---

## Testing Recommendations

1. Clear cache and regenerate images for a Tokyo trip with "Breakfast at Hotel" activity
2. Verify Paris trip hero image shows Eiffel Tower / Paris landmarks
3. Check that activities like "Morning Wellness" show appropriate spa/relaxation images
4. Confirm hotel checkout activities show hotel exterior/lobby images
