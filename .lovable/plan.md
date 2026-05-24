## Goal
Stop initial itinerary generation from failing into stuck/spinner/empty-trip states. The fix should make generation durable across 504s/timeouts, recover table-complete trips automatically, and prevent users from paying for missing days.

## What I found
- The app still does expensive pre-chain work inside the initial `generate-trip` request before it returns. That can itself hit the edge-function timeout and produce a 504 before the self-chain is reliably launched.
- The “server-side generation” pattern is only partial: `generate-trip` synchronously computes context/restaurant pools, then calls `generate-trip-day`. It does not use `EdgeRuntime.waitUntil`, so the initial request is not a true quick-ack background handoff.
- `generate-trip-day` can write normalized day/activity rows while `trips.itinerary_data.days` stays empty or stale if a later step times out. Current recovery is split across `ItineraryGenerator`, `TripDetail`, and the poller, so different screens disagree.
- `useGenerationPoller` still treats `partial` as terminal even when normalized tables may prove all expected days exist with real activities.
- `ItineraryGenerator.recoverFromDatabase()` counts `itinerary_days`, but does not reconstruct from `itinerary_activities`; it mostly waits if JSON is empty.
- There is still legacy client-driven per-day generation code in `useItineraryGeneration`; even if not primary, it is a risk path for mobile/background suspension.

## Plan

### 1. Make `generate-trip` a quick durable launcher
- Move the heavy pre-chain context work out of the initial HTTP response path.
- In `handleGenerateTrip`, do only:
  - auth/access/frozen checks
  - canonical total-day calculation
  - generation metadata initialization
  - stale table cleanup for fresh generation
  - launch background work via `EdgeRuntime.waitUntil(...)`
  - return a fast success response (`status: generating`) to the client
- The background continuation will perform current pre-chain enrichment, then invoke day 1.
- If the background launch fails, mark the trip `failed` with explicit metadata instead of leaving it stuck.

### 2. Add a single generation recovery service on the frontend
- Create one shared helper that rebuilds canonical `itinerary_data.days` from:
  - `itinerary_days`
  - `itinerary_activities`
  - existing `trips.itinerary_data` as a merge source only
- Validate before promoting:
  - expected total days from trip dates/metadata/table count
  - every expected day exists
  - every day has real activities
  - shell rows do not count
- Return a structured result: `ready`, `in_progress`, `partial`, or `missing`.

### 3. Use the shared recovery service everywhere
- Replace `ItineraryGenerator.recoverFromDatabase()` ad hoc logic with the shared helper.
- Update poller `onReady` path so table-complete/JSON-empty trips are rebuilt and passed to `onComplete` instead of spinning.
- Update `TripDetail` self-heal to use the same helper so refresh behaves exactly like the generator screen.

### 4. Fix poller completion semantics
- Add a “recoverable complete” branch before `partial`/`failed` terminal states:
  - if normalized tables have all expected days and each has real activities, trigger recovery/ready instead of showing partial/stalled.
- Keep shell-row protection so empty day shells never masquerade as complete.
- Clamp progress to finite 0–100 so animation never receives undefined/NaN.

### 5. Harden `generate-trip-day` finalization
- On final day, derive success from canonical table/day activity coverage, not only in-memory JSON.
- When all expected table days are populated, run a final JSON rebuild/persist pass and stamp:
  - `itinerary_status='ready'`
  - `metadata.fully_persisted=true`
  - `metadata.generation_completed_days=totalDays`
  - clear stale `failed_day_numbers`, `generation_error`, and `chain_error`
- If only some days exist, mark `partial` and refund only truly missing/failed days.

### 6. Remove or quarantine legacy client-driven generation risk
- Ensure initial generation only calls `startServerGeneration`.
- Leave legacy `generateItineraryProgressive` available only for explicit non-initial/manual paths if needed, or gate it so it cannot be used for initial paid generation.

### 7. Add regression coverage
- Table-complete + JSON-empty + status partial → rebuilds all days and promotes ready.
- Table shell rows + no activities → does not promote ready.
- Initial `generate-trip` returns quickly and does not wait on pre-chain enrichment.
- Poller handles `partial` + complete normalized tables as recoverable complete.
- Progress/circle inputs remain finite with undefined/NaN progress.

## Expected outcome
- A 504 from a long-running step no longer strands the user on “itinerary is done” or “plan from scratch.”
- If day/activity rows were written, the itinerary self-recovers into the full expected day count.
- If generation genuinely cannot produce all paid days, the app marks it partial/failed clearly and refunds missing days instead of silently charging for an unusable trip.