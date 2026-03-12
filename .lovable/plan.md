
Diagnosis
- This is not a timeout/queue issue. Backend logs show a hard runtime crash:
  - `[optimize-itinerary] Error: ReferenceError: i is not defined`
- Root cause is in `supabase/functions/optimize-itinerary/index.ts` (transport step): `activities[i]` is referenced **after** the `for (let i...)` loop ends (walking-cost safety block), so `i` is out of scope.
- The UI optimize path always sends `enableRealTransport: true` (`EditorialItinerary.tsx`), so this crashing path runs on every optimize request.
- Result: optimize fails before save/response completion, and credits can be spent without the normal “no changes” refund path firing.

Plan (cautious, minimal)
1. Fix the crash in `optimize-itinerary`
   - Move the “walking is always free” normalization inside the per-leg loop (or refactor to a local transport object).
   - Remove any out-of-scope loop-index access.

2. Add leg-level fault isolation
   - Wrap each leg’s transport calculation in a small `try/catch`.
   - On leg failure, log warning and fall back to `estimateNoCoords(...)`.
   - Continue processing remaining legs so one bad segment doesn’t kill the whole optimization.

3. Add failure-refund safeguard in UI
   - In `EditorialItinerary.tsx` `handleOptimize` catch path, if paid optimization fails, trigger a refund call with a clear metadata reason (e.g., `optimize_runtime_failure`).
   - Keep existing “no meaningful changes => refund” behavior unchanged.

4. Add regression tests for this exact failure mode
   - Add Deno test(s) for `optimize-itinerary` with `enableRealTransport: true`.
   - Assert success response shape and no runtime ReferenceError.
   - Add a test with missing/unroutable locations to verify fallback behavior.

5. Validate after patch
   - Test function directly with real payload and confirm non-500 response + stats.
   - Verify trip `itinerary_data.optimizationMetadata` is written.
   - Verify optimize flow in UI completes and credits are protected on failure.

Optional remediation
- Run a one-time reconciliation refund for failed route-optimization charges during the crash window (including your latest failed attempt).
