

## Analysis: Placeholder Restaurants — Why They Happen and Why Tapping Does Nothing

### Why placeholders appear (especially at end of itinerary)

The system has a two-layer meal guard:

1. **Backend (day-validation.ts)**: After AI generates each day, a "Final Guard" checks if all required meals (breakfast, lunch, dinner) are present. If any are missing, it tries to inject a real venue from the pre-generated restaurant pool (~40 venues per city, fetched at Stage 1.95). If the pool is **exhausted** (all venues already used on earlier days), it falls back to a generic placeholder like "Breakfast at a local patisserie."

2. **Client (mealGuard.ts)**: A second safety net runs client-side. If somehow a day still lacks a required meal after backend processing, it injects placeholders with `needsRefinement: true`.

**Why later days get placeholders**: The restaurant pool is ~40 venues. A 7-day trip needs ~21 meals (3/day). If some venues get filtered (chains, duplicates, wrong meal type), the pool runs dry by day 5-6. The `usedRestaurants` tracking correctly prevents duplicates, but this means later days hit the generic fallback path.

### Why tapping does nothing

The placeholder sets:
- `tips: "This is a placeholder — tap to get a specific restaurant recommendation for this breakfast."`
- `needsRefinement: true`

But **no UI component reads `needsRefinement`**. The `tips` field renders as static italic text inside `VoyanceInsight` or the inline tip display in `EditorialItinerary.tsx`. There is no click handler, no modal trigger, no API call — the "tap to get" CTA is a dead promise.

### Fix Plan (2 parts)

**Part 1: Make placeholder tap functional — wire `needsRefinement` to the Swap drawer**

File: `src/components/itinerary/EditorialItinerary.tsx`

- Detect activities with `needsRefinement === true` (or tags containing `'needs-refinement'`)
- Replace the static tip text with a clickable CTA button: "Get a restaurant recommendation"
- On click, open the existing `ActivityAlternativesDrawer` pre-filtered to dining/restaurant category for that meal type
- This reuses existing infrastructure — no new edge function needed

**Part 2: Reduce placeholder frequency — increase restaurant pool size**

File: `supabase/functions/generate-itinerary/index.ts` (pool generation)

- Increase pool target from ~40 to ~60 venues per city for trips ≥5 days
- Scale pool size to `max(40, totalDays * 5)` so longer trips have enough runway
- This is a minor parameter tweak in the pool generation stage

**Part 3: Fix the misleading tip text for non-interactive state**

Files: `src/utils/mealGuard.ts`, `supabase/functions/generate-itinerary/day-validation.ts`

- Change the tip text from "tap to get a specific restaurant recommendation" to something actionable that matches the new CTA, or a neutral message when no action is wired
- For the backend guard with real venues: keep current tip ("Recommended by our venue database")
- For placeholder fallbacks: use "Tap 'Find Restaurant' below to get a personalized recommendation"

### Scope
- `src/components/itinerary/EditorialItinerary.tsx` — add clickable CTA for `needsRefinement` activities
- `src/utils/mealGuard.ts` — update tip text
- `supabase/functions/generate-itinerary/day-validation.ts` — update tip text
- `supabase/functions/generate-itinerary/index.ts` — scale pool size to trip length

