## Problem

The Trash icon on each row in **Budget tab → All Costs** is a destructive action with no validation, no confirmation, and a misleading success toast.

Tracing the path:

1. `BudgetTab.tsx` `PayableCostsList` (line ~236): the icon strips the `_dN` suffix from `item.id` and calls `onActivityRemove(rawActivityId)`.
2. `EditorialItinerary.tsx` (line 6649): the handler does `days.activities.filter(act => act.id !== activityId)` across **every day** and unconditionally fires `toast.success('Activity removed from itinerary')` and `setHasChanges(true)`.

Failure modes today:
- **Stale id after regen** → `filter` matches nothing, no day changes, but the user sees "Activity removed from itinerary". They'll think it worked.
- **No confirmation** → a misclick on the trash icon nukes a real activity instantly. There is no "are you sure?" and no in-app undo from this screen.
- **No row-name in the toast** → the user can't tell *which* item they just removed (or thought they removed).
- **Manual / orphan-payment rows** look identical visually but `canRemove` is already false for them — that part is OK; we just need to make the live-id path correct.

This was previously hardened for the Budget Coach **swap suggestion drop** path (`resolveDropTarget` in `src/components/itinerary/budgetDropResolver.ts` + tests). The All Costs trash button was missed because it goes through a different handler.

## Fix

### 1. Validate the id before mutating + add confirmation + name the row in the toast

`src/components/itinerary/EditorialItinerary.tsx` — replace the `onActivityRemove` callback passed to `<BudgetTab>` (around line 6649) with a version that:

- Walks `days` once, captures `{ dayIdx, title }` for the matching activity id.
- If not found → `toast.error("Couldn't drop — that item is no longer in your itinerary. The list may have been regenerated.")` and return. **No state mutation. No success toast.**
- Otherwise call `window.confirm("Remove \"<title>\" from your itinerary?\n\nThis can't be undone from this screen.")`. On cancel → return.
- On confirm → filter only the matching day (instead of mapping every day, which is a needless full-tree rebuild) and fire `toast.success(\`Removed "<title>" from itinerary\`)`.

### 2. Pass the row's display name into the trash handler so the confirm/toast text is correct even for orphan-rescued names

`src/components/planner/budget/BudgetTab.tsx` — extend the `onActivityRemove` prop signature in `PayableCostsList` to `(activityId: string, displayName: string) => void` (BudgetTab keeps the wider signature too) and update the `onClick` to pass `item.name`.

`src/components/itinerary/EditorialItinerary.tsx` — accept the optional second arg and prefer the live-day title when present, falling back to the passed-in displayName.

### 3. Tests

Add `src/components/itinerary/__tests__/activityRemove.test.ts` with a tiny pure helper extracted from the new logic:

```ts
// resolveLiveActivity(days, activityId) -> { found: true; dayIdx; title } | { found: false }
```

Cases:
- Real id present on day 2 → `{ found: true, dayIdx: 1, title: 'Le Jules Verne' }`
- Stale id after regen (id not in any day) → `{ found: false }`
- Empty days → `{ found: false }`
- Multiple days, id only in last day → resolves to last index

Wire `EditorialItinerary` to use this helper and unit-test the helper directly (we don't need to render the whole 11k-line component).

## Files touched

- `src/components/itinerary/EditorialItinerary.tsx` — rewrite the BudgetTab `onActivityRemove` callback (~13 lines → ~30 lines)
- `src/components/planner/budget/BudgetTab.tsx` — extend signature + pass `item.name` from the trash button
- `src/components/itinerary/activityRemoveResolver.ts` — new pure helper (mirrors the structure of the existing `budgetDropResolver.ts`)
- `src/components/itinerary/__tests__/activityRemove.test.ts` — new tests (4 cases)

## What this does NOT change

- The composite-id parsing in `BudgetTab.tsx` (`item.id.replace(/_d\d+$/, '')`) stays the same — it correctly strips `_dN` to get the underlying activity id.
- Manual entries / hotel / flight / grouped-transit rows already cannot show the trash button (the existing `canRemove` gate handles that).
- The Budget Coach AI "Drop" suggestion path (`resolveDropTarget`) is already validated and tested. This plan covers the *other* drop button — the one in All Costs.
