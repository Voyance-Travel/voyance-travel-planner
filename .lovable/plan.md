
Problem understanding (from current code + live backend data):
1) The repeated browser error (`A listener indicated an asynchronous response...`) is not thrown by app code (no matching string/runtime API usage in repo). It is typically a browser extension message-port error that appears when a long async request closes unexpectedly.
2) The real app issue is generation stalling:
   - Trip `5eb0e930-...` is stuck in `itinerary_status='generating'` with inconsistent progress metadata (`generation_total_days=19`, `generation_completed_days=15`) while actual saved days are lower/misaligned.
   - Multi-city day math is inconsistent: backend `generate-trip` currently derives total days from `days_total` in a way that can overcount (for this trip: city rows sum to 19 while date span is 17).
   - Chain-break/stall logic then keeps polling/resuming against inflated totals, so “last day” never converges cleanly.

Implementation plan:
1) Normalize multi-city day counting in backend generation
   - File: `supabase/functions/generate-itinerary/index.ts`
   - Add a shared helper for city-night normalization:
     - Prefer `nights` when present.
     - If only `days_total` exists, convert to nights safely (`max(1, days_total - 1)` for legacy inclusive rows).
   - Compute `totalDays` consistently:
     - Primary: canonical date span (`startDate..endDate`, inclusive).
     - If `requestedDays` is provided by frontend resume/start, honor it.
     - Use normalized city mapping without inflating by per-city inclusive overlap.
   - Apply this helper in all day-map loops used during generation/transition resolution/hotel day lookup so day indexing is consistent end-to-end.

2) Harden chain progression to avoid false “broken chain” stalls
   - File: `supabase/functions/generate-itinerary/index.ts`
   - Keep existing retry behavior, but ensure chain metadata only marks broken when dispatch truly fails.
   - Ensure status/metadata fields are always updated coherently after each successful day save (completed day, heartbeat, total days from normalized source).

3) Fix poller to use effective expected days (not stale inflated metadata)
   - File: `src/hooks/useGenerationPoller.ts`
   - Fetch `start_date/end_date` with trip polling and compute canonical expected days.
   - Use an `effectiveTotalDays` for progress/stall checks (prefer canonical when metadata is clearly inflated).
   - In auto-resume calls, pass `requestedDays: effectiveTotalDays` so backend restarts don’t re-inflate totals.

4) Add recovery for already-corrupted in-flight trips
   - File: `src/pages/TripDetail.tsx`
   - On detecting `generating` + stale heartbeat + metadata/day-count mismatch, normalize `generation_total_days` to canonical and trigger resume from next missing day.
   - Prevent treating partial JSON days as “fully generating complete”; reconcile against normalized table day count first.

5) UX guard for the noisy browser-port error
   - File: `src/components/common/GlobalErrorHandler.tsx` (or existing global error boundary)
   - Ignore/suppress this specific extension-origin promise error so users don’t see misleading failures while backend generation recovery runs.

Technical details:
- Root mismatch seen now:
  - Trip dates imply 17 days.
  - Metadata expects 19.
  - City rows (`days_total`) can overlap by transition boundaries when summed naïvely.
- This mismatch drives:
  - wrong progress denominator,
  - repeated stall detection,
  - resume attempts against incorrect final day.
- Success criteria after fix:
  1) A multi-city run completes with `itinerary_status='ready'` and `generation_total_days` matching canonical expectation.
  2) No repeated “chain broke at day X” loop near final days for the same trip.
  3) Poller progress reaches 100% without manual retries for the stuck scenario.
  4) The extension-port error no longer surfaces as an app failure message.
