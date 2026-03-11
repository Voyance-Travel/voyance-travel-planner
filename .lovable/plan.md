

## Fix 17: Community Guides Redesign — Phase 1 Plan

This is a large feature spanning database changes, storage setup, a new edge function, and significant UI rewrites across ~10 files. Here is the plan for Phase 1 (Parts 1-4 from the spec).

---

### Database Migrations

**Migration 1: New tables and columns**

1. **Add columns to `guide_sections`** for the new editable activity card fields:
   - `user_experience` (TEXT, nullable) — user's personal notes, max 2000 chars
   - `user_rating` (INTEGER, nullable) — 1-5 stars
   - `recommended` (TEXT, nullable) — 'yes' / 'no' / 'neutral'
   - `photos` (JSONB, default '[]') — array of `{ url, caption }` objects (up to 4 per section)

2. **Add `moderation_status` column to `community_guides`**:
   - TEXT, default 'approved' (values: approved, flagged, removed)

3. **Create `guide_activity_reviews` table** for future aggregation:
   - `id`, `guide_id` (FK community_guides), `user_id` (FK auth.users), `activity_name`, `activity_category`, `destination_city`, `rating` (1-5), `recommended` (boolean), `experience_text`, `photo_count`, `created_at`
   - Indexes on `destination_city` and `activity_name`

4. **Create storage bucket `guide-photos`** (public) with RLS policies:
   - Authenticated users can upload to their own path (`guide-photos/{user_id}/...`)
   - Public read access for published guide photos
   - Max 5MB file size enforced client-side

---

### Storage Setup

- Create `guide-photos` bucket via migration
- RLS: authenticated INSERT for own path, public SELECT, owner DELETE

---

### Edge Function: `moderate-guide-content`

New edge function that receives all user-written text and returns `{ approved, warnings, blocked_reasons }`.

- **Blocked patterns**: violence, explicit sexual content, hate speech, hard drugs
- **Warning patterns**: phone numbers, emails, SSN-like numbers
- Called before publish; if blocked, guide stays as draft with toast explaining why
- If warnings only, show confirmation dialog letting user proceed

---

### UI Changes

**1. Redesign `GuideBuilder.tsx` (major rewrite)**

The current flow has three disconnected sections. Consolidate into one editable activity-based flow:

- **Remove** the separate "Guide Content" section that displays `allItems` from `guide_favorites` + `guide_manual_entries`. The "Add Days to Guide" bulk selection is the primary content source.
- **Make `sections` the single source of truth** — when user adds days, each activity becomes an editable card with the new fields.
- **Sections state** gains: `userExperience`, `userRating`, `recommended`, `photos[]`

**2. New component: `EditableActivityCard.tsx`**

Replace read-only section cards with rich editable cards containing:
- Activity name + category badge + day number (read-only header)
- AI Tip shown in muted italic (from `activitySnapshot.tips`)
- "Your Experience" textarea (2000 char limit)
- Star rating (1-5, clickable)
- Photo upload grid (up to 4, with add/remove)
- "Would you recommend?" toggle (Yes/No/It was okay)
- Delete button

**3. New component: `StarRating.tsx`**

Simple 1-5 star rating component with click and hover states.

**4. New component: `PhotoUploadGrid.tsx`**

- "Add Photos" button + 2x2 thumbnail grid
- Upload to `guide-photos/{user_id}/{guide_id}/{section_id}_{timestamp}.ext`
- Accept jpg/png/webp, max 5MB, max 4 per card
- Click thumbnail to view full or remove

**5. Update `AddRecommendationModal.tsx` → "Add Custom Tip"**

- Update categories to: Restaurant, Bar, Activity, Hidden Gem, Transport Tip, General Tip
- Add rating (1-5 stars) and photos (up to 4) fields
- Rename dialog title to "Add Custom Tip"
- Result adds a section with `sectionType: 'custom_tip'`

**6. Smart Tags**

Replace free-text tag input with auto-suggested tags:
- Auto-suggest destination city/country from trip data
- Auto-suggest activity categories present in sections (dining, sightseeing, etc.)
- Pull travel DNA type from user profile
- Suggest trip type based on traveler count (solo/couples/group/family)
- Display as tappable teal pills; already-added tags show with X to remove
- Keep ability to type custom tags

**7. Update save mutation**

- Save `sections` to `guide_sections` table (upsert) with new fields
- On publish: call `moderate-guide-content` edge function first
- On publish with reviews: insert/upsert rows in `guide_activity_reviews` for aggregation
- Set `moderation_status` based on moderation result

**8. Redesign published guide view (`CommunityGuideDetail.tsx`)**

Transform into a blog-style layout:
- Hero image (first uploaded photo or destination cover)
- Author info with Travel DNA badge
- Date range and duration
- Tags displayed as pills
- Day-by-day sections showing only activities with user content (experience text, rating, photos, or recommendation)
- Photo grids per activity
- Star ratings and recommendation badges inline
- "Custom Tips" section at bottom for non-itinerary recommendations
- Share buttons (Copy Link)
- Skip activities with no user engagement in published view

---

### Files Created
- `src/components/guides/EditableActivityCard.tsx`
- `src/components/guides/StarRating.tsx`
- `src/components/guides/PhotoUploadGrid.tsx`
- `src/components/guides/SmartTagSelector.tsx`
- `supabase/functions/moderate-guide-content/index.ts`

### Files Modified
- `src/pages/GuideBuilder.tsx` — major rewrite of editor flow
- `src/pages/CommunityGuideDetail.tsx` — blog-style published view
- `src/components/guides/AddRecommendationModal.tsx` — rename + expand to "Add Custom Tip"
- `src/components/guides/PublishConfirmModal.tsx` — add moderation check flow
- `src/hooks/useCommunityGuide.ts` — update types for new fields

### Files Potentially Removed
- `src/components/guides/GuideActivityCard.tsx` — replaced by `EditableActivityCard`
- `src/components/guides/GuidePreview.tsx` — preview merged into main flow or rebuilt

---

### Implementation Order

Due to the size, this should be implemented in sub-steps:

1. **Database migration** — new columns, table, storage bucket
2. **Core UI components** — StarRating, PhotoUploadGrid, EditableActivityCard, SmartTagSelector
3. **GuideBuilder rewrite** — integrate new components, update save logic
4. **Moderation edge function** — create and integrate
5. **Published view redesign** — CommunityGuideDetail blog layout

