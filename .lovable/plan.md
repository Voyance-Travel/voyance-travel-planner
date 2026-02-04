
# Fix: Activity Images Showing Wrong Photos

## Problem Summary

Activity cards in the itinerary are showing completely wrong images:
- **"Park Hyatt Tokyo" (DINING)** → Shows people doing yoga/stretching
- **"Hotel Checkout"** → Shows a swimming pool

## Root Cause Analysis

### Issue 1: Dining Activities at Hotels Get Wrong Search Hints
When an activity like "Relaxed Morning and Breakfast at Hotel" has:
- `category: dining` 
- `location.name: "Park Hyatt Tokyo"`

The frontend sends `imageSearchTerm = "Park Hyatt Tokyo"` with `category = "dining"`. The backend then adds a "restaurant" hint to the search query:

```
Search query: "Park Hyatt Tokyo restaurant Tokyo"
```

This returns irrelevant results because Google/TripAdvisor is looking for a *restaurant* called "Park Hyatt Tokyo".

### Issue 2: TripAdvisor Fallback Returns Unrelated Images
The backend logs show:
```
entity_key: "relaxed morning and breakfast at hotel"
alt_text: "Tokyo Sumo Morning Practice Tour at Stable"
```

When Google Places filtering rejects results (due to low match score), TripAdvisor returns the first match which can be completely unrelated.

### Issue 3: Insufficient Validation in Backend
The TripAdvisor tier (Tier 3) lacks the match score validation that exists in Google Places (Tier 2). It blindly accepts the first result without checking if it's actually relevant to the search query.

---

## Solution: Multi-Layer Fix

### Fix 1: Frontend - Detect "Hotel Dining" Activities
Update `EditorialItinerary.tsx` to detect when a dining activity is at a hotel, and use the hotel image instead of searching for a "restaurant".

```
┌─────────────────────────────────────────────────────────────┐
│  Is category "dining" AND location.name contains "hotel"?  │
│       ↓ Yes                      ↓ No                       │
│  Use hotel search term       Use dining search term         │
│  (e.g. "Park Hyatt Tokyo     (normal restaurant search)     │
│   hotel")                                                   │
└─────────────────────────────────────────────────────────────┘
```

### Fix 2: Backend - Add Match Score Validation to TripAdvisor
Apply the same tokenization and match scoring logic that exists for Google Places to the TripAdvisor tier. Reject results with low similarity scores.

### Fix 3: Backend - Improve Skip Patterns for Hotel Activities
Add patterns to detect "breakfast/lunch/dinner at hotel" activities and use the `accommodation` category for image search instead of `dining`.

---

## Technical Changes

### File: `src/components/itinerary/EditorialItinerary.tsx`

**Location**: Lines ~4858-4884 (ActivityCard component)

Add detection for hotel dining activities:

```typescript
// Detect if this is a dining activity AT a hotel (breakfast at hotel, etc.)
const isHotelDiningActivity = isDiningActivity && 
  activity.location?.name?.toLowerCase().includes('hotel');

// For hotel dining activities, search for the hotel image instead of restaurant
const effectiveSearchTerm = isHotelDiningActivity
  ? `${activity.location?.name} hotel`
  : imageSearchTerm;

const effectiveCategory = isHotelDiningActivity
  ? 'accommodation'
  : (isHotelActivity ? 'accommodation' : activityType);

// Updated hook call
const { imageUrl: fetchedImageUrl, loading: imageLoading } = useActivityImage(
  isHotelActivity && hasHotelName ? `${hotelName} hotel` : effectiveSearchTerm,
  effectiveCategory,
  existingPhoto,
  shouldFetchRealPhoto ? destination : undefined,
  activity.id
);
```

### File: `supabase/functions/destination-images/index.ts`

**Change 1**: Update skip patterns (~line 648) to catch hotel dining activities:

```typescript
// In skipPatterns array, add:
/^(?:relaxed|leisurely|early|late)?\s*(?:morning|afternoon|evening)?\s*(?:and\s+)?(?:breakfast|brunch|lunch|dinner)\s+(?:at\s+)?(?:the\s+)?hotel/i,
/^(?:breakfast|brunch|lunch|dinner|meal)\s+at\s+(?:the\s+)?(?:hotel|resort|inn|lodge)/i,
```

**Change 2**: Add match score validation to TripAdvisor tier (~line 348-413):

```typescript
async function getTripAdvisorPhoto(
  venueName: string,
  destination: string,
  apiKey: string
): Promise<DestinationImage | null> {
  try {
    const searchQuery = `${venueName} ${destination}`;
    // ... existing search code ...

    const location = searchData.data?.[0];
    if (!location?.location_id) return null;

    // NEW: Validate the result matches our query
    const venueTokens = new Set(tokenize(venueName));
    const locationName = location.name || '';
    const matchScore = calculateMatchScore(venueTokens, locationName);
    
    const MIN_MATCH_SCORE = 0.3; // Lower threshold than Google since TripAdvisor is a fallback
    
    if (matchScore < MIN_MATCH_SCORE) {
      console.log(`[Images] Rejecting TripAdvisor result (low score ${matchScore.toFixed(2)}): ${locationName}`);
      return null;
    }

    // ... continue with photo fetch ...
  }
}
```

**Change 3**: Add hotel keyword detection in extractVenueName (~line 693):

```typescript
// After existing extractPatterns, add hotel dining detection:
const hotelDiningMatch = title.match(/(?:breakfast|brunch|lunch|dinner)\s+(?:at\s+)?(.+?\s+(?:hotel|resort|inn|hyatt|hilton|marriott|sheraton|ritz|intercontinental))/i);
if (hotelDiningMatch) {
  return { 
    cleanName: hotelDiningMatch[1].trim(), 
    shouldSkip: false, 
    inferredCategory: 'accommodation' // Use hotel category instead of dining
  };
}
```

---

## Files to Change

| File | Changes |
|------|---------|
| `src/components/itinerary/EditorialItinerary.tsx` | Detect hotel dining activities and use accommodation category for image search |
| `supabase/functions/destination-images/index.ts` | Add skip patterns for hotel dining, add match validation to TripAdvisor, improve hotel detection |

---

## Data Cleanup

After deploying the fix, run this query to clear bad cached images:

```sql
-- Delete cached images with mismatched content (sumo, yoga, etc. for hotel activities)
DELETE FROM curated_images
WHERE entity_key ILIKE '%breakfast%hotel%'
   OR entity_key ILIKE '%relaxed morning%'
   OR entity_key ILIKE '%morning%breakfast%';
```

---

## Impact

- **Fixes wrong images** for dining activities at hotels
- **Prevents future bad caching** by validating TripAdvisor results
- **Improves image relevance** by using accommodation category for hotel activities
- **No breaking changes** - existing correct caches remain valid
