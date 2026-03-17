

## Fix: Airport State Persistence in Add Flight Modal

### Root Cause

`AddFlightInline` (line 186 of `AddBookingInline.tsx`) initializes its `legs` state with `useState(buildInitialLegs)`. The initializer function only runs on **first mount**. When the user navigates between trips (e.g., from a London/Paris/Rome trip to a new NOLA trip), the component may not unmount — React reuses the existing instance. The `legs` state retains ATL and LHR from the prior session because there is no `useEffect` to reset state when props like `tripId`, `origin`, `existingLegs`, or `multiCityRoute` change.

Compare with `FlightDetailsModal` (line 218-228), which correctly resets all state in a `useEffect` keyed on `open` + `initialDetails`. `AddFlightInline` has no equivalent.

### The Fix

Add a `useEffect` in `AddFlightInline` that resets `legs` to `buildInitialLegs()` whenever the key props change: `tripId`, `origin`, `existingLegs`, `existingOutbound`, `existingReturn`, `multiCityRoute`, and `editMode`.

To avoid stale closure issues with `buildInitialLegs` (which reads props), the simplest approach is to inline the rebuild logic inside the effect, or use a `key` prop pattern.

### File Changes

| # | File | Change |
|---|------|--------|
| 1 | `src/components/itinerary/AddBookingInline.tsx` | Add a `useEffect` after the `useState` (line ~186) that resets `legs` via `setLegs(buildInitialLegs())` when `tripId`, `origin`, `editMode`, or the serialized `existingLegs`/`multiCityRoute` change. Also reset `showManualEntry` to `editMode` and `expandedLeg` to `null`. |
| 2 | `src/components/itinerary/EditorialItinerary.tsx` | Add a `key={tripId}` prop to both `AddFlightInline` instances (lines 5782 and 6397) as an additional safety net — forces full remount when switching trips. |

The `useEffect` approach handles prop changes within the same trip context (e.g., edit mode toggling), while the `key` prop handles cross-trip navigation. Both layers together eliminate stale airport data.

