

## Hotel Name Enforcement (Post-Processing)

### Problem
When no hotel is selected, `hotelName` is set to `'Your Hotel'` and the prompt tells the AI not to invent hotels. The AI ignores this and generates specific luxury hotel names (Peninsula, Four Seasons, Conrad, etc.).

### Changes

**1. `supabase/functions/generate-itinerary/sanitization.ts` — Add two new exports**

Add `enforceHotelPlaceholder(text)` and `enforceHotelPlaceholderOnDay(day)` at the end of the file:

- `KNOWN_HOTEL_BRANDS` array covering ~30 luxury chains (Peninsula, Four Seasons, Ritz-Carlton, Park Hyatt, Aman, Mandarin Oriental, Conrad, St. Regis, Waldorf Astoria, Shangri-La, Rosewood, Hoshinoya, etc.)
- `HOTEL_BRAND_RE` regex that matches brand + optional city/suffix (e.g. "The Peninsula Tokyo", "Four Seasons Hotel at Otemachi")
- `enforceHotelPlaceholder(text)` — replaces matched hotel names with "Your Hotel"
- `enforceHotelPlaceholderOnDay(day)` — walks all text fields on a day object (title, theme, narrative, accommodationNotes, practicalTips, and every activity's title/name/description/tips/voyanceInsight/bestTime/location.name/location.address/personalization.whyThisFits/transit.description/transit.to/transit.from/transportation.instructions)

**2. `supabase/functions/generate-itinerary/index.ts` — Call after each day parse (2 locations)**

At both parse sites (~line 2421 and ~line 10323), after `sanitizeGeneratedDay(...)` returns and before the existing post-processing block (line ~2554), add:

```typescript
if (!dayCity?.hotelName || dayCity.hotelName === 'Your Hotel') {
  generatedDay = enforceHotelPlaceholderOnDay(generatedDay);
}
```

This uses the already-available `dayCity?.hotelName` and `context.hotelData?.hotelName` to decide whether enforcement is needed — same variables already used at line 2559.

**3. Redeploy** the `generate-itinerary` edge function.

### Why it works
Instead of relying on prompt instructions (which the AI ignores), we mechanically replace every known hotel brand mention after generation. The regex covers 30+ brands with optional city suffixes. Even partial coverage eliminates the most common hallucinations.

