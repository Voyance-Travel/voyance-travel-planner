

# Fix Activity Cards Rendering Twice / Day Collapse

## Root Cause Analysis

**1. Days 2+ collapse to show only 1 activity:**

The `DayCard` component (line 9099) has `overflow-hidden` on its outer container. Inside, the activities section is wrapped in a `motion.div` with `initial={{ height: 0, opacity: 0 }}` (line 9312). When switching days via the day picker (line 5669), the DayCard receives a new `key={selectedDay.dayNumber}` (line 6111), causing React to **remount** it. On remount, framer-motion replays the `initial` animation — starting at `height: 0`. Combined with `overflow-hidden`, this clips all content.

The animation from `height: 0` to `height: 'auto'` is a known framer-motion reliability issue. Day 1 works because it's the first mount and the animation completes successfully. Days 2+ remount into the same animation, which can glitch and leave content clipped.

**2. Activity text appears twice in DOM:**

This is by design — each activity renders **two** `ActivityRow` components: one wrapped in `sm:hidden` (mobile, line 9491) and one in `hidden sm:block` (desktop, line 9561). Text extraction tools see both. This is standard responsive rendering and not a bug, but contributes to confusion.

## Changes

### 1. `EditorialItinerary.tsx` — Fix the collapse animation (DayCard component, ~line 9309-9316)

When `effectiveExpanded` is already `true` on mount, skip the entry animation by setting `initial={false}`. This prevents the `height: 0` → `height: auto` animation from firing on day switch:

```typescript
<AnimatePresence initial={false}>
  {effectiveExpanded && (
    <motion.div
      key="day-content"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
```

Adding `initial={false}` to `AnimatePresence` tells framer-motion to skip the entry animation when the child is already present on first render. Since days are always expanded when selected (line 5670 sets `expandedDays` to include the clicked day), the content renders at full height immediately instead of animating from zero.

### 2. No changes needed for the "twice in DOM" issue

The dual mobile/desktop rendering is intentional responsive design. No fix required.

## Files to modify
- `src/components/itinerary/EditorialItinerary.tsx` — add `initial={false}` to `AnimatePresence` in DayCard (~line 9309)

One targeted edit. No backend changes, no new files.

