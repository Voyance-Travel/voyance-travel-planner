

## Add More Paris Breakfast Fallbacks

### Problem
With only 6 Paris breakfast fallbacks and multi-day trips (5-7+ days), the `usedVenueNamesInDay` set (seeded from `paramUsedRestaurants`) filters out all options by Day 4+. The code does have a last-resort repeat on line 206, but more options prevents that.

### Change

**File: `supabase/functions/generate-itinerary/action-generate-day.ts`** — Add 4 new entries to the `paris.breakfast` array (after line 97, before the closing `]`):

```typescript
{ name: "Ob-La-Di", address: "54 Rue de Saintonge, 75003 Paris", price: 20, description: "Third-wave coffee shop in Le Marais with excellent pastries and avocado toast." },
{ name: "Café Kitsuné", address: "51 Galerie de Montpensier, 75001 Paris", price: 22, description: "Japanese-French café in the Palais-Royal gardens. Matcha latte and flaky croissants." },
{ name: "Holybelly", address: "19 Rue Lucien Sampaix, 75010 Paris", price: 25, description: "Australian-style brunch in the Canal Saint-Martin area. Legendary pancakes." },
{ name: "La Fontaine de Belleville", address: "31-33 Rue Juliette Dodu, 75010 Paris", price: 18, description: "Specialty coffee roastery with homemade pastries. A local favorite near République." },
```

This brings Paris breakfast fallbacks from 6 to 10, covering trips up to 10 days without repeats.

### Files to Edit

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/action-generate-day.ts` | Add 4 entries to `INLINE_FALLBACK_RESTAURANTS.paris.breakfast` |

### Deployment
Redeploy `generate-itinerary` edge function.

