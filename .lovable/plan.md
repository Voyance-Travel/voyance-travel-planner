## What's actually true

The user's report says `voyanceAPI.updateTrip()` silently orphans activities when dates change. **The footgun is real but no current consumer code triggers it.** Here's what I found:

- **Consumer date editing (the path users actually click)** goes through `src/components/trip/TripDateEditor.tsx` → `TripDetail.handleDateChange` (lines 1906-2071). That path already:
  - Snapshots a version for undo (`saveTripDateVersion`).
  - Re-shapes `itinerary_data.days` for shift/extend/shorten.
  - **Archives** removed days into `itinerary_data.archivedDays` instead of dropping them.
  - Writes dates + itinerary atomically via `safeUpdateItineraryData` with sibling fields.
  - Syncs `trip_cities` via `syncCitiesAfterDateChange`.
  - Updates hotel check-in/out.
  - Has flight warnings + day-of-week warnings before applying.

- **`voyanceAPI.updateTrip` (lines 254-304)** does only `UPDATE trips SET …`. It is exported and re-exported via `src/services/voyance.ts`, but no current code calls it with `startDate` or `endDate`. The agent CRM uses `agencyCRM.updateTrip` against a different table (`agency_trips`); `src/services/supabase/trips.ts` has its own `updateTrip` used only for itinerary/flight/hotel selection.

So #2 in the user's bullet list ("Soft: prompt user...") **already exists** in the consumer path. The real gap is the footgun: a future caller (an agent action, an AI tool, a quick-edit modal) could call `voyanceAPI.updateTrip({ startDate, endDate })` without going through `TripDateEditor` and silently orphan activities. Plus there's no detection for trips that already drifted (legacy data, manual SQL edits, race conditions).

#3 in the user's report (handleUpdateActivity cost sync + auto-lock) — already shipped in the previous turn. Nothing to do.

## Fix

Two layers, no UX change for users on the happy path.

### Layer 1 — Close the footgun in `voyanceAPI.updateTrip`

In `src/services/voyanceAPI.ts:254-304`, refuse `startDate` / `endDate` updates unless the caller explicitly opts in:

```ts
export async function updateTrip(tripId: string, updates: Partial<{
  // ...existing fields
}>, options?: { allowDateChange?: boolean }): Promise<BackendTrip> {
  if ((updates.startDate || updates.endDate) && !options?.allowDateChange) {
    throw new Error(
      '[voyanceAPI.updateTrip] Refusing to change start_date/end_date directly — ' +
      'this orphans activities outside the new window. Use TripDateEditor → ' +
      'TripDetail.handleDateChange (which archives removed days, renumbers, and ' +
      'updates trip_cities + hotel selection atomically), or pass ' +
      '{ allowDateChange: true } if you have already reshaped itinerary_data.'
    );
  }
  // ...rest unchanged
}
```

This is a runtime guard, not just a comment — prevents future regressions during AI edits, copy-paste, refactors. No current call site passes dates so nothing breaks. The error message points devs to the correct path.

### Layer 2 — Detect existing drift on trip load (one-time, free)

Add a pure helper `detectOrphanActivities(trip)` and surface a non-blocking banner if any are found. This catches:
- Trips whose dates were edited via SQL or before TripDetail.handleDateChange existed.
- Edge regen races where `itinerary_days.date` falls outside the trip window.
- Future bugs we don't know about.

**Helper** (new file `src/lib/itinerary/detectOrphanActivities.ts`):

```ts
export interface OrphanReport {
  outOfRangeDays: Array<{ dayNumber: number; date: string; activityCount: number }>;
  beforeStart: number;
  afterEnd: number;
  totalActivities: number;
}

export function detectOrphanActivities(args: {
  startDate: string;
  endDate: string;
  days: Array<{ dayNumber: number; date?: string; activities?: any[] }>;
}): OrphanReport {
  // Normalize to local-date YYYY-MM-DD; flag any day with date < start or > end
  // and ignore days with empty/missing date (they're new blank inserts).
}
```

**Surface** (in `TripDetail.tsx`, just below the existing date-change toast block, on initial trip load): when `report.outOfRangeDays.length > 0`, show a soft banner inside `EditorialItinerary`'s header:

```
⚠ N activities are scheduled outside your trip dates (Jan 1–7).
   [Shift them into range]  [Archive them]  [Dismiss]
```

- **Shift them into range**: call `handleDateChange` with `isShiftOnly: true`-equivalent reshape that renumbers orphan days into the available window.
- **Archive them**: move out-of-range days into `itinerary_data.archivedDays` (same archive bucket the existing shorten flow uses), preserving them for undo.
- **Dismiss**: write `metadata.orphan_warning_dismissed_at` so the banner doesn't reappear on every refetch; recompute next time the dates change.

No auto-shift, no auto-delete — matches the user's "soft" preference.

### Out of scope

- `agencyCRM.updateTrip` against `agency_trips` — different table, different shape, separate code path. If/when an agent UI starts editing those dates with activities attached, repeat the same pattern there.
- Server-side trigger to enforce the invariant. The DB-level fix would need a `trips_validate_dates` trigger that joins `itinerary_days`, which is heavier than the user's bug warrants today. Layer 1 + Layer 2 give us 99% of the value at a fraction of the cost.
- `handleUpdateActivity` (cost sync + auto-lock) — already fixed earlier in this thread.

## Files

- `src/services/voyanceAPI.ts` — add `options.allowDateChange` guard (~10 lines).
- `src/lib/itinerary/detectOrphanActivities.ts` — new, ~40 lines.
- `src/components/itinerary/EditorialItinerary.tsx` — add banner row + handlers (~60 lines, presentation-only).
- `src/pages/TripDetail.tsx` — wire the banner's "Shift" / "Archive" handlers into the existing `handleDateChange` machinery (~30 lines, reuses existing code).
- No DB migration, no edge-function change.

### Verification

1. Call `voyanceAPI.updateTrip(id, { startDate: '2026-01-01' })` from a dev console → throws with the guard message.
2. Same call with `{ allowDateChange: true }` → succeeds (escape hatch).
3. Manually `UPDATE trips SET end_date = '2026-01-07' WHERE id = …` on a trip with day 8–10 activities; reload TripDetail → banner appears reading "3 days outside your trip dates".
4. Click "Archive them" → those days move to `archivedDays`, banner clears, totals on Budget/Payments drop accordingly via the existing `cleanupRemovedActivityCosts` path.
5. Click "Shift them into range" on a trip where the active window has empty days → orphan days renumber into the gap, banner clears.
6. Click "Dismiss" → banner stays gone across refetches until dates change again.
7. Existing TripDateEditor flow unchanged — nothing breaks because no consumer call site passes dates to `voyanceAPI.updateTrip` today.