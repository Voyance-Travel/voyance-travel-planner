

## Make Michelin Inclusion Universal (Remove Hardcoded City Lists)

### Problem
Both the AI prompt and the post-generation Michelin injection use hardcoded restaurant lists for 6 cities (Paris, Rome, Berlin, Lisbon, London, Barcelona). Any other city gets no Michelin guidance or fallback injection.

### Changes

#### 1. `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` (lines 872-941)

Replace the city-specific `if/else` Michelin restaurant lists with the universal prompt the user provided:

```
LUMINARY DINNER GUIDANCE:
This is a Luminary (luxury) trip. For at least {minCount} dinner(s) across the full trip,
suggest a Michelin-starred restaurant or equivalent top-tier fine dining restaurant
that genuinely exists in {destination}.
- Price these at the restaurant's real tasting menu price (usually €120-350/pp for starred restaurants)
- Include the real address
- Only suggest restaurants you are confident actually exist and hold the star rating
- If you are unsure about Michelin status in this city, suggest the most acclaimed
  fine dining restaurant you know of
```

Keep the existing trip-type branching (budget → skip, luminary → mandatory, explorer → optional) and the count logic (3-4d→1, 5-6d→2, 7+→3). Just remove the hardcoded `michelinList` blocks.

#### 2. `supabase/functions/generate-itinerary/action-generate-trip-day.ts` (lines 1801-1889)

Remove the `MICHELIN_FALLBACKS` hardcoded map and the injection loop. Since the AI prompt now universally instructs Michelin inclusion for any city, the deterministic fallback swap is no longer needed (it can't work for unknown cities anyway). Replace with a log-only warning if the count is still short after generation, so we can monitor without silently injecting wrong data.

Replace lines 1801-1889 with:
```typescript
if (isLuminaryTrip && michelinCount < requiredCount) {
  console.warn(`[MICHELIN] Only ${michelinCount}/${requiredCount} Michelin dinners generated for Luminary ${totalDays}-day ${destination} trip. AI prompt should have included them.`);
}
```

### Files to Edit

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` | Replace hardcoded city Michelin lists with universal AI guidance prompt |
| `supabase/functions/generate-itinerary/action-generate-trip-day.ts` | Remove `MICHELIN_FALLBACKS` map and injection loop, keep warning log |

### What Stays Unchanged
- `enforceMichelinPriceFloor()` in sanitization.ts — still enforces minimum pricing for any Michelin restaurant the AI suggests
- `KNOWN_FINE_DINING_STARS` and `FINE_DINING_MIN_PRICE_BY_STARS` — still used for price floor enforcement
- `canHaveMichelin()` in archetype-constraints.ts — still controls which archetypes allow Michelin
- Budget trip exclusion — still skips Michelin entirely
- Explorer trip optional inclusion — still encouraged but not mandatory

### Deployment
Redeploy `generate-itinerary` edge function.

