## Goal

Misc bucket reads as broken/dead when it shows $0. Add a single inline empty-state hint inside the Misc row that tells users what it's for and offers a one-click "Add expense" affordance.

## Behavior

When the discretionary breakdown renders the **Misc** row and `usedCents === 0` and `allocatedCents > 0`, render a compact line directly under the progress bar:

> For tips, market finds, pharmacy, SIM cards.   **+ Add expense**

Clicking **Add expense** jumps the user to the Payments tab with the existing "Add Expense" dialog open and the type preselected to **Other**. No new dialog, no new dependencies.

## Implementation

Cross-tab trigger via a window event (lightweight, mirrors existing patterns like `booking-changed`). No prop drilling through `EditorialItinerary` needed.

1. **`src/components/planner/budget/BudgetTab.tsx`** — in the discretionary `.map(...)` (around line 745) render the hint after the Progress bar when `alloc.category === 'misc' && used === 0 && allocated > 0`. Button dispatches `new CustomEvent('open-add-expense', { detail: { type: 'other' } })`.

2. **`src/components/itinerary/EditorialItinerary.tsx`** — add a `useEffect` listener for `open-add-expense`: switch `setActiveTab('payments')` and re-dispatch the event one tick later so the now-mounted PaymentsTab can pick it up.

3. **`src/components/itinerary/PaymentsTab.tsx`** — add a `useEffect` listener for `open-add-expense` that sets `setNewExpenseType(detail.type ?? 'other')` and `setShowAddExpenseModal(true)`.

## Files

- `src/components/planner/budget/BudgetTab.tsx` — hint + dispatch.
- `src/components/itinerary/EditorialItinerary.tsx` — tab switch + re-dispatch.
- `src/components/itinerary/PaymentsTab.tsx` — listener opens dialog with `type=other` preselected.

## Out of scope

- A separate misc-only dialog (would fragment the manual-expense flow).
- Toolbar CTA (per discussion: bucket is the right home).
- Restyling the Add Expense dialog itself.

## Result

When a user lands on the Budget tab and sees Misc at $0, the row teaches them what the bucket exists for and gets them to "add one" in a single click — no head-scratching, no extra navigation.