
Goal: stop the multi-city “refresh to continue” loop and stop day loss/truncation across legs.

What I found
1) Next-leg auto-start only checks the previous leg once.
- File: `src/pages/TripDetail.tsx` (queued-leg effect around lines ~574+)
- Current behavior: `checkPreviousLeg()` runs once, then interval only polls the current leg’s own status.
- If you land on leg 2 while leg 1 is still generating, leg 2 stays `queued` forever until refresh (because previous-leg readiness is never re-checked).

2) The same queued-leg effect invalidates React Query, but this page is using local `trip` state from manual fetch.
- So invalidation does not reliably update what the user sees on this page in real time.

3) Day truncation is real in backend state for affected legs.
- Verified on your leg `300d6b24-f32a-4f45-8ed4-459bcde632b7`: `itinerary_data.days = 2` while `itinerary_days` table has 4 rows.
- Also metadata drift exists (`generation_total_days=4`, `generation_completed_days=2`, status `ready`).

4) Why truncation can happen:
- `generate-trip` fresh starts clear `trips.itinerary_data.days` but do not clear normalized day tables.
- `generate-trip-day` can be retried/duplicated in chain scenarios; late/stale invocations can still write partial JSON back after a fuller run.
- Existing in-memory no-shrink guard compares against JSON seen at invocation start, not canonical table count.

Do I know what the issue is?
Yes:
- Frontend orchestration bug causes queued legs to require refresh.
- Backend idempotency/race + stale-table behavior can leave `ready` trips with truncated JSON day arrays.

Implementation plan
1) Fix queued-leg orchestration in TripDetail (no more refresh needed)
- File: `src/pages/TripDetail.tsx`
- Update queued-leg effect to poll both:
  - previous leg readiness (`ready/generated/complete`)
  - current leg status
- If previous leg becomes ready while current leg is still queued, invoke `generate-itinerary` `action: 'generate-trip'` immediately.
- Replace query invalidation-only behavior with direct local state refresh (`setTrip`) from DB after status change.
- Add an “invoke once per leg visit” ref guard to prevent duplicate trigger spam.

2) Add generation run idempotency in backend chain
- File: `supabase/functions/generate-itinerary/index.ts`
- In `generate-trip`:
  - create `generation_run_id` (UUID) in metadata each fresh/resume run.
  - pass it into first `generate-trip-day` call.
- In `generate-trip-day`:
  - require/propagate `generationRunId`.
  - before writing day progress/final state, re-fetch trip metadata and abort write if run id mismatch or status already `ready/cancelled`.
  - before chaining next day, verify run id still current.
- This prevents late stale invocations from overwriting newer/fuller results.

3) Harden no-shrink against canonical table rows
- File: `supabase/functions/generate-itinerary/index.ts` (`generate-trip-day` save section)
- Before writing `partialItinerary`, compare candidate JSON day count to canonical existing count:
  - canonical = max(current JSON day count, `itinerary_days` row count)
- If candidate is smaller than canonical, block overwrite and keep canonical/fuller set.

4) Fresh generation cleanup for normalized tables (non-resume only)
- File: `supabase/functions/generate-itinerary/index.ts` (`generate-trip` start)
- On fresh run (`!isResume`), clear prior normalized generation artifacts for that trip:
  - `itinerary_days`
  - `itinerary_activities` (and related day-linked generated rows if used by this flow)
- Keep resume path untouched.
- This prevents stale old rows from falsely signaling completion and poisoning self-heal logic.

5) Metadata consistency on completion
- File: `supabase/functions/generate-itinerary/index.ts`
- Ensure final completion write always sets:
  - `generation_completed_days = generation_total_days`
  - clears `chain_broken_at_day/chain_error`
- Ensures pollers/UX do not interpret ready trips as partially complete.

6) One-time repair path for already affected trips
- Add a small backend repair action (or targeted DB repair script) that rebuilds `trips.itinerary_data.days` from canonical `itinerary_days` when JSON is shorter.
- Use it for existing inconsistent journey legs so users stop seeing truncated days immediately.

Validation plan
1) Reproduce pre-fix:
- Start leg 1 generation, open leg 2 while leg 1 still running, confirm leg 2 previously stays queued.
2) Post-fix:
- Without refresh, leg 2 auto-starts once leg 1 reaches ready.
3) Race test:
- Simulate duplicate chain/resume calls; verify stale invocation cannot overwrite a fuller itinerary.
4) Data integrity:
- For each leg, verify `json_days === itinerary_days.count`, and metadata completed/total are aligned.
5) Journey end-to-end:
- 3-leg run (Rome → Florence → Venice), ensure each leg transitions automatically with no manual refresh.

Technical notes (for implementation)
- Web guidance confirms recursive/function-chaining can experience rate limits/retries; idempotency token + stale-write rejection is the right stabilization pattern.
- This plan preserves your existing architecture but makes it deterministic under retries and handoff timing.
