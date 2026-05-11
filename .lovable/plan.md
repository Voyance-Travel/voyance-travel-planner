## Updated finding

You’re right to push back. The current saved Bruges JSON still has meals, but there are page-load code paths that can change what the itinerary looks like, and some of them can also persist changes. That is the risk to fix.

The biggest suspect is not the financial snapshot. It’s refresh-time “self-heal” / synthetic logistics logic:

1. `TripDetail.tsx` has automatic self-heal blocks that run on load. They can call `save-itinerary` / `safeUpdateItineraryData` after detecting empty/missing days or version-history restores.
2. `EditorialItinerary.tsx` derives `days` from `rawDays` and injects/removes synthetic departure/transport cards during render. That logic filters activities after departure cutoffs. If derived `days` ever gets passed into `syncBudgetFromDays` or save flows, it can make the ledger/content disagree with the original generated trip.
3. There are load-time logistics syncs that dispatch `booking-changed`, causing financial refetches while the page is still hydrating. This can make the price drop look like content was deleted even if the JSON did not change.

## Plan

### 1. Add a page-load mutation guard

Scope load-time repair so refresh cannot silently rewrite a completed itinerary.

- In `TripDetail.tsx`, restrict auto self-heal writes to truly incomplete states only:
  - `itinerary_status` is `generating`, `queued`, or `failed`, or
  - a day is missing/empty and the trip is explicitly marked incomplete.
- Do not call `save-itinerary` or `safeUpdateItineraryData` from the empty-day/version-history self-heal path on a normal `ready` trip unless the user explicitly clicks a recovery action.
- If a ready trip has suspicious empty/missing days, show the existing recovery UI/banner instead of mutating data on refresh.

### 2. Keep synthetic logistics as display-only

Prevent render-derived cleanup from becoming persisted itinerary truth.

- Keep the `days = useMemo(...)` synthetic card logic as UI-only.
- Audit save/sync calls in `EditorialItinerary.tsx` so `syncBudgetFromDays` and itinerary persistence are only triggered by explicit user actions, not hydration/render effects.
- Ensure departure-cutoff filtering cannot remove real dining/activity cards from the persisted `itinerary_data` during a refresh.

### 3. Stabilize the Trip Total during hydration

Avoid a scary number changing while content and ledger are still loading.

- During `financialSnapshot.loading`, render “Calculating…” instead of a fallback total.
- Keep the canonical source as `activity_costs` once loaded.
- Do not fire visible delta indicators for the initial hydration pass.

### 4. Add diagnostics for this exact regression

Add small, targeted logging/guards so we can prove refresh is no longer destructive.

- Before any automatic itinerary write from page-load code, log the reason, day counts, and meal counts.
- If an automatic write would reduce activity count or meal count on a ready trip, block it and warn instead.
- Keep this guard local to refresh/self-heal paths so explicit user edits still work.

### 5. Verify on the Bruges trip

Use the known trip `e0655f06-03fc-4fd3-91c2-c8771b588da5`:

- Before refresh: record per-day activity count and meal count.
- Hard refresh itinerary page.
- After refresh: counts must match exactly.
- Trip Total must either show loading briefly or the canonical value, never a high number followed by a drop.
- No automatic save/recovery path should run for a normal ready trip.

## Expected result

Hard refresh becomes read-only for completed trips. It can refetch data and recalculate display values, but it cannot silently remove meals, remove activities, rewrite days, or create itinerary gaps.