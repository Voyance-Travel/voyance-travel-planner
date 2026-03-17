

## Fix: VoyanceInsight Showing in Wrong Places on Activity Cards

### Problem

The mobile activity card section shows `VoyanceInsight` for **all** activities that have `tips`, including Voyance Pick activities. Meanwhile, the desktop card correctly separates the two:
- Voyance Pick activities → show `VoyancePickCallout` (not `VoyanceInsight`)
- Regular activities → show `VoyanceInsight`

The mobile section (lines 9444-9448) is missing both:
1. The `!activity.isVoyancePick` filter (so Voyance Picks incorrectly show the generic insight badge)
2. The `VoyancePickCallout` component entirely (so Voyance Picks get no special treatment on mobile)

### Fix

**File: `src/components/itinerary/EditorialItinerary.tsx`**

In the mobile expandable detail section (~line 9444):

1. Add `VoyancePickCallout` for Voyance Pick activities (matching the desktop pattern at line 9759)
2. Add `!activity.isVoyancePick` filter to the existing `VoyanceInsight` render (matching the desktop pattern at line 9765)

This is a 2-line condition change + ~5-line addition, all in one file.

