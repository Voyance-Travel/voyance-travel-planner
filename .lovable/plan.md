

## Fix: `hotelList is not defined` Crashing Itinerary Generation

### Problem

The edge function `action-generate-trip-day.ts` has a scoping bug. `hotelList` is declared inside an `if (tripCheck?.hotel_selection)` block (line 190), but referenced **outside** that block at line 225. When a trip has no `hotel_selection` (null/undefined), the `if` block is skipped entirely, `hotelList` is never declared, and line 225 throws `ReferenceError: hotelList is not defined`. This crashes every generation attempt — all 3 retries fail with the same error.

The SVG `<circle>` attribute warnings (`cx`/`cy` undefined) are a cosmetic framer-motion issue in `GenerationAnimation.tsx` — they do not cause crashes and are low-priority.

### Fix

**File: `supabase/functions/generate-itinerary/action-generate-trip-day.ts`**

Move the `hotelList` declaration **outside** the `if (tripCheck?.hotel_selection)` block so it's always in scope, defaulting to an empty array:

1. Declare `let hotelList: any[] = [];` before the `if` block (before line 188)
2. Inside the `if` block, change `const hotelList` to reassign: `hotelList = Array.isArray(hs) ? hs : ...`

This ensures the split-stay detection at line 225 safely sees an empty array when there's no hotel selection, instead of crashing.

### Specific Changes

**Line ~186-190 — Before:**
```typescript
let tripHotelName: string | undefined;
let tripHotelAddress: string | undefined;
if (tripCheck?.hotel_selection) {
  const hs = tripCheck.hotel_selection as any;
  const hotelList: any[] = Array.isArray(hs) ? hs : (typeof hs === 'object' && hs?.name ? [hs] : []);
```

**After:**
```typescript
let tripHotelName: string | undefined;
let tripHotelAddress: string | undefined;
let hotelList: any[] = [];
if (tripCheck?.hotel_selection) {
  const hs = tripCheck.hotel_selection as any;
  hotelList = Array.isArray(hs) ? hs : (typeof hs === 'object' && hs?.name ? [hs] : []);
```

### Impact
- Fixes the crash that blocks ALL itinerary generation for trips without hotel selection
- Single 2-line edit in `action-generate-trip-day.ts`
- No behavioral change when `hotel_selection` exists (same array is built)
- The SVG circle warnings are cosmetic and do not need fixing

