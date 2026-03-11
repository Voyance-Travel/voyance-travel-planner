

## Fix 20B: Community Guide Editorial Engine — Preview Flow

### Overview
Wire the guide builder UI to the `generate-guide-editorial` edge function from Fix 20A. Add a content threshold gate, generate button, and full-screen editorial preview modal with publish/regenerate actions.

### New Components (3 files)

**1. `src/components/guides/EditorialStatusCard.tsx`**
- Receives `sections` (the `ActivitySectionData[]` from GuideBuilder state) and computes qualifying count: sections where `sectionType !== 'day_overview'` AND `userExperience.length >= 50`
- Below threshold: dashed border card, progress bar (`{count} of 3`), disabled "Generate Editorial" button
- At/above threshold: solid card, enabled teal button
- If editorial already exists (passed as prop): shows "Editorial v{version} — generated {relative time}", button says "Regenerate Editorial"
- Loading state: spinner + "Generating your editorial..." + pulsing shimmer on card
- Calls `supabase.functions.invoke('generate-guide-editorial', { body: { guideId } })` on click
- On success: calls `onEditorialGenerated(editorialContent)` callback (parent opens preview modal)
- On error: toast error, reset button
- Typography: Playfair Display for heading, DM Sans for body, ✨ emoji prefix

**2. `src/components/guides/EditorialPreviewModal.tsx`**
- Full-screen dialog (`DialogContent` with `max-w-4xl h-[95vh]`)
- Props: `open`, `onOpenChange`, `editorial` (EditorialContent JSON), `guideId`, `guideName`, `authorName`, `dnaType`, `tripDates`, `coverImageUrl`, `onPublish`, `onRegenerate`
- Fixed top bar: "← Back to Editor" | "Preview" | "Publish ▸"
- Fixed bottom bar: "← Back to Editor" | "↻ Regenerate" | "Publish ▸"
- Scrollable content area renders via `EditorialRenderer`
- Regenerate button calls parent's `onRegenerate` callback (which re-invokes the edge function)
- Publish button calls parent's `onPublish` callback
- If no editorial content: shows fallback message with back button only

**3. `src/components/guides/EditorialRenderer.tsx`**
- Pure presentational component — takes `EditorialContent` JSON + metadata and renders the magazine layout
- Reusable in Fix 20C (published view)
- Hero: title (Playfair Display, centered), byline (`{author} · {dnaType}`), dates, lede (italic)
- Cover image: first user photo or fallback
- Sections: `─── HEADING ───` dividers (uppercase, tracked, thin rules), italic intro, body prose (split on `\n\n`), pull quotes (border-l-4 border-teal-600, italic), inline star ratings from `section.ratings[]`
- Sign-off: italic closing paragraph
- Quick Reference: compact list grouped by category, `{name} · ★★★★☆ · {oneLiner}`
- Responsive: max-w-2xl centered on desktop, full-width on mobile

### Changes to Existing Files

**`src/pages/GuideBuilder.tsx`**
- Import `EditorialStatusCard` and `EditorialPreviewModal`
- Add state: `editorialContent`, `editorialVersion`, `editorialGeneratedAt`, `editorialPreviewOpen`
- Load existing editorial from `existingGuide` (the `editorial_content`, `editorial_version`, `editorial_generated_at` columns)
- Insert `EditorialStatusCard` between the content links section and the Actions div (~line 896)
- Pass sections, guideId, editorial state, and callbacks
- On editorial generated: set state + open preview modal
- On publish from modal: call existing `saveMutation.mutate(true)` (which handles status update), then navigate to `/community-guides/{guideId}`
- Relabel existing "Publish Guide" button to "Publish as Card Guide" to distinguish from editorial publish path
- On regenerate from modal: re-invoke edge function, update state

### Data Flow
```text
GuideBuilder (sections state)
  → EditorialStatusCard (counts qualifying sections, shows threshold)
    → Click "Generate" → invoke edge function → returns EditorialContent
  → EditorialPreviewModal (receives editorial JSON)
    → EditorialRenderer (pure render)
    → "Publish" → save + navigate
    → "Regenerate" → re-invoke → update preview
```

### No Database Changes
All schema changes were done in Fix 20A. This prompt is UI-only.

