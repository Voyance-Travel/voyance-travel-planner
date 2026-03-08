

## Fix: Transport Mode Selector Freeze on Multi-City Stage 2

### Root Cause
Three interacting bugs create a render cascade that freezes the UI:
1. `changeTransportType` calls `syncToParent` and `onTransportModeChange` **inside** the `setSlots` updater — triggering parent re-renders from within child setState
2. An inline IIFE computes `transportSelections` on every render, creating a new object reference each time
3. A `useEffect` depending on `transportSelections` fires on every render due to the new reference, even when nothing changed

### Changes

**File: `src/components/planner/flight/MultiLegFlightEditor.tsx`**

1. **Fix `changeTransportType` (lines 609-622)**: Replace with a pure state update + `pendingTransportChange` state + `useEffect` for propagation. Remove `syncToParent` and `onTransportModeChange` from inside the `setSlots` updater.

2. **Guard `transportSelections` useEffect (lines 299-315)**: Add a `prevTransportSelectionsRef` to track a string signature of the previous value. Skip the effect if the signature hasn't changed, preventing unnecessary `setSlots` calls from reference-only changes.

**File: `src/pages/Start.tsx`**

3. **Memoize `transportSelections` (lines 1115-1131)**: Extract the inline IIFE into a `useMemo` with dependencies `[transportSelections, multiCityTransports]`. Pass the memoized value as the prop.

### What's NOT changing
- Slot generation logic, flight import/paste, drag-and-drop reordering, hotel section, single-city editing

