## Problem

The Budget Coach's "Drop" button has never been verified end-to-end. Reading the handler in `EditorialItinerary.tsx` (lines 6661–6688) reveals real risks:

1. **Day-number gating is brittle.** Drop only succeeds when `day.dayNumber === suggestion.day_number` AND `a.id === suggestion.activity_id`. If the edge function returns a stale or wrong `day_number` (very plausible when activities have been moved between days), the filter matches no day, no activity is removed, the handler returns `false`, and the Coach surfaces the misleading toast `"Swap was blocked — the suggested cost was not lower."` (BudgetCoach line 717) — which is wrong: the cost wasn't the issue; the wrong day was.
2. **No title verification at delete-time.** Suggestions are filtered for stale matches in `visibleSuggestions` (line 561), but only with the `current_item` text vs live title. If a UUID is reused (rare but possible after regen) and the live title check at fetch-time passed but the activity was just edited, the drop still fires blindly.
3. **No success toast.** Successful drops are silent — the user has to scroll the itinerary to confirm.

The result: a Drop click can either silently no-op (with a misleading "blocked" toast) or, in a worst-case stale-state scenario, drop an unrelated activity.

## Changes

### 1. Harden the drop handler — `src/components/itinerary/EditorialItinerary.tsx` (~lines 6661–6688)

Rewrite the `swap_type === 'drop'` branch to:

- **Find by id across ALL days**, not just `suggestion.day_number`. Survives day-number drift.
- **Verify the live title still matches `suggestion.current_item`** with a loose check (case-insensitive substring containment OR ≥1 shared 4+ char token). If not, abort with a clear toast: `"Couldn't drop — that suggestion no longer matches your itinerary. Refresh suggestions."`
- **Bail with a clear toast when the id is missing entirely** from the live state: `"Couldn't drop — item is no longer in your itinerary."`
- **Emit a success toast** on confirmed drop: `Dropped "<title>" — saved $X`.
- Continue to invalidate budget queries and call `syncBudgetFromDays`.

### 2. Don't surface a misleading "blocked" message for drops — `src/components/planner/budget/BudgetCoach.tsx` (line 717)

When `handleApply` receives `result === false` for a `swap_type === 'drop'` suggestion, suppress the generic `"Swap was blocked — the suggested cost was not lower."` toast. The drop handler now emits its own specific error, so the Coach should stay quiet on `false` for drops.

### 3. Unit-test the drop logic

Extract the drop-target resolution into a small pure helper (`resolveDropTarget(days, suggestion)` returning `{ dayIdx, activity } | { error: 'not-found' | 'title-mismatch' }`) and add `src/components/itinerary/__tests__/budgetDropResolver.test.ts` covering:

- Happy path: id present, title matches → returns target.
- Wrong `day_number` in suggestion but id present somewhere → still resolves (regression test for the brittle gating).
- Id missing from all days → `not-found`.
- Id present but live title is unrelated → `title-mismatch`.
- Loose match: punctuation/case differences, single shared token ≥4 chars → resolves.
- Missing/empty `current_item` → resolves on id alone (no false rejects).

Tests use plain object fixtures — no React rendering required, so they're fast and stable.

### 4. Out of scope

- Edge function changes to `budget-coach` (the suggestions themselves are fine; the bug is the apply path).
- Confirm dialog wording (already explicit about which item).
- Coach refresh-on-stale; existing `visibleSuggestions` filter already drops stale entries on next fetch.

## Files touched

- `src/components/itinerary/EditorialItinerary.tsx` — rewrite drop branch (~70 lines).
- `src/components/itinerary/budgetDropResolver.ts` — new pure helper (~40 lines).
- `src/components/itinerary/__tests__/budgetDropResolver.test.ts` — new test file (~80 lines).
- `src/components/planner/budget/BudgetCoach.tsx` — suppress generic blocked-toast for drops (~3 lines).