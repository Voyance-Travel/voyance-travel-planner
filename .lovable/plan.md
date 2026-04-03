

## Fix: Transit Cards Between Same-Location & In-Hotel Venues

### Problem
When a restaurant or venue is inside the hotel (e.g., "Varanda Restaurant at Four Seasons Ritz"), the repair pipeline injects a "Travel to Varanda Restaurant at Four Seasons Ritz" transport card with 30-50 minute transit estimates. The traveler is already there — this is nonsensical.

### Root Cause
In `repair-day.ts` line 1417, the transit gap injection uses **strict equality** to detect same-location activities:
```typescript
if (!cLoc || !nLoc || cLoc === nLoc) continue;
```
"four seasons ritz" ≠ "varanda restaurant at four seasons ritz", so a transit card is injected. The frontend `isFuzzyLocationMatch` does substring matching but can't help — the transport card is already baked into the itinerary server-side.

### Fix — Two layers

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`**

#### 1. Replace strict equality with fuzzy/substring matching in transit gap injection (~line 1414-1417)

Add a helper `isSameOrContainedLocation(a, b)` that returns true if:
- Exact match (current behavior)
- Either name is a substring of the other (catches "Four Seasons Ritz" inside "Varanda Restaurant at Four Seasons Ritz")
- Either location contains the hotel name (catches hotel restaurants, hotel bars, hotel spas)
- Both share the same street address (if available)

Apply this check in the transit gap guard (line 1417) and also in the orphaned transport dedup (line 1466).

#### 2. Also suppress transit injection when next activity is at the hotel

After the `isSameOrContainedLocation` check, add a guard: if the current activity is accommodation-category (check-in, freshen up, return to hotel) and the next activity's location name contains the hotel name, skip transit injection. The traveler is at the hotel and doesn't need transit to a hotel venue.

### Helper function

```typescript
function isSameOrContainedLocation(aLoc: string, bLoc: string, hotel?: string): boolean {
  if (!aLoc || !bLoc) return false;
  if (aLoc === bLoc) return true;
  // Substring: "four seasons ritz" ⊂ "varanda restaurant at four seasons ritz"
  if (aLoc.length >= 4 && bLoc.length >= 4) {
    if (aLoc.includes(bLoc) || bLoc.includes(aLoc)) return true;
  }
  // Both reference the hotel
  if (hotel) {
    const h = hotel.toLowerCase();
    if (aLoc.includes(h) && bLoc.includes(h)) return true;
    // One IS the hotel and the other contains the hotel name
    if ((aLoc === h || bLoc === h) && (aLoc.includes(h) || bLoc.includes(h))) return true;
  }
  return false;
}
```

### Files changed
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — add fuzzy location helper, update transit gap guard and orphaned transport dedup

