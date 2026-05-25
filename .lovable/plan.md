### What I found

The backend is healthy, but this trip is blocked by the generation authorization gate, not by the Chrome `.ldb` storage error.

For trip `e4217b97-34b6-4de4-a842-2200db6f5f73`:
- It is currently `generating` with `generation_completed_days = 0`.
- The latest generation log says: `No proof-of-charge ... blocking`.
- The only pending charge row was marked `failed` during the previous unstick/refund step, so the retry can no longer pass the proof-of-charge gate.
- The UI stays on “Crafting Day 1 of 4” because the retry sets the trip back to `generating`, then the backend rejects the actual generator call.

### Plan

1. **Unstick this trip safely**
   - Reset trip `e4217b97-34b6-4de4-a842-2200db6f5f73` from `generating` back to `not_started`.
   - Clear the stale generation heartbeat/start markers.
   - Do not create duplicate itinerary content.
   - Do not double-charge credits.

2. **Restore a valid authorization record for the already-paid generation**
   - Because the credit ledger still shows the original committed 240-credit spend, update the matching `pending_credit_charges` row from `failed` to `completed` instead of charging again.
   - This lets the existing proof-of-charge gate allow generation for the same trip.

3. **Patch retry/self-heal behavior so this does not recur**
   - Update the Day 1 retry/self-heal generation path so it does not put the trip into `generating` before confirming the generator call was accepted.
   - If generation returns `GENERATION_NOT_AUTHORIZED`, surface/recover cleanly instead of leaving the UI stuck on Day 1.

4. **Verify**
   - Re-check the trip row: status should no longer be stale `generating` with zero progress.
   - Re-check `generate-itinerary` logs for the trip: the next attempt should show `Proof-of-charge OK` or a clear actionable failure, not silent Day 1 spinning.