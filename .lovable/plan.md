

## Fix: "Add Flight" in Day 1 should open modal in-context

### Root cause

The `ArrivalGamePlan` component's "Add Flight" button (line ~8537) calls `onNavigateToBookings`, which is wired to `setActiveTab('details')` — switching the user to the Flights & Hotels tab instead of opening the flight entry modal in place.

The Flights & Hotels tab already has an `AddFlightInline` component with a hidden trigger (`data-add-flight-trigger`) that opens a modal dialog. The same pattern is used in the empty-state CTA (line ~6217).

### Fix

**File: `src/components/itinerary/EditorialItinerary.tsx`**

1. **Add `onAddFlight` callback to `ArrivalGamePlanProps`** (optional, alongside existing `onNavigateToBookings`):
   - New prop: `onAddFlight?: () => void`

2. **Embed a hidden `AddFlightInline` inside `ArrivalGamePlan`** (same pattern as line 6227–6240), and wire the "Add Flight" / "Add Hotel" buttons to click its `data-add-flight-trigger` instead of calling `onNavigateToBookings`.

   Alternatively (simpler): **Replace `onNavigateToBookings` with a callback that clicks the existing hidden trigger**. At lines 5695/5708/5732, change:
   ```tsx
   onNavigateToBookings={() => {
     const btn = document.querySelector('[data-add-flight-trigger]') as HTMLButtonElement;
     if (btn) btn.click();
     else setActiveTab('details'); // fallback
   }}
   ```

3. **Update the three call sites** (lines ~5695, ~5708, ~5732) that pass `onNavigateToBookings` to `ArrivalGamePlan`.

4. **Keep "Finish Details" button** (line 8514, shown when flight exists but is incomplete) pointing to `setActiveTab('details')` — that one is intentional since the user needs the full form.

### Result
- "Add Flight" from Day 1 opens the flight entry modal in-context
- No tab navigation disruption
- "Finish Details" still navigates to the full Flights & Hotels tab as intended

