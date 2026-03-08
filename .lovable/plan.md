

## Travel Guide Builder — "Everything Selected, Uncheck What You Don't Want"

This feature adds an AI-powered travel guide builder accessible from TripRecap. It loads all trip activities by day, lets users uncheck items, then generates a polished prose guide via AI.

### Existing Infrastructure

- **`generate-travel-blog`** edge function already exists and does very similar work (loads trip activities, calls AI, saves to `trip_blogs`). We will create a new `generate-travel-guide` edge function modeled after it but targeting a new `travel_guides` table.
- **`community_guides`** table exists but stores structured activity lists, not prose. The new `travel_guides` table stores AI-generated markdown content — a different concept.
- **`GuideBuilder`** page exists at `/trip/:tripId/guide` for community guides. We'll use a new route `/trip/:tripId/travel-guide` for this feature.
- **`LOVABLE_API_KEY`** is available for AI calls.

### 1. Database Migration — `travel_guides` table

Create table with columns: id, user_id, trip_id, title, slug (unique), content (text/markdown), cover_image_url, destination, status (draft/published/archived), selected_activities (jsonb), selected_photos (text[]), social_links (jsonb), published_at, created_at, updated_at.

RLS policies:
- Owner can do everything (ALL using auth.uid() = user_id)
- Anyone can SELECT published guides (status = 'published')

Indexes on user_id, slug, trip_id.

### 2. Edge Function — `generate-travel-guide`

New file: `supabase/functions/generate-travel-guide/index.ts`

Modeled after `generate-travel-blog`. Accepts: tripId, selectedActivityIds[], includeNotes, includeHotel, includeFlights. Steps:
1. Auth check, load trip data
2. Load trip_activities for selected IDs, grouped by day
3. Load trip notes, hotel/flight info from trip if requested
4. Call Lovable AI (`google/gemini-2.5-flash-lite`) with travel-writer system prompt
5. Generate slug from destination + user handle
6. Upsert into `travel_guides` table with status='draft'
7. Return guide id + content

Credit cost: 15 credits (lighter than blog generation since it uses flash-lite).

Add to `supabase/config.toml`: `[functions.generate-travel-guide]` with `verify_jwt = false`.

### 3. Service Layer — `src/services/travelGuideService.ts`

Functions:
- `generateTravelGuide(tripId, selectedActivityIds, options)` — calls edge function
- `getTravelGuide(guideId)` — fetch by id
- `getTravelGuideByTrip(tripId)` — fetch existing guide for trip
- `getTravelGuideBySlug(slug)` — for public page
- `updateTravelGuide(guideId, updates)` — update content/title/social_links
- `publishTravelGuide(guideId)` — set status='published', published_at=now()
- `generateSlug(destination, handle)` — e.g. "austin-march-2026-ashton"

### 4. Builder Page — `src/pages/TravelGuideBuilder.tsx`

Route: `/trip/:tripId/travel-guide` (protected)

Loads all `trip_activities` for the trip grouped by itinerary day. Displays as checkbox list, all checked by default. Sections:
- Day-by-day activities with type icons, name, brief description
- Additional content toggles: Trip Notes, Photos, Hotel, Flight, Tips
- Select All / Deselect All at top
- Each day collapsible
- "Build My Guide" button at bottom

After AI generates, navigates to editor page.

### 5. Editor Page — `src/pages/TravelGuideEditor.tsx`

Route: `/trip/:tripId/travel-guide/edit/:guideId` (protected)

Shows generated markdown content in an editable textarea (or simple contentEditable div). Sections:
- Title field (editable)
- Content area (markdown editor — use textarea with preview toggle)
- Social links inputs (Instagram, TikTok, YouTube, Blog)
- Cover image selector (from trip photos)
- "Save Draft" and "Publish" buttons

### 6. Public Guide Page — `src/pages/PublicTravelGuide.tsx`

Route: `/guide/:slug` (public, no ProtectedRoute)

Clean read-only page:
- Hero image (cover photo)
- Title, author name + avatar, destination, dates
- Rendered markdown content (using existing `react-markdown`)
- Social link icons
- Voyance footer CTA: "Plan your own trip →"

### 7. TripRecap Integration

Add "Build Travel Guide" CTA button in the bottom action bar of `src/pages/TripRecap.tsx` (alongside existing "Share Trip" button):

```
<Button onClick={() => navigate(`/trip/${tripId}/travel-guide`)}>
  <BookOpen /> Build Travel Guide
</Button>
```

### 8. Route Registration in App.tsx

```
<Route path="/trip/:tripId/travel-guide" element={<ProtectedRoute><TravelGuideBuilder /></ProtectedRoute>} />
<Route path="/trip/:tripId/travel-guide/edit/:guideId" element={<ProtectedRoute><TravelGuideEditor /></ProtectedRoute>} />
<Route path="/guide/:slug" element={<PublicTravelGuide />} />
```

### What stays unchanged
- Existing `GuideBuilder` (community guides) at `/trip/:tripId/guide`
- `community_guides` table and all its hooks
- `generate-travel-blog` edge function and `trip_blogs`
- TripRecap tabs and existing content

