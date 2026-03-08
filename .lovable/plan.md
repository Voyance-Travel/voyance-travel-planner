

# Add Share & Favorite to Explore Cards + Profile Favorites Section

## Current State
- **ExploreDestinationCard** and **TrendingDestinationsEnhanced** cards have no share or favorite buttons
- `saved_items` table exists in DB with `item_type`, `item_data`, `item_id` columns — already used by `useSavedDestinations` hook
- `SavedDestinations` section exists on the Explore page but there's no way to add favorites from the cards
- Profile page has no "Favorite Places" tab/section

## Plan

### 1. Create `useSaveDestination` hook for toggling favorites
New hook in `src/hooks/useSaveDestination.ts`:
- `useToggleSaveDestination()` — mutation that upserts/deletes from `saved_items` with `item_type: 'destination'`
- `useIsSaved(itemId)` — query that checks if the current user has saved a specific destination
- Requires auth — show toast prompting login if not authenticated

### 2. Add Share + Favorite buttons to ExploreDestinationCard
- Add **Heart** icon (top-right) — toggles save/unsave via the new hook. Filled red when saved.
- Add **Share2** icon (top-right, next to heart) — uses `navigator.share()` on mobile, falls back to copying the destination URL to clipboard
- Both buttons are absolute-positioned over the image with a translucent backdrop

### 3. Add Share + Favorite buttons to TrendingDestinationsEnhanced cards
Same pattern as above — Heart + Share overlay on the destination image cards.

### 4. Add "Favorite Places" section to Profile page
- Add a new section in the Profile overview (below trips, above or near "Saved Ideas") 
- Uses existing `useSavedDestinations()` hook to fetch saved destinations
- Renders a grid of saved destination cards with image, city, country, and a remove button
- Clicking a card navigates to the destination detail page
- Shows empty state when no favorites

### Files to create/modify
- **New**: `src/hooks/useSaveDestination.ts` — toggle + check hooks
- **Edit**: `src/components/explore/ExploreDestinationCard.tsx` — add Heart + Share buttons
- **Edit**: `src/components/explore/sections/TrendingDestinationsEnhanced.tsx` — add Heart + Share buttons  
- **New**: `src/components/profile/FavoritePlaces.tsx` — profile section component
- **Edit**: `src/pages/Profile.tsx` — integrate FavoritePlaces section

No database changes needed — `saved_items` table already supports this pattern.

