

## AI-Generated Travel Blog with Public Sharing

This is a large feature spanning database, backend, and multiple frontend components. I recommend breaking it into two implementation rounds to keep things manageable.

### Round 1: Database + Edge Function + Core Pages

**Database Migration**
- Create `trip_blogs` table with columns: id, trip_id, user_id, title, subtitle, cover_image_url, content (JSONB), social_links (JSONB), slug (unique), status (draft/published/archived), published_at, destination, trip_dates, traveler_count, trip_duration_days, view_count, created_at, updated_at
- RLS: owners can manage their own blogs; anyone can SELECT published blogs
- Add `GENERATE_BLOG: 20` to CREDIT_COSTS and ACTION_MAP

**Edge Function: `supabase/functions/generate-travel-blog/index.ts`**
- Authenticated endpoint that fetches trip data, itinerary days, trip_notes, trip_learnings, and trip photos
- Accepts `{ tripId, style: 'full'|'highlights'|'custom', includedDays?, socialLinks? }`
- Spends 20 credits via `deduct_credits_fifo`
- Builds a prompt with all trip context and calls Lovable AI Gateway (`google/gemini-2.5-flash`) with tool calling to extract structured content blocks
- Generates a URL slug from destination + timestamp
- Creates the `trip_blogs` row and returns `{ blogId, slug }`

**Public Blog Page: `src/pages/BlogPost.tsx`**
- Route: `/blog/:slug` (public, no auth required)
- Fetches the blog by slug where `status = 'published'`
- Renders cover hero image, title/subtitle, author info, and all content blocks (headings, paragraphs, highlights, day dividers, tips, quotes, social embeds as link cards)
- Increments view_count on load (via a lightweight RPC or direct update)
- Footer CTA: "Plan your own adventure with Voyance"

**Blog List: `src/pages/MyBlogs.tsx`**
- Route: `/blog` (authenticated)
- Lists user's blogs with status badges, view counts, edit/delete actions

### Round 2: Creation Wizard + Block Editor + Integration

**Blog Creation Wizard: `src/components/blog/CreateBlogWizard.tsx`**
- Multi-step flow triggered from TripRecap page
- Step 1: Style selection (Full / Highlights / Custom day picker)
- Step 2: Social media link input (platform auto-detected from URL)
- Step 3: Review summary + "Generate My Blog" button (calls edge function, deducts credits)
- Step 4: Opens editor with generated content

**Block Editor: `src/components/blog/BlogEditor.tsx`**
- State-managed array of typed content blocks
- Each block: editable text (textarea/contentEditable), type-specific controls
- Drag-and-drop reorder via `@dnd-kit/sortable` (already installed)
- Add block (+ button between blocks), delete block, edit title/subtitle inline
- Auto-save (debounced 5s) to `trip_blogs` table
- Preview toggle and Publish button

**Block Renderer: `src/components/blog/BlogBlockRenderer.tsx`**
- Shared component used by both editor (edit mode) and public page (read-only)
- Renders each block type with appropriate styling

**TripRecap Integration**
- Add "Create Travel Blog" / "Edit Blog" / "View Blog" button to TripRecap hero section
- Check if blog exists for this trip to determine button state

**Routing (in App.tsx)**
- `/blog/:slug` — public (BlogPost)
- `/blog` — authenticated (MyBlogs)
- `/blog/create/:tripId` — authenticated (CreateBlogWizard)
- `/blog/edit/:blogId` — authenticated (BlogEditor)

### Files to Create/Modify

| File | Action |
|------|--------|
| Migration SQL | Create `trip_blogs` table + RLS |
| `supabase/functions/generate-travel-blog/index.ts` | New edge function |
| `supabase/config.toml` | Add function entry |
| `src/config/pricing.ts` | Add `GENERATE_BLOG: 20` |
| `src/hooks/useSpendCredits.ts` | Add `GENERATE_BLOG` to ACTION_MAP |
| `src/pages/BlogPost.tsx` | New public page |
| `src/pages/MyBlogs.tsx` | New authenticated page |
| `src/components/blog/CreateBlogWizard.tsx` | New wizard component |
| `src/components/blog/BlogEditor.tsx` | New block editor |
| `src/components/blog/BlogBlockRenderer.tsx` | Shared block renderer |
| `src/pages/TripRecap.tsx` | Add blog CTA button |
| `src/App.tsx` | Add blog routes |
| `src/config/routes.ts` | Add blog route constants |

### What Stays the Same
- TripRecap layout (overview, photos, notes, next time tabs) — blog is additive
- Trip notes, photos, learnings systems — read-only by blog generator
- Active trip sharing (invite links) — unchanged
- Credit system — just adding one new action type

