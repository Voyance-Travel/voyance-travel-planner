
Fix the “days become unplanned after navigation” regression by making the recovery path restore data instead of silently regenerating over it.

What I found
- The affected trip currently has 4 JSON days in the backend, but Day 3 and Day 4 were overwritten with generic meal-fallback content.
- Version history proves those days were originally fully planned:
  - Day 3 version snapshot had 15 activities
  - Day 4 version snapshot had 4 activities
- The likely destructive path is in `src/pages/TripDetail.tsx`:
  - on load, “empty day” self-heal treats `activities: []` as unplanned
  - it then auto-calls `regenerate-day`
  - that rewrite can replace a previously complete day with generic fallback cards
- This is too aggressive for a trip already marked `ready`.

Plan

1. Make TripDetail recovery non-destructive
- File: `src/pages/TripDetail.tsx`
- Remove the current behavior that auto-regenerates empty days on page load for ready trips.
- Replace it with:
  1. try restoring the day from the latest non-empty version snapshot
  2. if no version exists, try rebuilding from stored activity sources
  3. only if nothing recoverable exists, show a non-destructive warning/banner instead of regenerating automatically

2. Add a “latest non-empty version” restore helper
- File: `src/services/itineraryVersionHistory.ts`
- Add a helper that fetches the newest version for a day where `activities.length > 0`.
- Reuse this in TripDetail self-heal so navigation restores the original planned day instead of inventing a new one.

3. Tighten “real day” detection everywhere
- Files:
  - `src/pages/TripDetail.tsx`
  - `src/hooks/useGenerationPoller.ts`
- Stop using raw `itinerary_days` row count as evidence that a day is complete.
- Count only days that actually contain recoverable activities.
- This prevents shell/empty days from being treated as safe or complete.

4. Stop trusting stale embedded day activity blobs for healing
- File: `src/pages/TripDetail.tsx`
- The current rebuild path reads `itinerary_days.activities` directly, but that payload can be stale/incomplete.
- Prefer this order:
  1. version snapshot
  2. canonical trip JSON day if non-empty
  3. normalized activity source
  4. never silent regeneration on a ready trip

5. Add guarded logging so this can’t silently recur
- File: `src/pages/TripDetail.tsx`
- Log which source healed the day (`version_history`, `json_day`, `normalized_rows`, `none`)
- Log when destructive regeneration is skipped for safety
- This makes future regressions diagnosable without overwriting user data

Why this approach
- The current problem is not just “days show unplanned”; it is “navigation can trigger a destructive rewrite.”
- The safest fix is to restore existing authored data first and remove silent regeneration from the ready-trip load path.

Expected result
- Navigating between legs/pages will no longer turn planned days into unplanned ones.
- If a day temporarily appears empty, the app restores the original version instead of replacing it with generic placeholders.
- Existing affected trips with version history can be recovered automatically by the new restore-first path.

Files likely involved
- `src/pages/TripDetail.tsx`
- `src/services/itineraryVersionHistory.ts`
- `src/hooks/useGenerationPoller.ts`
