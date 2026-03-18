

## Fix: Community Guide Builder — 400 Error on Save + Missing DialogDescription

### Root Cause

**1. guide_sections FK points to wrong table (400 error)**

The `guide_sections` table has a foreign key `guide_sections_guide_id_fkey` referencing `guides(id)`. But the `GuideBuilder.tsx` code saves the guide to `community_guides`, then uses that ID to insert into `guide_sections`. Since the ID doesn't exist in `guides`, the FK constraint fails with a 400.

Both tables are currently empty, so a clean FK migration is safe.

**2. EditorialPreviewModal missing DialogDescription (console warning)**

The `DialogContent` in `EditorialPreviewModal.tsx` has no `DialogDescription`, triggering the accessibility warning.

### Fix

| # | File / Type | Change |
|---|-------------|--------|
| 1 | **DB Migration** | Drop FK `guide_sections_guide_id_fkey` → recreate pointing to `community_guides(id) ON DELETE CASCADE`. Also update the RLS policy to reference `community_guides` instead of `guides`. |
| 2 | `src/components/guides/EditorialPreviewModal.tsx` | Add `DialogDescription` (visually hidden) inside the `DialogContent`. |

### Migration SQL

```sql
-- Fix FK to point to community_guides
ALTER TABLE public.guide_sections
  DROP CONSTRAINT guide_sections_guide_id_fkey;

ALTER TABLE public.guide_sections
  ADD CONSTRAINT guide_sections_guide_id_fkey
  FOREIGN KEY (guide_id) REFERENCES public.community_guides(id) ON DELETE CASCADE;

-- Fix RLS policy to reference community_guides
DROP POLICY IF EXISTS "Users can manage sections of own guides" ON public.guide_sections;

CREATE POLICY "Users can manage sections of own guides"
  ON public.guide_sections FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.community_guides
      WHERE community_guides.id = guide_sections.guide_id
        AND (community_guides.user_id = auth.uid() OR community_guides.status = 'published')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.community_guides
      WHERE community_guides.id = guide_sections.guide_id
        AND community_guides.user_id = auth.uid()
    )
  );
```

### EditorialPreviewModal Fix

Add a visually-hidden `DialogDescription`:
```tsx
import { DialogDescription } from '@/components/ui/dialog';
// inside DialogContent:
<DialogDescription className="sr-only">Preview of your editorial guide</DialogDescription>
```

