## Problem

Budget Coach is showing swap suggestions whose `current_item` (e.g. "Dinner at La Méditerranée", "Breakfast at Ob-La-Di") does not exist in the live Itinerary tab. The live itinerary actually shows Maison Sauvage, Le Comptoir du Relais, Septime, etc. The phantom names match an older itinerary version still reflected in the Payments/activity_costs layer.

## Root cause

`BudgetCoach` (`src/components/planner/budget/BudgetCoach.tsx`) does **not** re-fetch suggestions when the live itinerary content changes:

1. `fetchedRef` gates the auto-fetch to once-per-mount.
2. The "re-fetch on change" effect (line 343–348) only depends on `protectionsKey` and `dismissedKey` — **not** on the itinerary content hash.
3. The in-memory `suggestionsCache` is keyed by `tripId` and only checked inside `fetchSuggestions`. Since `fetchSuggestions` is never invoked on itinerary edits, stale suggestions are rendered indefinitely after a regenerate / smart-finish / activity edit.
4. Even when the server returns a hallucinated `current_item`, the post-filter rewrites it to `activityTitleById.get(sid)` from the **payload at request time** — so a name from an older itinerary snapshot persists in the cache and keeps rendering after the live itinerary has moved on.

The server-side guards (ID-must-exist, title-match, placeholder) are correct. The bug is purely client-side staleness.

## Fix

Edit `src/components/planner/budget/BudgetCoach.tsx`:

1. **Re-fetch on itinerary content change.** Compute a memoized `itineraryHash` from `itineraryDays` (id + title + cost per activity) and add it to the existing protections/dismissed re-fetch effect. When the hash changes, call `fetchSuggestions()` (it already self-checks the cache and TTL).

2. **Client-side phantom filter.** Before rendering, derive a `liveActivityIndex = Map<id, title>` from `itineraryDays` and:
   - Drop any cached suggestion whose `activity_id` is not present in the live itinerary.
   - Drop any suggestion whose `current_item` no longer fuzzy-matches the live title for that id (re-uses the same token logic as the server's `titleMatches`).
   This guarantees the UI never shows a swap pointing at an item that's been removed or renamed, even during the brief window between an edit and the next fetch returning.

3. **Invalidate the module-level `suggestionsCache` entry when the hash changes**, so a tab remount or component re-creation doesn't pick up the stale list.

No server changes are needed. No migration. Behavior for in-budget itineraries is unchanged.

## Files

- `src/components/planner/budget/BudgetCoach.tsx` — add content-hash re-fetch, client-side phantom filter, cache invalidation on hash change.

## Verification

- Open a trip whose itinerary has been edited since the last Budget Coach fetch — open Budget tab, confirm suggestions reference only currently-visible activities.
- Apply a swap; confirm the next fetch reflects the new state without a manual refresh.
- Toggle a protected category; confirm re-fetch still works (regression check on existing behavior).