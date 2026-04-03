

## Fix: Hotel Date Boundary Mismatch in Split-Stay Trips

### Problem

When you have two hotels (split stay), Hotel 1 checkout is on Day 3 and Hotel 2 check-in is on Day 3. But the itinerary shows Hotel 2 activities starting on Day 2 instead of Day 3.

**Root cause: Three different date-matching formulas are used across the codebase, and they disagree on boundary days.**

The generation pipeline (4 locations) uses:
```
dateStr >= checkIn && dateStr < checkOut   (checkout day = NEXT hotel)
```

But the post-generation patch (`hotelItineraryPatch.ts`) uses:
```
dayDate >= checkIn && dayDate <= checkOut   (checkout day = CURRENT hotel)
```

And `patchItineraryWithMultipleHotels` uses `hotels.find()` which returns the **first match** — so on checkout day (which is also the next hotel's check-in day), whichever hotel is listed first wins.

**Example:** Hotel A: check-in May 1, checkout May 3. Hotel B: check-in May 3, checkout May 5.
- Generation correctly assigns May 2 → Hotel A, May 3 → Hotel B (using `< checkout`)
- But `patchItineraryWithMultipleHotels` runs AFTER generation and overwrites May 3 with Hotel A (because `May 3 <= May 3` matches Hotel A first)
- This also means May 2 gets patched by BOTH hotels since both ranges include it with inclusive bounds

The patch runs every time a hotel is saved, so it **overwrites the correct generation output** with wrong hotel names.

### Changes

**File: `src/services/hotelItineraryPatch.ts`**

1. **Fix `isDayInRange` boundary logic**: Change from inclusive-inclusive (`<=`) to inclusive-exclusive (`<`) on checkout date — matching the generation pipeline's convention. Checkout day belongs to the NEXT hotel, not the current one.

```typescript
// Before (wrong):
return d >= checkInDate && d <= checkOutDate;

// After (correct):  
return d >= checkInDate && d < checkOutDate;
```

2. **Special-case checkout activities on checkout day**: After fixing the range, checkout day activities (like "Checkout from Hotel A") won't be patched because that day now belongs to Hotel B. Add a targeted pass: on the checkout date specifically, only patch activities whose title contains "checkout" with the departing hotel's name.

3. **Fix `patchItineraryWithMultipleHotels` overlap resolution**: When multiple hotels match a day (shouldn't happen with fixed ranges, but as a safety net), prefer the hotel whose check-in date matches, not just the first in the array.

**File: `supabase/functions/generate-itinerary/generation-core.ts`** (line 429)

4. **Remove `|| context.startDate` fallback on `cin`**: This line defaults missing check-in dates to the trip start, which can cause Hotel 1 to match days it shouldn't when dates are partially missing.

### Expected Result
- Day 2: All accommodation activities reference Hotel A (correct — you're still staying there)
- Day 3: Checkout references Hotel A, Check-in references Hotel B
- Day 4+: All accommodation activities reference Hotel B

