

## Fix: Per-Person Rounding Off by $1

**Root cause**: `Math.floor(snapshot.tripTotalCents / travelers)` floors to whole **cents** (16550), then `formatCurrency` converts to dollars ($165.50) and `Intl.NumberFormat` with `maximumFractionDigits: 0` **rounds** it to $166.

**Fix**: Floor to whole **dollars** before formatting, so $165.50 becomes $165, not $166.

### Changes

**`src/components/planner/budget/BudgetTab.tsx` (line 491)**
```
// OLD:
formatCurrency(Math.floor(snapshot.tripTotalCents / travelers))

// NEW — floor to whole-dollar cents:
formatCurrency(Math.floor(snapshot.tripTotalCents / travelers / 100) * 100)
```
This produces 16500 cents → $165.00 → "$165". The per-person sum ($165 × 2 = $330) will be ≤ the trip total ($331), never exceeding it.

**`src/components/itinerary/PaymentsTab.tsx`** — Apply the same `Math.floor(.../ 100) * 100` pattern at any per-person display lines that currently use `Math.floor(cents / travelers)`.

**`src/components/itinerary/EditorialItinerary.tsx` (day badges, lines ~8306 and ~8835)**
The day badge shows `formatCurrency(displayCost(totalCost))` where `totalCost` is in dollars. Wrap with `Math.floor()` so $82.50 → $82, preventing day totals from summing above the trip total:
```
Math.floor(displayCost(totalCost))
```

These are three small arithmetic fixes — no architectural changes.

