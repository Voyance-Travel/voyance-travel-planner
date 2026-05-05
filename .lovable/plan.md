## Problem

The Misc allocation (5% of every preset) never lights up because the itinerary generator only emits dining/activity/transit/hotel/flight categories. Nothing in the system maps to `misc` automatically. The category mapper does forward `shopping`, `nightlife`, `bar`, and `club` → `misc`, but those rarely show up either. Result: users see a permanently empty "Miscellaneous" row that reads as broken.

There's already a tiny in-row nudge ("For tips, market finds… Add expense") but it's easy to miss and the row still looks dead in the progress bars.

## Recommendation

**Keep the allocation, reframe it as an explicit cash reserve, and make the empty-state actionable.** Removing the bucket would silently merge tips/pharmacy/SIM/market spend into the buffer line and hurt budget realism. The cleaner fix: be honest that this category is a manual reserve, not an itinerary-driven spend, and surface that throughout.

### 1. Rename + relabel — `BudgetTab.tsx`, `BudgetSetupDialog.tsx`

- `categoryLabels.misc`: `'Miscellaneous'` → `'Spending Money & Tips'`.
- In `BudgetSetupDialog`, add a one-line caption under the slider: *"Cash reserve for tips, pharmacy, SIMs, market finds. Not auto-filled by the itinerary — log expenses as you go."*

### 2. Replace the misc progress bar with a "reserve" treatment — `BudgetTab.tsx`

When `category === 'misc'` and `used === 0` and `allocated > 0`:

- Hide the 0% progress bar (it visually reads as broken).
- Show in its place a small inline pill: **"$X reserved · 0 logged"** with an "+ Add expense" button on the same line, large enough to be the obvious affordance (current text-link CTA is too quiet).
- When `used > 0`, render the normal progress bar.

This keeps the allocation visible without giving users the false impression that the system "should" be populating it.

### 3. Wire the empty-state CTA to actually open the modal — `BudgetTab.tsx` + `PaymentsTab.tsx`

Today the button dispatches `open-add-expense` but `PaymentsTab` only listens for `open-add-expense:mounted`. If the user is on the Budget tab when they click, nothing opens until they navigate to Payments. Fix:

- `PaymentsTab.tsx`: also listen for `open-add-expense` (mirror the existing `:mounted` handler) and call `setShowAddExpenseModal(true)` immediately.
- `BudgetTab.tsx`: when the misc CTA is clicked, also switch the active itinerary tab to **Payments** so the modal is in view. Use the existing tab-switching event the assistant uses (`window.dispatchEvent(new CustomEvent('switch-itinerary-tab', { detail: 'payments' }))`) — verify it exists; if not, add an `onSwitchToPayments` prop wired from `EditorialItinerary`.
- Pre-select the modal's category to **"Other"** via the event detail.

### 4. Coach: add a one-time "Reserve cash for tips/extras" nudge — `BudgetCoach.tsx`

When the coach opens and `categoryOverruns.misc` is null/0 AND the misc allocation has zero logged spend AND coverage is low, prepend a non-AI synthetic suggestion card:

- Title: *"Set aside spending money"*
- Body: *"Misc reserve is $X. Log your first expense (tip, SIM, snack) so this category reflects reality — the itinerary doesn't auto-fill it."*
- Single CTA: **Add expense** → same handler as #3.
- Distinct visual (info, not warning); not counted in "potential savings"; auto-hides once any misc expense is logged or the user dismisses.

This is purely client-side — no edge-function change.

### 5. Memory

Update `mem://features/budget/budget-coach-system`: "Misc category is intentionally manual-fill. Coach surfaces a one-time info nudge when misc reserve is unspent. UI renders 'reserve pill' instead of a 0% progress bar to avoid the dead-row reading."

## Files touched

- `src/services/tripBudgetService.ts` (label only — no schema/preset change)
- `src/components/planner/budget/BudgetTab.tsx` (label, reserve pill, CTA wiring, propagate tab switch)
- `src/components/planner/budget/BudgetSetupDialog.tsx` (caption under slider)
- `src/components/itinerary/PaymentsTab.tsx` (also listen for `open-add-expense` directly)
- `src/components/itinerary/EditorialItinerary.tsx` (relay tab switch if no existing event)
- `src/components/planner/budget/BudgetCoach.tsx` (synthetic info nudge)

## Out of scope

- Removing the misc preset (would worsen realism).
- Auto-categorising shopping/nightlife into misc beyond what we already do.
- Adding new misc-generating activities to the AI prompt.

**Approve to implement?**