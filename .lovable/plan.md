## Goal

Make the Budget Coach honest when the hotel alone (or hotel + flights) blows past the budget. Today the Coach can only suggest swaps inside the discretionary slice — restaurants, taxis, activities — so when a $2,400 hotel sits inside a $1,796 budget, the suggestions feel like rearranging furniture: $19 metro swaps against a $1,900 gap.

The fix is a new "honest restructuring" path that detects fixed-cost-dominant overruns and surfaces structural advice, while keeping the existing swap suggestions visible (they're still useful for the discretionary slice).

## Root cause

`BudgetCoach.tsx` (lines 643–656) computes `coveragePct = totalPotentialSavings / gapCents` and surfaces `showRestructurePanel` when coverage <50%. The panel offers three actions: raise budget, drop optional activities, shorten the trip. None of them speak to the actual cause when the hotel is the problem.

`BudgetTab.tsx` already has `summary.committedHotelCents`, the discretionary breakdown, and a "hotel multiplier" calculation. We just don't pass any of it to the Coach.

## Changes

### 1. New props on `BudgetCoach`

In `src/components/planner/budget/BudgetCoach.tsx`:

```ts
hotelCents?: number;            // committed hotel cost (cents)
flightCents?: number;           // committed flight cost (cents)
onEditAccommodation?: () => void; // opens Flight & Hotel editor
```

### 2. Hotel-dominant overrun detection

Compute alongside the existing `coveragePct`:

```ts
const fixedCents = (hotelCents ?? 0) + (flightCents ?? 0);
const hotelOverrunsBudget = (hotelCents ?? 0) > 0 && (hotelCents ?? 0) >= budgetTargetCents;
const fixedDominantOverrun =
  budgetTargetCents > 0 &&
  gapCents > 0 &&
  fixedCents > 0 &&
  fixedCents >= budgetTargetCents * 0.85;   // hotel/flight already eats ≥85% of budget
```

When `hotelOverrunsBudget` is true (hotel alone ≥ entire budget), the Coach is mathematically incapable of bridging the gap with swaps. When `fixedDominantOverrun` is true (hotel + flight take ≥85% of budget), the discretionary slice is too small to matter.

### 3. New "Hotel exceeds your budget" panel

Render this panel **above** the existing `showRestructurePanel` and **suppress** the misleading "Swaps alone won't bridge this gap" panel when this one is showing (otherwise we double-stack two amber boxes).

Two variants based on severity:

**Variant A — Hotel alone exceeds budget** (`hotelOverrunsBudget`):
> "Your hotel ({formatCurrency(hotelCents)}) alone exceeds your entire budget of {formatCurrency(budgetTargetCents)}. Swapping restaurants or taxis won't get you on target. To balance this trip you'd need to raise the budget to about {formatCurrency(suggestedBudgetCents)} or choose a different accommodation."

CTAs:
- "Raise budget to {X}" — wires to existing `onBumpBudget` (target = `ceil((hotel + discretionary committed) * 1.05 / $500)`).
- "Change accommodation" — wires to new `onEditAccommodation` callback.

**Variant B — Fixed costs dominate** (`fixedDominantOverrun` && !hotelOverrunsBudget):
> "Your hotel + flights ({formatCurrency(fixedCents)}, {Math.round(fixedCents/budgetTargetCents*100)}% of budget) leave only {formatCurrency(budgetTargetCents - fixedCents)} for food, activities, and transit. Swaps below can shave {formatCurrency(totalPotentialSavings)} off, but to comfortably fit this trip you'd need a smaller hotel/flight bill or a higher overall budget."

CTAs: same as Variant A.

### 4. Wire from `BudgetTab.tsx`

At the `<BudgetCoach …/>` call site (lines 727–750), add:

```tsx
hotelCents={summary.committedHotelCents || 0}
flightCents={summary.committedFlightCents || 0}
onEditAccommodation={() => {
  // Existing pattern: dispatch a global event that EditorialItinerary listens to.
  window.dispatchEvent(new CustomEvent('open-flight-hotel-editor'));
}}
```

If a "Flight & Hotel" editor open-event isn't already wired (verify with `rg "open-flight-hotel"`), fall back to navigating to the `flights-hotels` section using the existing `navigateToSection` mechanism in EditorialItinerary, or simply call `setShowSetupDialog(true)` is **not** correct here — that's the budget dialog. If no opener exists, pass through a callback prop that EditorialItinerary supplies (`onOpenFlightHotelEditor`).

### 5. Suppress the misleading "Swaps alone" panel when the new panel is showing

In `BudgetCoach.tsx` line ~924:

```tsx
{!fixedDominantOverrun && !hotelOverrunsBudget && showRestructurePanel && (
  // existing "Swaps alone won't bridge this gap" panel
)}
```

### 6. Keep the swap list visible

Don't hide the swap suggestions. Even if the gap is structural, $170 of savings is still real and the user might want to apply some of them. The new panel is additive context, not a replacement.

## Files touched

- `src/components/planner/budget/BudgetCoach.tsx` — add props, detection logic, new panel, suppress old panel when new is active.
- `src/components/planner/budget/BudgetTab.tsx` — pass `hotelCents`, `flightCents`, `onEditAccommodation`.
- `src/components/itinerary/EditorialItinerary.tsx` — wire `onOpenFlightHotelEditor` event listener if one doesn't exist (fallback: scroll to `data-section="flights-hotels"`).

No backend changes. No schema changes. The `budget-coach` edge function already correctly returns small-dollar swaps for the discretionary slice; we don't need to ask the AI to "suggest dropping the hotel" because that's a structural decision better surfaced as a UI panel with explicit CTAs.

## Out of scope

- Auto-suggesting alternate hotels at lower price points (would need integrations + new flow).
- Adjusting trip duration as a fix (already covered by existing `onShortenTrip`).
- Server-side detection in `budget-coach/index.ts` (the data needed lives client-side already; a second source of truth would just drift).
