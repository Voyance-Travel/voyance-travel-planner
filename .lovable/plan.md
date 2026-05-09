## TG1 Fix: Mirror AI-generated guide publishes into `community_guides`

### Findings (corrects issue framing)

There are **two parallel guide systems**:

| System | Writer | Reader | Table |
|---|---|---|---|
| AI-generated | `TravelGuideEditor.tsx` (publish/save) → `services/travelGuideService.ts` | `PublicTravelGuide.tsx` (`/guide/:slug`) | `travel_guides` |
| Manual builder | `GuideBuilder.tsx` | `CommunityGuidesGrid`, `CommunityGuidePublic`, `CommunityGuideDetail` | `community_guides` |

`GuideBuilder` already writes to `community_guides` — it appears in browse correctly. The actual bug: **AI-generated guides published from `TravelGuideEditor` only land in `travel_guides`** and never surface in the community browse grid.

### Approach: Path A (mirror, don't migrate)

On publish (and republish), in addition to the existing `travel_guides` write, upsert a matching row into `community_guides` so it surfaces in browse. Keep `PublicTravelGuide` (`/guide/:slug`) untouched — the markdown content keeps rendering there. The community-grid card will route to `CommunityGuidePublic` (`/community-guide/:slug`) which already understands JSONB content.

Picked Path A over a full migration to avoid touching the `generate-travel-guide` edge function, the `/guide/:slug` route, and the markdown rendering pipeline.

### Schema mapping (`travel_guides` → `community_guides`)

| community_guides field | source |
|---|---|
| `id` | new uuid (separate row); store FK back via `tags` is not needed |
| `user_id` | guide.user_id |
| `trip_id` | guide.trip_id |
| `title` | title |
| `description` | first paragraph of markdown content (strip headings, truncate 1000 chars) |
| `destination` | guide.destination |
| `destination_country` | look up from `trips.destination_country` |
| `cover_image_url` | coverImageUrl |
| `slug` | guide.slug (unique on both tables; safe — no collision in `community_guides` because new namespace) |
| `status` | 'published' |
| `moderation_status` | 'approved' (no moderation pipeline for AI-generated yet; matches existing default) |
| `content` (JSONB) | `{ markdown: <full content>, photos: selected_photos, social_links }` — `CommunityGuidePublic` already handles unknown shapes; we'll add a thin renderer fallback for `content.markdown` |
| `tags` | `[]` |
| `published_at` | now() |

### Changes

1. **`src/services/travelGuideService.ts`**
   - Add `mirrorToCommunityGuides(guide: TravelGuide, tripCountry: string | null)` helper that upserts into `community_guides` keyed on `(user_id, trip_id)` with the mapping above. Use `onConflict: 'slug'` upsert (slug is unique).
   - Modify `publishTravelGuide(guideId)` to: (a) update `travel_guides` status as today, (b) re-fetch the guide row, (c) fetch `trips.destination_country`, (d) call `mirrorToCommunityGuides`. Wrap mirror in try/catch — failure logs `console.warn('[travel_guide] mirror to community_guides failed', err)` but does NOT block the publish success path.

2. **`src/pages/CommunityGuidePublic.tsx`** (read-side fallback)
   - Verify it already renders JSONB `content`. If `content.markdown` exists and no `activities`, render the markdown via `react-markdown` (same component already imported in `TravelGuideEditor`). Read-only check first; only patch if needed.

3. **No migration required.** `community_guides` already has every column we need (`moderation_status` was added in 20260311022908).

### Verification

- Publish an AI-generated guide → row appears in `community_guides` with `status='published'`, `moderation_status='approved'`.
- `CommunityGuidesGrid` shows the new card.
- `/guide/:slug` (existing PublicTravelGuide) still renders the markdown unchanged.
- `/community-guide/:slug` renders the same content via the JSONB path.
- Republish updates both rows (idempotent via slug upsert).

### Out of scope

- Deprecating `travel_guides` table.
- Backfilling existing published `travel_guides` rows (one-shot SQL backfill can be a follow-up if you want).
- Editing flow on the community side for AI-generated guides — owners still edit via `TravelGuideEditor`; mirror re-runs on each republish.
