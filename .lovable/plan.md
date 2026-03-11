

## Fix 20C: Published Editorial View

### Overview
When a published community guide has `editorial_content` (version ≥ 1), replace the existing card-based view with a magazine-style editorial layout. Guides without editorial continue showing the current view unchanged.

### New Files

**1. `src/components/guides/EditorialRenderer.tsx`**
The core presentational component that renders `EditorialContent` JSON into the magazine layout. Reusable for both the published view (this fix) and the preview modal (Fix 20B when built).

Props: `editorial` (the JSON), `authorName`, `dnaType`, `authorAvatarUrl`, `authorUserId`, `tripStartDate`, `tripEndDate`, `durationDays`, `coverImageUrl`, `guidePhotos` (map of activity name → photo URLs for inline display).

Renders:
- **Hero image**: Full-width, max-h-[400px] (`max-h-[280px]` mobile), object-cover, with bottom gradient overlay. Source: `coverImageUrl` → first guide photo → teal gradient fallback.
- **Title block** (max-w-3xl centered): `editorial.title` in Playfair Display (text-3xl md:text-4xl), byline "{name} · {dnaType}" in teal-700, dates, `editorial.lede` in italic text-lg.
- **Themed sections**: For each `editorial.sections[]`:
  - Divider: flex row with `border-t border-gray-300` lines flanking centered uppercase heading (Playfair Display, tracking-[0.2em], text-gray-600). Spacing: mt-16 mb-8.
  - Italic intro paragraph.
  - Narrative prose: split on `\n\n`, rendered as paragraphs with mb-6. Inline star ratings from `section.ratings[]` rendered as small gold stars next to place names.
  - Pull quote (if present): `border-l-4 border-teal-600 pl-6 py-2 my-8`, italic text-xl text-gray-700. Auto-wrap in quotes if missing.
  - Inline photos: Match `section.activityRefs[]` against `guidePhotos` map. Single photo full-width rounded-lg; 2+ photos in 2-col grid (stacks on mobile). Max 4 per section. Lazy-loaded.
- **Sign-off**: Centered `─── ✦ ───` divider, then `editorial.signOff` in italic text-lg.
- **Author card**: bg-gray-50 rounded-xl p-6, avatar + name (font-semibold) + DNA type badge (teal-700) + "View Voyance Profile →" link to `/profile/{userId}`.
- **Quick Reference**: bg-gray-50 rounded-xl, items grouped by category with emoji labels (🍽 DINING, 🎯 ACTIVITIES, 👁 SIGHTS, 🌙 NIGHTLIFE, 🎭 ENTERTAINMENT). Each item: name (font-medium) · inline gold stars · one-liner. Subtle border-b dividers.

**2. `src/types/editorial.ts`**
TypeScript interfaces for `EditorialContent`, `EditorialSection`, `QuickRefItem` — shared between renderer, preview modal, and edge function response handling.

### Changes to Existing Files

**`src/pages/CommunityGuideDetail.tsx`**
- Import `EditorialRenderer` and the editorial types.
- After fetching the guide, check: `if (guide.editorial_content && (guide.editorial_version ?? 0) > 0)` → render editorial path.
- Cast `guide.editorial_content` to `EditorialContent`.
- Fetch author profile + DNA type (already done via `CreatorCard` pattern — reuse `useCreatorProfile` or inline query for name/avatar/DNA).
- Build `guidePhotos` map from `guide.content.activities` — map activity names to their `photos[].url` arrays.
- **Editorial path rendering**: `MainLayout` → `Head` (same OG tags) → full-width hero via `EditorialRenderer` → share/report section below → delete button (owner only).
- **Card path**: Existing code stays in an `else` branch, completely untouched.
- The editorial view is single-column (no sidebar) — the author card is rendered inline within the editorial via `EditorialRenderer`. This differs from the card view's 2-column layout.

### Key Design Decisions
- The `EditorialRenderer` is a pure component with no data fetching — all data passed as props. This makes it reusable for the Fix 20B preview modal later.
- Photos are matched by activity name (case-insensitive) from `activityRefs[]` to the guide's activity photos.
- All `<img>` tags except the hero use `loading="lazy"`.
- Mobile: hero drops to 280px, title to text-2xl, photos single-column, padding px-4.

### No Database or Backend Changes
All schema and edge function work was completed in Fix 20A.

