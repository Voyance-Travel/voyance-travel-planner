

## Fix: Breakfast at Wrong Hotels

### Problem
On 3 of 5 days, the AI generates breakfast at a *different* hotel than the guest's own (e.g., "Grand Kitchen at Palace Hotel Tokyo" when staying at Four Seasons Otemachi). For luxury hotels with acclaimed in-house restaurants, this is illogical.

### Root Causes
1. **Prompt says "near the hotel"** — Line 281 in `meal-policy.ts` instructs: *"A real named café/restaurant near the hotel"* — not AT the hotel
2. **Standard day prompt (line 9355)** says: *"Near hotel, real restaurant name"*
3. **Departure prompts** say: *"Breakfast at hotel or nearby café"* — vague
4. **Culinary archetype explicitly bans hotel breakfast** — `archetype-constraints.ts` line 1135: *"Hotel breakfast = VIOLATION"*
5. **No post-generation check** verifies breakfast location against the guest's hotel

### Fix — Three targeted changes

**Change 1: Update breakfast prompt in `meal-policy.ts` (line 281)**

Make breakfast default to the guest's hotel restaurant, with an external option only when variety is desired:

```
BREAKFAST (MANDATORY): Prefer the hotel's own restaurant/café 
(e.g., "Breakfast at [Hotel Restaurant Name]"). For variety, 
alternate with a real named café within walking distance on 
some days — but at least 3 of every 5 days should be at the 
hotel. NEVER send the guest to a DIFFERENT hotel for breakfast.
```

**Change 2: Update standard day structure in `index.ts` (line 9355)**

Change from "Near hotel" to "At hotel restaurant or nearby café — NEVER at a different hotel":

```
1. BREAKFAST (category: "dining") — At the hotel's own restaurant 
   (preferred) or a real café nearby. NEVER at a DIFFERENT hotel's 
   restaurant. Use the hotel name: [hotelName].
```

Also update all departure day prompts (lines 8730, 8806, 8866, 9061) similarly.

**Change 3: Post-generation breakfast validator in `index.ts`**

After the category normalizer (Stage 2 area), add a pass that checks breakfast activities for other hotel names:

```typescript
// Post-generation: fix breakfast at wrong hotel
const HOTEL_KEYWORDS = /\b(hotel|palace|hyatt|marriott|hilton|ritz|aman|mandarin|peninsula|shangri|intercontinental|westin|sheraton|conrad|waldorf|st\.?\s*regis|four\s*seasons|park\s*hyatt|andaz|w\s+hotel)\b/i;

for (const day of allDays) {
  for (const act of day.activities || []) {
    const title = (act.title || '').toLowerCase();
    const isBreakfast = title.includes('breakfast') && 
      (act.category || '').toLowerCase() === 'dining';
    if (!isBreakfast || !hotelName) continue;
    
    const hotelNameLower = hotelName.toLowerCase();
    const mentionsOtherHotel = HOTEL_KEYWORDS.test(title) && 
      !title.includes(hotelNameLower.split(' ').slice(-2).join(' '));
    
    if (mentionsOtherHotel) {
      act.title = `Breakfast at ${hotelName}`;
      act.description = `Start the morning at your hotel's restaurant.`;
      if (act.location) act.location.name = hotelName;
      console.log(`[Breakfast fix] Changed "${title}" → "Breakfast at ${hotelName}"`);
    }
  }
}
```

**Change 4: Soften culinary archetype constraint in `archetype-constraints.ts`**

Change line 1135 from blanket "Hotel breakfast = VIOLATION" to:
```
Hotel breakfast at budget/chain hotels = VIOLATION (unless exceptional).
Luxury hotel restaurants (Four Seasons, Aman, Park Hyatt, etc.) are 
ACCEPTABLE and often PREFERRED for breakfast.
```

### Result

| Before | After |
|--------|-------|
| Day 3: "Grand Kitchen at Palace Hotel Tokyo" | "Breakfast at Four Seasons Otemachi" |
| Day 4: "The Restaurant by Aman Tokyo" | "Breakfast at Four Seasons Otemachi" |
| Day 5: generic "a kissaten" placeholder | "Breakfast at Four Seasons Otemachi" |
| Culinary archetype bans all hotel breakfast | Luxury hotel breakfast is preferred |

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/meal-policy.ts` | Update breakfast instruction to prefer hotel restaurant |
| `supabase/functions/generate-itinerary/index.ts` | Update day structure prompt + departure prompts; add post-gen breakfast validator |
| `supabase/functions/generate-itinerary/archetype-constraints.ts` | Soften hotel breakfast prohibition for luxury hotels |

