

## Fix: Duplicate Variable Declaration Crashing `generate-itinerary`

### Problem
The `generate-itinerary` edge function returns **503** because it fails to boot with:
> `SyntaxError: Identifier 'hn' has already been declared` at `repair-day.ts:518`

Lines 541 and 549 both declare `const hn = hotelName || 'Your Hotel';` in the same block scope (the `if (!hasCheckIn)` block). The first declaration on line 541 is sufficient; the second on line 549 is a duplicate that was likely introduced during a previous edit.

### Fix

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`**

Remove line 549 (`const hn = hotelName || 'Your Hotel';`). The identical declaration on line 541 already covers this. No other changes needed.

| File | Change |
|---|---|
| `pipeline/repair-day.ts` | Delete duplicate `const hn` on line 549 |

### Result
The edge function will boot successfully and itinerary generation will work again.

