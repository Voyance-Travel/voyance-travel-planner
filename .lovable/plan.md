

# Fix: Hotels Matched to Your DNA - Card Layout

## Problems (from screenshot)
1. Hotel name and "Top Pick" badge share a line, causing the name to truncate badly
2. "Book on Booking.com" link text gets clipped on the right edge
3. DNA match score percentage appears to be pushed off-screen or missing
4. Overall card feels cramped with the horizontal image + content + score layout competing for limited width in a 560px dialog

## Solution

### File: `src/components/itinerary/FindMyHotelsDrawer.tsx`

**Restructure the HotelRecommendationCard layout:**

1. **Stack "Top Pick" badge above the hotel name** instead of inline with it -- prevents name truncation
2. **Move match score below the name/neighborhood block** instead of floating top-right -- avoids horizontal squeeze  
3. **Allow hotel name to wrap** (remove `truncate` class) so long names like "Holiday Inn Express & Suites Austin NW - Four Points by IHG" display fully
4. **Widen the dialog slightly** from `sm:max-w-[560px]` to `sm:max-w-[600px]` for breathing room
5. **Prevent "Book on Booking.com" from truncating** by ensuring the actions row doesn't overflow -- use `flex-wrap` or adjust spacing

### Specific Changes

**Card header area (lines 387-414):**
- Remove the side-by-side layout between name and match score
- Place "Top Pick" badge on its own line above the name
- Show hotel name without `truncate` (allow wrapping)
- Move the match score to sit next to stars + price row

**Actions row (lines 444-472):**
- Add `flex-wrap` or reduce gap to prevent the booking link from being clipped
- Ensure "Book on Booking.com" text stays visible with `whitespace-nowrap` and the container allows overflow scrolling or wrapping

**Dialog width (line 212):**
- Increase from `sm:max-w-[560px]` to `sm:max-w-[620px]`

### Result
- Hotel names display in full, even long ones like chain hotels
- Match score is always visible
- Booking link never gets cut off
- Cards feel spacious and scannable

