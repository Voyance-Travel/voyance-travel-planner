

# Content Gating: Full Preview with Frosted-Glass Blur

## Summary

Replace the current "hide and show lock icon" gating pattern with a "show everything but blur premium details" pattern. Activities on locked days will show titles, times, and category tags clearly, with descriptions, insights, costs, addresses, photos, and booking links visible but blurred behind a frosted-glass overlay. Each locked day gets an unlock button overlay, and a bulk unlock option appears in the header when 3+ days are locked.

## Current State

The existing gating infrastructure is already solid:
- `canViewPremiumContentForDay()` correctly determines access per day
- `useEntitlements` provides `is_first_trip`, `unlocked_day_count`, `trip_has_smart_finish`
- `LockedField` and `LockedPhotoPlaceholder` components hide content entirely
- `useUnlockDay` hook handles single-day unlock with credit spending
- `spend-credits` edge function supports `unlock_day` (60 credits) and `group_unlock` actions
- Days with `metadata.isLocked` show a `LockedDayCard` (blank canvas with CTAs)

What needs to change: instead of hiding content or showing blank cards, show the actual content with a CSS blur overlay.

## Changes

### 1. New Component: `FrostedGateOverlay` (`src/components/itinerary/FrostedGateOverlay.tsx`)

A reusable wrapper that applies `backdrop-filter: blur(8px)` over its children and shows an unlock CTA centered on top.

Props:
- `dayNumber: number`
- `activityCount: number`
- `creditCost: number` (default 60)
- `onUnlock: () => void`
- `onClickBlurred?: () => void` (triggers unlock prompt when clicking blurred content)

Renders:
- Children (the actual activity content) wrapped in a `relative` container
- An overlay div with `backdrop-filter: blur(8px)` and a semi-transparent background
- Centered teal "Unlock Day X - 60 credits" button
- Below button: "{X} activities curated for your DNA profile" text
- `pointer-events: auto` on the overlay so clicking anywhere triggers unlock

### 2. New Component: `BulkUnlockBanner` (`src/components/itinerary/BulkUnlockBanner.tsx`)

Shows when 3+ days are locked. Displays in the trip header area.

Props:
- `lockedDayCount: number`
- `tripId: string`
- `onUnlockComplete?: () => void`

Credit tiers (matching group_unlock in spend-credits):
- 2-3 locked days: 150 credits
- 4-6 locked days: 300 credits
- 7+ locked days: 500 credits

UI: Compact banner with "Unlock All Remaining - {credits} credits" button. Shows savings vs individual unlock (lockedDays x 60).

### 3. Modify `ActivityRow` in `EditorialItinerary.tsx` (~line 5642)

**Current behavior when `!canViewPremium`:**
- Description: shown fully (NOT gated -- this is a bug)
- Photo: `LockedPhotoPlaceholder` (hidden entirely)
- Address: `LockedField` (lock icon + "Details available after unlock")
- Cost: Lock icon + "Cost hidden"
- Voyance Insight: hidden entirely
- Booking links: hidden entirely
- Reviews: hidden entirely

**New behavior when `!canViewPremium`:**
- Title: visible (no change)
- Time/duration: visible (no change)
- Category tag: visible (no change)
- Description: wrap in a div with `blur-sm` class
- Photo: show the actual photo but with `blur-md` CSS class instead of `LockedPhotoPlaceholder`
- Address: show the actual address text with `blur-sm` instead of `LockedField`
- Cost: show the actual cost with `blur-sm` instead of lock icon
- Voyance Insight: render it but wrap in `blur-sm`
- Booking links: render but wrap in `blur-sm`
- Reviews badge: hidden (no change -- nothing to blur)

Implementation: Instead of conditionally rendering `LockedField`/`LockedPhotoPlaceholder`, always render the real content but conditionally apply a CSS utility class. Add `pointer-events-none` to blurred sections so clicks fall through to the overlay.

### 4. Modify `DayCard` in `EditorialItinerary.tsx` (~line 5251)

When `!canViewPremium` for the current day (and not manual mode):
- Wrap the entire activities list section in `FrostedGateOverlay`
- Remove the separate `UnlockBanner` that currently shows above locked days
- Keep the day header (number, date, title, weather) fully visible outside the overlay

### 5. Replace `LockedDayCard` usage (~line 2845)

Currently, days with `metadata.isLocked` render a blank `LockedDayCard`. Change this:
- For days that have actual activity data (generated but gated): show `DayCard` wrapped in `FrostedGateOverlay`
- For days that truly have no content (placeholder stubs): keep `LockedDayCard` as fallback

The distinction: check `day.activities.length > 0`. If activities exist, show them blurred. If empty, show the blank card.

### 6. Add `BulkUnlockBanner` to the itinerary header area (~line 2740)

After the day selector tabs, before the selected day content:
- Count locked days: `days.filter(d => !canViewPremiumContentForDay(entitlements, d.dayNumber)).length`
- If lockedDayCount >= 3, show `BulkUnlockBanner`

### 7. Update trip header info line

In the day selector area or `ItineraryUtilityBar`, add a compact status line:
- Format: "{destination} - {totalDays} Days - {unlockedCount} Unlocked - {lockedCount} Locked"
- Only show when there are locked days

### 8. Bulk unlock handler

Create `useBulkUnlock` hook or inline handler that:
1. Determines credit cost based on locked day count (150/300/500)
2. Calls `spend-credits` with `action: 'group_unlock'` and appropriate `creditsAmount`
3. On success, triggers enrichment for all locked days sequentially
4. Updates `unlocked_day_count` in the trips table
5. Invalidates entitlements query

## Technical Details

**CSS blur classes (Tailwind):**
```css
.blur-gate {
  filter: blur(8px);
  -webkit-filter: blur(8px);
  pointer-events: none;
  user-select: none;
}
```
Or use Tailwind's built-in `blur-sm` (4px) / `blur` (8px) / `blur-md` (12px) utilities.

**FrostedGateOverlay structure:**
```tsx
<div className="relative">
  <div className="blur-[8px] pointer-events-none select-none">
    {children}
  </div>
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/20">
    <Button className="bg-teal-600 hover:bg-teal-700 gap-2">
      <Sparkles className="h-4 w-4" />
      Unlock Day {dayNumber} - {creditCost} credits
    </Button>
    <p className="text-sm text-muted-foreground mt-2">
      {activityCount} activities curated for your DNA profile
    </p>
  </div>
</div>
```

**Bulk unlock credit tiers:**
```typescript
function getBulkUnlockCost(lockedDays: number): number {
  if (lockedDays >= 7) return 500;
  if (lockedDays >= 4) return 300;
  return 150; // 2-3 days
}
```

**First trip vs subsequent trip logic (already handled):**
- First trip: `canViewPremiumContentForDay` returns true for days 1-2 (via `FIRST_TRIP_FREE_DAYS = 2`)
- Subsequent trips: returns true only for day 1 (preview mode, `unlocked_day_count = 1`)
- This logic is already correct in `voyanceFlowController.ts` -- no changes needed

## Files Modified

| File | Change |
|------|--------|
| `src/components/itinerary/FrostedGateOverlay.tsx` | NEW - blur overlay component |
| `src/components/itinerary/BulkUnlockBanner.tsx` | NEW - bulk unlock CTA |
| `src/components/itinerary/EditorialItinerary.tsx` | Modify ActivityRow to blur instead of hide; modify DayCard to use FrostedGateOverlay; add BulkUnlockBanner; add trip status line |
| `src/hooks/useBulkUnlock.ts` | NEW - hook for bulk day unlock via group_unlock action |

## What Does NOT Change

- Backend edge functions (spend-credits already supports unlock_day and group_unlock)
- Entitlements logic (canViewPremiumContentForDay already works correctly)
- voyanceFlowController.ts (day access logic unchanged)
- Database schema (unlocked_day_count field already exists)
- useUnlockDay hook (single-day unlock unchanged)
- Credit costs (60 per day, group tiers at 150/300/500)

