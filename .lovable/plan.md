# Fix: Budget changes persist silently across regenerations

## Problem

`budget_total_cents` is the only budget field on `trips`. Every write — initial setup, the inline "Raise budget" CTA, BudgetSetupDialog edits — overwrites it in place. There is no record of what the user originally chose, no awareness in the UI that the current value differs from the original, and regeneration paths (`generate-itinerary`, day-regen, smart-finish, unlock) never touch the budget. So a $1,796 → $5,400 raise carries forward into every future itinerary with no signal to the user.

User decision: keep the current budget as-is on regeneration, but surface a clear, dismissible banner that tells the user the budget has been raised from the original and offers a one-click reset.

## Goal

1. Capture the original budget once, when it's first set, and never overwrite it on subsequent edits.
2. Whenever the live budget differs from the original, show a banner in the Budget tab: "Your budget is $5,400 — raised from $1,796 on May 4. Reset to original."
3. One-click "Reset to original" reverts `budget_total_cents` and emits `booking-changed` so all summaries refresh. The original record itself never changes; the banner simply disappears once values match again.
4. Optional dismiss persists per-trip in `sessionStorage` so the banner doesn't nag mid-session, but reappears in a fresh session as long as the values still differ.

## Storage

No schema change. Reuse the existing `budget_allocations jsonb` column on `trips`, adding two optional fields:

```jsonc
{
  // existing fields …
  "original_total_cents": 179600,
  "original_set_at": "2026-05-04T12:30:00Z"
}
```

Why `budget_allocations` and not a new column:
- Already loaded everywhere budget settings are read.
- Avoids a migration for a small piece of metadata.
- `BudgetAllocations` type already passes through unknown keys via `Partial<>` merges — additions don't break consumers.

## Changes

### 1. `src/services/tripBudgetService.ts`
- Extend `BudgetAllocations` (or sibling type) to include optional `original_total_cents?: number` and `original_set_at?: string`.
- In `getTripBudgetSettings`, surface these fields on the returned settings object so UI can read them without a second query.
- In `updateTripBudgetSettings`, when the caller provides `budget_total_cents` AND the trip currently has no `original_total_cents` recorded, atomically seed `budget_allocations.original_total_cents` with the **incoming** value and `original_set_at = now()`. This handles brand-new trips correctly (first-set value is the original) and also backfills legacy trips on their next budget mutation (current value becomes the original baseline).
- For all subsequent budget writes, never overwrite `original_*` fields.

### 2. `src/components/planner/budget/BudgetSetupDialog.tsx`
- No logic change needed beyond going through the updated service. First-time setup persists original automatically via the seed-on-first-write rule.

### 3. `src/components/planner/budget/raiseBudgetApply.ts`
- No change. It calls `updateSettings({ budget_total_cents })` which now preserves `original_*` automatically.

### 4. New component: `src/components/planner/budget/BudgetRaisedBanner.tsx`
- Props: `currentCents`, `originalCents`, `originalSetAt?`, `tripId`, `onReset()`.
- Renders only when `currentCents !== originalCents` and the user hasn't dismissed it for this trip in `sessionStorage` (`budget-raised-banner-dismissed:${tripId}`).
- Layout (semantic tokens only):
  - Icon (`Info` or `TrendingUp`) + headline: "Your budget is **{currentCents}**" (or "Your budget is currently **{currentCents}**, lowered from {originalCents}" if lowered).
  - Sub-line: "Raised from **{originalCents}** on {date}. This persists across regenerations."
  - Actions (right side): `Reset to original` (primary, ghost) and `Dismiss` (icon button).
- Reset confirms inline: replace banner copy with "Reset budget to {originalCents}?" + Confirm / Cancel for two seconds, then commit. Avoids accidental clicks on a destructive financial change.

### 5. `src/components/planner/budget/BudgetTab.tsx`
- Read `original_total_cents` and `original_set_at` from `settings`.
- Render `<BudgetRaisedBanner>` near the top of the tab, just above the existing Trip Total / Paid summary block.
- `onReset` calls `updateSettings({ budget_total_cents: originalCents })`, dispatches `booking-changed`, toasts "Budget reset to {originalCents}". This piggybacks on the existing raise/undo plumbing.

## Out of scope
- No changes to regeneration code (`generate-itinerary` and friends). The budget intentionally persists; the banner is the surface that informs the user.
- No new DB column or migration.
- No backfill script — legacy trips backfill their original value the next time their budget is touched.
- No analytics; banner dismiss is local-only.

## Verification

1. New trip → set budget $1,796 → DB has `budget_allocations.original_total_cents = 179600`. No banner shown.
2. Click inline "Raise budget to $5,400" → DB updates `budget_total_cents` only; `original_total_cents` unchanged. Banner appears with "Raised from $1,796 on …".
3. Click "Reset to original" → confirm → `budget_total_cents` returns to $1,796; banner disappears; `booking-changed` event refreshes Trip Total and Coach.
4. Regenerate itinerary → banner still visible, current budget unchanged.
5. Dismiss → banner hidden for the rest of the session; reappears on next page load while values still differ.
6. Legacy trip with budget but no original → on first edit through BudgetSetupDialog, original is seeded with the **new** value entered (first deliberate user choice in this flow); subsequent raises trigger the banner as expected.
