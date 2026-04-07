

## Fix: Missing DialogTitle Accessibility + Double X in AI Insight

### Two issues to fix

**1. `DialogContent requires a DialogTitle` warning**

Several components use `DialogContent` or `SheetContent` without a corresponding `DialogTitle`/`SheetTitle`, triggering the Radix accessibility warning in the console. The fix is to add a visually hidden title for screen readers using Radix's `VisuallyHidden` utility.

Affected components:
- `src/components/itinerary/ActivityConciergeSheet.tsx` — uses `SheetContent` with a plain `<h3>` instead of `SheetTitle`
- `src/components/modals/OutOfFreeActionsModal.tsx` — uses `DialogContent` with a plain `<h2>` instead of `DialogTitle`
- `src/components/trip/TripDebriefModal.tsx` — uses `DialogContent` with no title at all

**Fix for each:**
- `ActivityConciergeSheet.tsx`: Import `SheetTitle` from sheet.tsx, wrap it with `VisuallyHidden` (from `@radix-ui/react-visually-hidden`) or add `SheetTitle` with `className="sr-only"` inside the `SheetContent`
- `OutOfFreeActionsModal.tsx`: Import `DialogTitle`, add a visually hidden `<DialogTitle className="sr-only">Free actions exhausted</DialogTitle>` inside `DialogContent`
- `TripDebriefModal.tsx`: Same pattern — add a hidden `DialogTitle`

**2. Double X close button in AI Insight (ActivityConciergeSheet)**

The `SheetContent` component (from `sheet.tsx` line 60) renders a built-in close X button at `absolute right-4 top-4`. After the previous fix removed the manual X button, there should only be one. However, the built-in X may be visually conflicting with the header layout (overlapping the header content area at top-right). The fix: since the sheet has its own styled header, suppress the default close button by removing it from `SheetContent` for this usage — either by passing a custom prop or by adding `SheetTitle` properly and removing the unused `X` import.

### Files changed

1. **`src/components/itinerary/ActivityConciergeSheet.tsx`**
   - Import `SheetTitle` from sheet
   - Add `<SheetTitle className="sr-only">{actTitle} — AI Concierge</SheetTitle>` inside `SheetContent`
   - Remove unused `X` import from lucide-react

2. **`src/components/modals/OutOfFreeActionsModal.tsx`**
   - Import `DialogTitle`
   - Add `<DialogTitle className="sr-only">Free actions exhausted</DialogTitle>` after the `DialogContent` opening tag

3. **`src/components/trip/TripDebriefModal.tsx`**
   - Import `DialogTitle`
   - Add `<DialogTitle className="sr-only">Trip Debrief</DialogTitle>` after `DialogContent` opening tag

