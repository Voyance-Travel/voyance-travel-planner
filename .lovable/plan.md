

## Fix: guide_favorites 400 Errors — Column Type Mismatch

The `guide_favorites` table exists but `activity_id` is typed as `uuid`. The itinerary activities rendered in `EditorialItinerary.tsx` use string-based IDs from the trip's `itinerary_data` JSON (e.g., `"franklin-01"`, `"barton-springs-02"`), not UUIDs from the `trip_activities` table. When the frontend passes these string IDs, Supabase rejects them with a 400 because they can't be cast to `uuid`.

### Fix: Alter `activity_id` column from `uuid` to `text`

Single database migration:

```sql
ALTER TABLE public.guide_favorites
  ALTER COLUMN activity_id TYPE text USING activity_id::text;
```

This preserves any existing data (UUIDs are valid text) and allows both UUID-style and string-style activity IDs.

### No frontend changes needed
The `GuideBookmarkButton` component and all related hooks (`useGuideFavorites`, `useCommunityGuide`, `communityGuidesAPI`) already pass `activity_id` as a string. The table schema just needs to accept it.

