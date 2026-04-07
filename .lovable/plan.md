

## Fix Double Close Button on Activity Concierge Sheet

The `SheetContent` component from `src/components/ui/sheet.tsx` automatically renders a close (X) button at `top-4 right-4` (line 60). The `ActivityConciergeSheet` also renders its own X button in the header (line 304). This creates two overlapping close buttons.

### Fix

**File: `src/components/itinerary/ActivityConciergeSheet.tsx`**

Remove the manual X button from the header (lines 304-306). The built-in `SheetPrimitive.Close` X from `SheetContent` already handles closing via the `Sheet`'s `onOpenChange` prop. The custom header X is redundant.

Alternatively, if we want the X to stay in the header row (visually part of the header layout), we hide the default one instead:

**File: `src/components/itinerary/ActivityConciergeSheet.tsx`**
- Remove the `<Button variant="ghost" ...><X /></Button>` block at lines 304-306

The Sheet's built-in close button will remain and handle closing. One file, three lines removed.

