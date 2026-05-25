## What is failing

This is not a normal Day 1 content failure. The current database state for the Mexico City trip shows:

- `itinerary_status = not_started`
- `itinerary_data.days = 0`
- `itinerary_days rows = 0`
- `generation_logs rows = 0`
- `metadata.generation_trace = []`
- repeated client-side `generation_stalled: day 0/4` entries

That means the backend Day 1 worker is not currently failing inside Step 3 or validation. The app is showing “Crafting Day 1” while no active generation run exists anymore. Earlier attempts likely died before or around launcher/pre-chain startup, then the trip was reset to `not_started`; the current UI path does not recover cleanly from that state.

## Likely root cause

The last hardening moved pre-chain setup into the initial `generate-trip` request so it runs synchronously before the browser receives a response. That makes the launch path fragile: if the initial request is slow, times out, is interrupted, or the client unmounts, the user can sit on Day 1 with no durable Day 1 worker trace.

Also, the frontend mobile/server-chain path only polls while its own `loading` state is true. It does not reliably reconcile the actual trip status after a reset to `not_started`, so the UI can continue looking like generation is active even when the backend says nothing is running.

## Plan

1. **Restore a fast launcher response**
   - Make `generate-trip` write durable metadata immediately and return quickly again.
   - Move heavy pre-chain enrichment behind a guarded background step, but with hard time caps and a guaranteed failure marker if it cannot queue Day 1.
   - Do not let restaurant pool generation or enrichment block the browser request.

2. **Make Day 1 queueing durable and observable**
   - Add/ensure trace phases for:
     - `launcher_received`
     - `launcher_metadata_init`
     - `launcher_prechain_background_started`
     - `launcher_enrichment_started`
     - `launcher_enrichment_completed` or `launcher_enrichment_timeout`
     - `launcher_day_1_invoke_queued`
     - `launcher_day_1_invoke_returned`
     - `day_started`
   - If Day 1 is not queued, mark the trip `failed` with a clear `generation_error` instead of leaving a spinner.

3. **Add a watchdog safety net**
   - If a trip is `generating` with `generation_completed_days = 0` and no `day_started` trace after a short threshold, automatically mark it `failed`/retryable with a precise launcher timeout reason.
   - This prevents “Crafting Day 1” from lasting hours.

4. **Fix frontend recovery from stale/not-started state**
   - In the server-chain polling path, if the backend is `not_started` or has no heartbeat/trace after launch, stop the spinner and show an actionable retry error.
   - Surface backend `generation_error`/`chain_error` instead of a generic endless loading state.
   - Avoid showing “Crafting Day 1” when the backend says there is no active run.

5. **Reset and verify the affected trip**
   - Reset the Mexico City trip cleanly without double-charging.
   - Trigger one generation and confirm in data that it reaches:
     - `launcher_day_1_invoke_queued`
     - `launcher_day_1_invoke_returned`
     - `day_started`
     - `generation_completed_days >= 1`

6. **Regression coverage**
   - Add focused tests for:
     - launch returns quickly after metadata init
     - own-background duplicate bypass still works
     - Day 1 queue failure marks the trip failed
     - frontend does not spin forever when backend returns to `not_started`

## Expected result

After this, Day 1 either starts and leaves a durable trace within minutes, or the user gets a real retryable failure state. No more silent multi-hour “Crafting Day 1” waits.