# Fix: Stale payments persist as "Paid so far" after regenerating itinerary

## Problem

After regenerating into an empty itinerary, prior-session `trip_payments` rows (e.g. the L'Arpège $500 lunch + other activity payments) remain in the DB with `archived_at = NULL`. Both PaymentsTab and the financial snapshot sum every non-archived paid `trip_payments` row, so the $2,900 from the previous itinerary is still counted — producing the "Overpaid by $230" warning against an empty $2,670 trip.

The DB already has `archive_orphan_trip_payments(p_trip_id)` which archives every non-hotel/non-flight payment whose `item_id` isn't in the current `itinerary_data.days[].activities[]`. It's only triggered when the user clicks the manual "Reconcile previous payments" link in the Overpaid banner. On regeneration nothing calls it, so stale state lingers.

## Goal

When the itinerary changes (regenerated, day-regenerated, smart-finished, etc.), payments tied to activities that no longer exist must be archived automatically. The user should never see an unexplained "Overpaid" warning caused purely by stale rows.

## Approach

Use the financial snapshot fetch as the single chokepoint. It already loads `liveActivityIds` and `allPayments`, runs on every `booking-changed` event (which all regen paths dispatch), and is the same hook that produces the "Paid so far" number. Adding orphan detection here:

1. Catches every existing regen entry point without touching each one.
2. Fixes the displayed number on the very first refetch after regen, even before the archival RPC commits.
3. Persists the fix to the DB so PaymentsTab's next read is also clean.

## Changes

### `src/hooks/useTripFinancialSnapshot.ts`

**1. Identify orphan payments (display-time guard):**
After loading `allPayments`, build an `orphanPaymentIds` set: rows whose `item_type` is not `hotel`/`flight`, whose `item_id` is a string, is not `^manual-`, and whose `stripDaySuffix(item_id)` is not in `liveActivityIds`.

**2. Exclude orphans from the paid total:**
- In the `paidActivityIds` loop (line 154–160): skip orphan rows so the dedupe set doesn't reference dead activities.
- In the `paidFromTripPayments` loop (line 224–231): skip orphan rows so "Paid so far" excludes them immediately.

**3. Auto-archive once per snapshot fetch when orphans exist:**
- If `orphanPaymentIds.size > 0` and the user has edit permission (we already issued the read; archival RPC checks ownership server-side), fire-and-forget `supabase.rpc('archive_orphan_trip_payments', { p_trip_id: tripId })`.
- Guard with a per-trip `useRef<Set<string>>` (`archivedOrphanRunsRef`) to avoid hammering the RPC on every refetch — only call again if the orphan set changes (size or contents differ from last call).
- On success with `archived_count > 0`, log a single info line attributing the cleanup; do not toast (silent housekeeping).

**4. Manual payment guard (defensive):**
Manual rows (`^manual-`) are not tied to an activity_id, so they never count as orphans. Hotel/flight rows are also excluded from orphan detection — those are governed by the include toggles, not the activity list.

## Out of scope
- No change to PaymentsTab's UI or the manual "Reconcile" button — it remains as a recovery path and will simply find nothing left to archive after auto-cleanup.
- No change to `archive_orphan_trip_payments` RPC.
- No change to `BudgetTab` empty-state or reserve logic.
- No change to hotel/flight payment handling.

## Verification

1. Regenerate a trip into an empty itinerary while prior-session activity payments exist → "Paid so far" drops to only hotel/flight/manual contributions, "Overpaid" banner does not appear.
2. Open PaymentsTab afterward → orphan rows are archived (gone from the list).
3. Refetch repeatedly without changes → archival RPC is called at most once per orphan-set; console stays quiet.
