

# Fix: Mobile UI Crowding in Build Itinerary Flow

## Problem
On mobile (< 768px), the itinerary generation and day-card views have overlapping/cramped elements:

1. **ItineraryGenerator server-gen view** (lines 1024-1119): Progress header, safe-to-leave banner, PersonalizedLoadingProgress, EditorialItinerary preview, and skeleton are all stacked with `space-y-6` but inner elements have large padding (`py-8`, `max-w-2xl mx-auto`) that wastes space on small screens while the content itself is too dense.

2. **DayCard header** (EditorialItinerary line 7181): Uses `flex-col sm:flex-row` but the day actions row (badges, buttons) has `overflow-x-auto` with `pl-10` left padding on mobile, causing content to crowd and overflow. The day number (3-5xl font) + title + actions all compete for the same narrow space.

3. **ActivityRow** (line 7828-7833): Uses `flex-col sm:flex-row` which stacks the mobile header bar, then content, then actions vertically — but the content area (`p-3`) has too many inline badges and metadata lines for mobile, making each card very tall and visually overwhelming.

4. **Day footer** (line 7506): `flex-col gap-3 sm:flex-row` with multiple action buttons that stack vertically on mobile, taking excessive space.

## Changes

### File: `src/components/itinerary/ItineraryGenerator.tsx`
**Server-gen progress view mobile spacing:**
- Reduce outer padding from `py-8` to `py-4 sm:py-8`
- Reduce `space-y-6` to `space-y-4 sm:space-y-6`
- Safe-to-leave banner: reduce `p-4` to `p-3 sm:p-4` and `max-w-lg` stays
- Day skeleton: reduce `p-4` to `p-3 sm:p-4`
- "Browse your completed days" section: remove `max-w-2xl mx-auto` on mobile (allow full width)

### File: `src/components/itinerary/EditorialItinerary.tsx`

**DayCard header (line ~7167-7325):**
- Day number: reduce `text-3xl sm:text-5xl` to `text-2xl sm:text-5xl` on mobile
- Day actions row: remove `pl-10` on mobile → `pl-0 sm:pl-0`, use `flex-wrap gap-1` instead of `overflow-x-auto` so badges wrap instead of requiring horizontal scroll, which looks broken
- Header padding: reduce `p-4 sm:p-6` (already correct) — keep as-is

**ActivityRow (line ~7828-8220):**
- Content area: reduce `p-3 sm:p-4` — already correct
- On mobile, hide non-essential metadata to reduce vertical height:
  - Add `hidden sm:block` to the `VoyanceInsight` tip section on mobile (keep VoyancePick visible)
  - Add `hidden sm:flex` to the full address line (keep location name visible)
  - Transit badge: already compact, keep as-is
- The "See Reviews" button has `min-h-[44px]` which is correct for touch targets but adds vertical space; this is intentional for accessibility — keep it

**Day footer (line ~7506-7578):**
- Walking time + distance row: use `flex-wrap gap-2` instead of `gap-6` on mobile → `gap-2 sm:gap-6`
- Action buttons row: already uses `flex-wrap gap-1.5` — add tighter padding `px-4 py-3 sm:px-6 sm:py-4`
- Day total badge: reduce text size on mobile → `text-xs sm:text-sm`

### File: `src/pages/TripDetail.tsx`
**Generation progress view (lines 1335-1436):**
- Reduce `py-10` to `py-6 sm:py-10` on the progress header
- Safe-to-leave banner: reduce `p-4 mt-4` to `p-3 mt-3 sm:p-4 sm:mt-4`
- `max-w-md` constraint is fine — keeps content readable on mobile

## Summary
These are CSS-only changes that tighten spacing, wrap instead of overflow, and hide secondary details on mobile to prevent the "everything stacked on top of each other" feeling. No logic or data changes needed.

