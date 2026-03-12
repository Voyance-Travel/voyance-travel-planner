

## Disable Edit/Preview Mode Toggle (Fix 21)

The Edit/Preview mode toggle is currently active on the trip page. We need to turn it off so the trip page always renders in edit mode — the original behavior — while keeping all the code intact for future use.

### Approach: Single-point disable in `useTripViewMode.ts`

The simplest and cleanest way is to force the hook to always return `edit` mode and `canToggle: false`. This instantly disables all downstream conditional rendering (`isCleanPreview`, hidden elements, simplified cards) without touching any of the ~80 references across `TripDetail.tsx` and `EditorialItinerary.tsx`.

**File: `src/hooks/useTripViewMode.ts`**
- Force `mode` to always return `'edit'`
- Force `canToggle` to `false` (hides the toggle UI)
- Add a comment explaining the flag is intentionally disabled
- Keep all existing code structure intact so it can be re-enabled later

This is a ~3-line change in one file. Everything downstream (`isCleanPreview`, `isPreviewMode`, `viewMode`) will evaluate to `edit`/`false`, restoring the original trip page behavior.

