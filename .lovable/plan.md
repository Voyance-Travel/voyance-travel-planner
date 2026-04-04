

## Fix: Missing Transport Card After Hotel Return

### Root Cause

The `isSameOrContainedLocation` function in `repair-day.ts` (line 2087) has a logic error that causes false-positive "same location" matches whenever **one** of the two locations is the hotel:

```typescript
// Line 2087 — BUGGY
if (h.length >= 4 && (aLoc === h || bLoc === h) && (aLoc.includes(h) || bLoc.includes(h))) return true;
```

The second condition uses `||` (OR) instead of `&&` (AND). When `aLoc === h` (e.g., "palácio ludovice"), the OR condition is automatically true regardless of `bLoc`. This means **any pair where one location is the hotel** is treated as "same location."

**What happens during generation:**
1. Step 3 (transit gap injection) correctly injects a "Travel to Belcanto" card between "Return to Palácio Ludovice" and "Dinner: Belcanto"
2. Step 4b (orphaned transport removal) checks if the preceding non-transport activity ("Return to Palácio Ludovice") is at the same location as the transport's destination ("Belcanto")
3. `isSameOrContainedLocation("palácio ludovice", "belcanto", "Palácio Ludovice")` → the buggy line 2087 returns `true` because `aLoc === h`
4. The transport card is **incorrectly removed** as "orphaned"

This bug affects ALL departures from the hotel — any transport card leaving the hotel toward a different venue gets stripped.

### Fix

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`** — line 2087

Remove the buggy second hotel check. It's redundant with line 2086 when corrected (changing OR to AND produces the same condition as line 2086), so the simplest fix is to delete it entirely:

```text
Before (lines 2083-2088):
  // Both reference the hotel
  if (hotel) {
    const h = hotel.toLowerCase();
    if (h.length >= 4 && aLoc.includes(h) && bLoc.includes(h)) return true;
    if (h.length >= 4 && (aLoc === h || bLoc === h) && (aLoc.includes(h) || bLoc.includes(h))) return true;
  }

After:
  // Both reference the hotel
  if (hotel) {
    const h = hotel.toLowerCase();
    if (h.length >= 4 && aLoc.includes(h) && bLoc.includes(h)) return true;
  }
```

### Impact
- Fixes missing transport cards between hotel and any non-hotel venue (restaurants, attractions, etc.)
- Line 2086 already correctly handles the "both reference the hotel" case
- Single line deletion in `repair-day.ts`
- No behavioral change for legitimate same-location matches

