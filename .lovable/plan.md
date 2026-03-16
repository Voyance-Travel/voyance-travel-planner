

## Fix Chain Restaurant Infiltration + Reduce Buffer Warning Noise

### Problem 1: Chain Restaurants in Generated Itineraries

**Root cause**: The restaurant pool prompt (Stage 1.95, `index.ts` line 11155) asks for "real, currently operating restaurants" with "4.5+ star rated" but has **zero explicit chain filtering**. The prompt says nothing about excluding chains. While archetype constraints mention "chain restaurants = VIOLATION" in prompt text for certain archetypes, the restaurant pool generation itself is archetype-agnostic — it fires one generic prompt per city with only a budget label.

Additionally, the post-processing pipeline has no chain detection. The meal guard, deduplication, and final guard all check for *generic placeholders* ("Breakfast spot", "Local Café") but never check if a restaurant is a chain (Five Guys, McDonald's, Starbucks, Applebee's, etc.).

**Fix — Two layers**:

1. **Restaurant pool prompt**: Add an explicit exclusion rule: "NO chain/franchise restaurants (e.g., McDonald's, Five Guys, Starbucks, Subway, etc.). Only independent, locally-owned or locally-iconic establishments."

2. **Post-generation chain filter**: Add a `CHAIN_RESTAURANT_BLOCKLIST` constant containing ~80 well-known chains. After the AI returns restaurant pool results AND after each day's activities are generated, run a filter that strips any chain matches and logs a warning. For the restaurant pool, replace stripped entries with remaining pool items. For day activities, flag the meal as missing so the meal guard re-injects from the (now clean) pool.

### Problem 2: "No travel buffer" Warning Noise

**Root cause**: `TransitGapIndicator.tsx` renders a red "No travel buffer" warning for **every** pair of back-to-back activities where `gapMinutes <= 0` and they're not at the same location. On a dense day, this fires 5+ times, creating visual noise that users learn to ignore.

**Fix**: Consolidate zero-gap warnings at the day level instead of per-transition:

- In the TransitGapIndicator, downgrade zero-gap from a red destructive warning to a subtle muted indicator (same visual weight as a normal transit gap, just with a small "0 min" pill). Remove the AlertTriangle icon and red text.
- Add a single day-level summary banner at the top of the day (in the editorial itinerary day header area) when 2+ activities have zero gaps: "3 activities have no travel buffer — consider using Refresh Day to fix timing."

This keeps the information available without the per-activity alarm fatigue.

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `supabase/functions/generate-itinerary/index.ts` (line ~11155) | Add chain exclusion language to restaurant pool prompt |
| 2 | `supabase/functions/generate-itinerary/day-validation.ts` | Add `CHAIN_BLOCKLIST` constant and `isChainRestaurant()` helper. Add chain-stripping step inside `enforceRequiredMealsFinalGuard` and export a `filterChainRestaurants()` utility |
| 3 | `supabase/functions/generate-itinerary/index.ts` (line ~11196) | After parsing restaurant pool results, filter out any chain matches before storing |
| 4 | `supabase/functions/generate-itinerary/index.ts` (line ~9900 post-processing) | After day generation, scan dining activities against blocklist; if chain found, remove it and let meal guard re-inject from pool |
| 5 | `src/components/itinerary/TransitGapIndicator.tsx` | Downgrade zero-gap visual from red/destructive to muted indicator |
| 6 | `src/components/itinerary/EditorialItinerary.tsx` | Add day-level "X activities have no buffer" summary banner when count ≥ 2 |

### Chain Blocklist (partial — the full list will include ~80 entries)

Five Guys, McDonald's, Burger King, Wendy's, Subway, Starbucks, Chick-fil-A, Taco Bell, KFC, Popeyes, Panda Express, Chipotle, Domino's, Pizza Hut, Papa John's, Applebee's, Chili's, Olive Garden, TGI Friday's, Denny's, IHOP, Waffle House, Cracker Barrel, Red Lobster, Outback Steakhouse, Buffalo Wild Wings, Hooters, Nando's, Wetherspoons, Tim Hortons, Dunkin', Panera Bread, Arby's, Sonic, Jack in the Box, Shake Shack, In-N-Out, Whataburger, Culver's, Zaxby's, Raising Cane's, Wingstop, Jimmy John's, Jersey Mike's, Firehouse Subs, Cheesecake Factory, P.F. Chang's, Benihana, Ruth's Chris, Morton's, Capital Grille, Nobu (chain locations), Hard Rock Cafe, Planet Hollywood, Rainforest Cafe, Bubba Gump

