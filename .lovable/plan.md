# L4 — Honest preview cap (Option B)

Make the 2-day preview cap visible to users instead of silently misrepresenting a 10-day trip as 2 days. No behavior change to generation; only response shape + 2 small UI tweaks.

## Backend — `supabase/functions/generate-full-preview/index.ts`

1. **Line 148** — keep cap, name the constant:
   ```ts
   const PREVIEW_DAY_CAP = 2;
   const cappedDays = Math.min(totalDays, PREVIEW_DAY_CAP);
   ```
2. **Line 346** — stop overwriting `totalDays` with `cappedDays`. Emit both:
   ```ts
   totalDays,            // real trip length
   previewedDays: cappedDays,
   isPartialPreview: cappedDays < totalDays,
   totalActivities: allActivities.length,
   ```
3. **Lines 391, 398** — tweak the headline/log so partial previews say "first {X} of {Y} days":
   ```ts
   const dayLabel = cappedDays < totalDays
     ? `First ${cappedDays} of ${totalDays} Days`
     : `${totalDays}-Day`;
   // headline: `Your ${dayLabel} ${destination} Itinerary is Ready`
   ```

## Frontend type — `src/services/fullPreviewService.ts`

`FullPreview` interface (lines 63-79) — add:
```ts
previewedDays?: number;
isPartialPreview?: boolean;
```
(Optional for back-compat with any cached responses.)

## Frontend UI — `src/components/itinerary/FullPreviewItinerary.tsx`

1. **Line 50-55 local interface** — mirror the two new fields.
2. **Lines 271-288 stats grid** — "Days" tile shows real `preview.totalDays`. When `isPartialPreview`, render a small muted line under the day cards (~line 318):
   ```tsx
   {preview.isPartialPreview && (
     <p className="text-xs text-muted-foreground text-center">
       Showing the first {preview.previewedDays} of {preview.totalDays} days. Unlock to see all {preview.totalDays}.
     </p>
   )}
   ```
3. No CTA copy change needed — backend headline already adapts.

## Verification

- `grep -c "isPartialPreview\|previewedDays" supabase/functions/generate-full-preview/index.ts` ≥ 2.
- TypeScript build passes (interface field added in both `fullPreviewService.ts` and the local component interface).
- Manual: a 2-day trip → no partial banner; a 10-day trip → "Showing the first 2 of 10 days" + headline reads "First 2 of 10 Days".

## Out of scope

- Lifting the cap (Option A).
- Changing pricing or unlock flow.
- Touching `previewConverter.ts` (loops over `preview.days` directly, unaffected).
