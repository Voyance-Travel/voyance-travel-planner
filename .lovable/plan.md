

## Enhance AI Restaurant Slot Filler with Trip-Aware Context

### Problem
The existing `generateFallbackRestaurant()` function works but uses a minimal prompt — it only passes city, meal type, and budget tier as a plain string. It lacks trip-type-aware price guidance, country context, neighborhood hints, day theme, and doesn't handle `drinks` as a meal type.

### What Already Works
- Placeholder detection (expanded patterns) — done
- AI micro-call with tool calling and 10s timeout — done
- Hardcoded fast-path fallback — done
- Integration into the placeholder replacement loop — done

### Changes

**File: `supabase/functions/generate-itinerary/action-generate-day.ts`**

1. **Expand `generateFallbackRestaurant()` signature** to accept: `country`, `tripType`, `dayTheme`, `neighborhood` (all optional)

2. **Add trip-type-aware price guidance** inside the function:
   - Luminary: breakfast €25-60, lunch €40-80, dinner €60-200 (mention Michelin), drinks €20-50
   - Explorer: breakfast €10-30, lunch €20-50, dinner €30-80, drinks €15-35
   - Budget: breakfast €5-15, lunch €8-25, dinner €15-40, drinks €8-20

3. **Enhance the prompt** to include:
   - Country (for cultural context)
   - Trip style description (luxury/authentic/affordable)
   - Price range per person for the specific meal type
   - Neighborhood hint if available
   - Day theme if available
   - Michelin note for Luminary dinners

4. **Add `drinks` as a valid meal type** in the `PlaceholderSlot` interface and detection logic (hour >= 21)

5. **Update the call site** (lines 673-681) to pass the new params: `destinationCountry`, `tripType`, day theme from the generated day data

### Technical Details

The enhanced prompt becomes:
```
You are a restaurant expert for {city}, {country}. Suggest ONE real {mealType} restaurant.
- Trip style: {tripType} ({style description})
- Price range: {range} per person
- Neighborhood: {neighborhood or 'any'}
- Day theme: {theme or 'general'}
- DO NOT suggest: {blocklist}
```

No new dependencies. Same model (`gemini-2.5-flash-lite`), same tool schema, same timeout.

### Files to Edit

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/action-generate-day.ts` | Enhance `generateFallbackRestaurant()` with richer prompt context, add `drinks` meal type, update call site to pass country/tripType/theme |

### Deployment
Redeploy `generate-itinerary` edge function.

