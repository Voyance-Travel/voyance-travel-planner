

## Fix: Missing Transport Cards Between Activities ("Teleportation")

### Problem
Activities frequently appear back-to-back without transport cards between them. The transit gap injection (step 3 in `repairBookends`) has several issues that cause it to skip necessary transport cards:

1. **Post-dedup gaps**: Step 9c (accommodation dedup) removes accommodation cards AND their adjacent transport cards, leaving two venue activities next to each other with no transport. But since 9c runs *after* `repairBookends`, there's no second transit gap pass to fill these new gaps.

2. **Over-aggressive location matching**: `isSameOrContainedLocation` uses substring matching (`aLoc.includes(bLoc)`), which can incorrectly match unrelated locations when one name is a common word substring of another (e.g., "The Grand" matching "The Grand Bazaar Restaurant").

3. **Empty location fallback to title**: When `location.name` is missing, the code falls back to `curr.title` — but activity titles often contain common words that trigger false substring matches, causing the guard to skip transport injection.

### Fix

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`**

1. **Add a second transit gap pass after step 9c**: After the accommodation dedup removes activities and their transports, run a lightweight transit gap scan on the resulting array. For any two adjacent non-transport activities at different locations, inject a transport card between them. This is a simple loop similar to step 3 in `repairBookends` but operating on the post-dedup activity list.

2. **Tighten `isSameOrContainedLocation`**: Add a minimum word-overlap check instead of pure substring matching. Two locations should only be considered "same" if they share significant identifying words (not just any substring match). Specifically:
   - Keep exact match (`aLoc === bLoc`)
   - For substring matching, require that the shorter string is at least 60% of the longer string's length (to avoid "spa" matching "spa resort dinner cruise")
   - Keep the hotel cross-reference check as-is

3. **Improve `recentTransport` guard**: The check at line 1925-1927 uses exact match on `location.name` — change to use `isSameOrContainedLocation` so it properly catches existing transports even with slight name variations.

### Expected behavior
- Every pair of activities at different physical locations has a transport card between them
- No more "teleportation" between venues
- Same-location activities (e.g., hotel spa after hotel check-in) still correctly skip transport

### Files changed
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — post-dedup transit gap pass + tighten location matching

