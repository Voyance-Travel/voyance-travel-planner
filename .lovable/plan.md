

## Enhancement: Contextual Star Controls by Leg Type

**File:** `src/components/planner/flight/MultiLegFlightEditor.tsx` (lines 852-882)

Wrap each star button in a `legType` conditional:
- **Arrival button**: hide when `slot.legType === 'return'`
- **Departure button**: hide when `slot.legType === 'outbound'`
- Inter-city and custom legs continue showing both

This is the exact change the user specified — a straightforward conditional render, UI-only, no data impact.

