## Finish the hard-refresh divergence fix

Two tasks remain from the prior pass. Both are needed to actually close the class of bugs, not just `saveItineraryOptimistic`.

### 1. Harden remaining refresh-divergence writers

Audit and route every remaining client-side itinerary mutation through `safeUpdateItineraryData` so the server runs the full persist pipeline (timing cascade, table sync, activity-cost sync, metadata merge, freeze stamp) and the post-save canonical resync runs.

- `src/services/itineraryActionExecutor.ts` — verify every `updateTripItinerary` path returns the canonical save result; no raw RPC fallback for chat-driven rewrite/swap/regenerate/pacing/filter.
- `src/pages/TripDetail.tsx` — audit mount-time effects that can write `itinerary_data`:
  - keep the 5 allow-listed `generate-trip` invocation sites (locked by `TripDetail.no-silent-regen.test.ts`)
  - keep the documented self-heal sites (chronology, predawn-cascade, sparse-rebuild, version-restore, empty-day placeholder) — they already pass `skipLedgerCheck:true` + `self-heal-*` reason
  - flag any other on-mount write that mutates `days`/times/costs without a user gesture, convert to read-time derivation or metadata-only
- `src/services/safeUpdateItineraryData.ts` — after a successful save, always re-read canonical `trips.itinerary_data` and dispatch `TRIP_PERSISTED_EVENT` so in-memory state matches what a hard refresh will show. If the canonical payload differs from the attempted payload, emit a structured `[PERSIST_DRIFT]` warn (save reason, frozen status, version, day/activity/meal counts, whether cost+table sync ran).

### 2. Regression guard tests

Extend `src/services/__tests__/no-raw-itinerary-writes.test.ts` (and add a new sibling) to lock the contract so this class can't silently come back:

- Fail if any `src/` file other than the allow-list calls `optimistic_update_itinerary` RPC.
- Fail if `saveItineraryOptimistic`, `patchItineraryWithFlight`, `patchItineraryWithHotel`, or any conflict "keep mine" path stops calling `safeUpdateItineraryData`.
- New `hard-refresh-invariant.test.ts`: after a simulated `saveItineraryOptimistic`, the locally-rendered itinerary payload MUST equal the canonical payload returned by the post-save resync (asserts the new drift-detection branch fires and the resync dispatch wires up).

### Expected result

- One persistence chokepoint for every client-side write.
- One canonical resync after every save, so pre-refresh == post-refresh on Itinerary header, Payments tab, and Budget tab.
- Any future regression surfaces as a single `[PERSIST_DRIFT]` log line with enough context to diagnose, not as another silent tab-by-tab number mismatch.

### Files to change

- `src/services/safeUpdateItineraryData.ts`
- `src/services/itineraryActionExecutor.ts`
- `src/pages/TripDetail.tsx` (audit only — edits only if a non-allow-listed mount writer is found)
- `src/services/__tests__/no-raw-itinerary-writes.test.ts`
- `src/services/__tests__/hard-refresh-invariant.test.ts` (new)
