

## Critical Mobile Fixes — Plan

### Fix 1.1: Dialog/Modal Mobile Sizing
**File: `src/components/ui/dialog.tsx` (line 39)**
- Add `w-[calc(100vw-2rem)]` before the existing `max-w-lg` so dialogs get 1rem margin on each side on mobile, then `sm:max-w-lg` takes over on larger screens.

**File: `src/components/itinerary/EditorialItinerary.tsx` (lines 6274, 6349)**
- Update the two dialog instances with `sm:max-w-[500px]` and `sm:max-w-[450px]` to also include `w-[calc(100vw-2rem)]` for mobile consistency.

### Fix 1.2: Chat Planner Fixed Height
**File: `src/components/planner/TripChatPlanner.tsx` (line 315)**
- Change `height: '420px'` → `height: 'min(420px, calc(100vh - 200px))'`

### Fix 1.3: Tap Target Sizes
**File: `src/components/itinerary/EditorialItinerary.tsx` (line 8303)**
- Overflow menu button: `h-7 w-7` → `h-9 w-9 sm:h-7 sm:w-7`

**File: `src/components/planner/TripChatPlanner.tsx` (lines 429, 448, 457)**
- Mic, paste, send buttons: `h-7 w-7` → `h-9 w-9 sm:h-7 sm:w-7`
- Container `gap-0.5` → `gap-1.5 sm:gap-0.5`

**File: `src/components/auth/SignInForm.tsx` (line 161-164)**
- Add `p-2` to the password toggle button for a larger hit area.

### Fix 1.4: Safe Area Support for TopNav
**File: `src/components/common/TopNav.tsx` (line 118)**
- Add `pt-[env(safe-area-inset-top)]` to the `<header>` element so the nav clears the iPhone notch in Capacitor.

### Fix 1.5: Tab Bar Fade Overlay
**File: `src/components/itinerary/EditorialItinerary.tsx` (line 4328)**
- Already has `pointer-events-none` and `sm:hidden` — confirmed correct. Reduce `w-12` → `w-6` as a safety measure to avoid any edge-case tap blocking on the rightmost tab.

### Fix 1.6: InterCityTransportEditor Bottom Sheet
**File: `src/components/itinerary/InterCityTransportEditor.tsx` (line 123)**
- Change `max-h-[85vh]` → `max-h-[min(85vh,calc(100dvh-100px))]`

### Fix 1.7: Quiz Sticky Progress Bar + Nav Overlap
**File: `src/pages/Quiz.tsx`**
- Line 661: `top-16` → `top-14 sm:top-16`, and `py-3` → `py-2 sm:py-3`
- Line 763: Add `pb-[env(safe-area-inset-bottom)]` to the sticky bottom nav container

### Summary
7 targeted fixes across 6 files — all CSS-only changes, no logic modifications.

