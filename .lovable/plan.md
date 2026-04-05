

## Fix: Breakfast on Hotel-Change Day References Wrong Hotel

### Problem
On a hotel-change day (e.g., Four Seasons → Palácio Ludovice), the AI generates "Breakfast at Palácio Ludovice" even though the traveler wakes up at the Four Seasons and eats breakfast there before checking out. The accommodation title normalization (Step 9b) correctly assigns pre-checkout accommodation cards to the previous hotel, but **breakfast is a `dining` category activity** — it's skipped entirely by the normalization loop (line 1364: `if (cat !== 'accommodation') continue`).

### Fix

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`** — Step 9b (Accommodation Title Normalization, ~line 1342)

After the existing accommodation normalization loop, add a **dining normalization pass** for hotel-change days. On hotel-change days, any dining activity that references a hotel name in its title (e.g., "Breakfast at X") and appears before checkout should have its hotel reference updated to the previous hotel name.

```typescript
// After the accommodation normalization loop (~line 1407), add:
// --- 9b-ii. DINING HOTEL REFERENCE on hotel-change days ---
// Breakfast (and other dining) before checkout should reference the previous hotel
if (isHotelChange && checkoutIdx >= 0 && previousHotelName) {
  const newHotelLower = (hotelName || '').toLowerCase();
  const newHotelCore = normalizeHotelCore(hotelName || '');

  for (let i = 0; i < checkoutIdx; i++) {
    const act = activities[i];
    const cat = (act.category || '').toLowerCase();
    if (cat !== 'dining' && cat !== 'restaurant' && cat !== 'food') continue;

    const title = act.title || act.name || '';
    const titleLower = title.toLowerCase();

    // Check if this dining activity references the NEW hotel (wrong)
    const refsNewHotel = titleLower.includes(newHotelLower) ||
      (newHotelCore && titleLower.includes(newHotelCore));
    // Or references any generic hotel
    const refsGenericHotel = titleLower.includes('your hotel') ||
      titleLower.includes('the hotel');

    if (refsNewHotel || refsGenericHotel) {
      // Replace hotel reference with previous hotel
      let newTitle = title;
      if (refsNewHotel) {
        // Replace new hotel name with previous hotel name (case-insensitive)
        newTitle = title.replace(new RegExp(escapeRegExp(hotelName || ''), 'gi'), previousHotelName);
      } else {
        newTitle = title.replace(/your hotel|the hotel/gi, previousHotelName);
      }
      act.title = newTitle;
      act.name = newTitle;

      // Fix location too
      if (act.location?.name) {
        const locLower = act.location.name.toLowerCase();
        if (locLower.includes(newHotelLower) || locLower === 'your hotel') {
          act.location.name = previousHotelName;
        }
      }

      repairs.push({
        code: FAILURE_CODES.MISSING_SLOT,
        action: 'fixed_pre_checkout_dining_hotel_ref',
        before: title,
        after: newTitle,
      });
    }
  }
}
```

A small `escapeRegExp` helper will be needed (or inline the escape).

### Impact
- Breakfast on hotel-change days correctly references the departing hotel (e.g., "Breakfast at Four Seasons" instead of "Breakfast at Palácio Ludovice")
- Other pre-checkout dining that references the hotel is also corrected
- Post-checkout dining is unaffected (correctly references the new hotel)
- Single file change, added after existing normalization block

### Files
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — add pre-checkout dining hotel reference fix in Step 9b

