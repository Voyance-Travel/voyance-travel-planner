# Finding: "Raise budget" persistence is intentional, not a state leak

## What's happening
The "Raise budget to $X" CTA in BudgetTab calls `applyRaiseBudget` (`src/components/planner/budget/raiseBudgetApply.ts`), which writes the new value to `trips.budget_total_cents` via `updateSettings` in `tripBudgetService.ts`. That's a database column on the trip row — not session storage, not a cache. So it correctly survives:

- page reloads
- new browser sessions
- different devices
- collaborators on the same trip

The $5,400 you're seeing is the value you committed during the previous test. The original $1,796 was overwritten the moment "Raise budget" was clicked.

## Is this correct?
**Yes** — same as editing any other trip field (dates, hotel, traveler count). There is no "session" scope for trip settings; a trip is a persistent entity. The button copy ("Raise budget to $X") communicates a permanent action, and the success toast confirms it ("Budget raised to $X").

## Not a leak because
- No cross-trip contamination (column is per-trip)
- No cross-user contamination (RLS on `trips`)
- No hidden write — the action is explicit, user-initiated, and toasted

## Optional polish (only if you want it)
If the concern is that the change feels too irreversible, possible non-functional tweaks:

1. **Confirm before raising** — small `AlertDialog`: "Permanently raise this trip's budget from $1,796 to $5,400?" Adds friction to an otherwise one-click destructive-ish action.
2. **Undo toast** — replace the success toast with one that has an "Undo" action that restores the prior value within ~10s. Same pattern we use elsewhere.
3. **History entry** — log budget changes to `cost_change_log` (already used for floor adjustments) so the user can audit when/why budget moved.

None of these are required — the current behavior matches the table-driven, persisted-trip model. Let me know if you want any of the three above and I'll scope it.
