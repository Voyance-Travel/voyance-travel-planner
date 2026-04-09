

# Fix: Smart Finish 504 Timeout + Chat CORS Failures

## Two Separate Issues

### Issue 1: Smart Finish fails because `enrich-manual-trip` prematurely marks the trip as failed

**Root cause**: When `enrich-manual-trip` calls `generate-itinerary`, the gateway enforces a ~150s timeout and returns 504. The background handler in `enrich-manual-trip` catches the 504, tries a brief recovery poll (8 checks × 3s = 24s), and when generation isn't done yet, throws an error that writes `smartFinishFailed: true` + `smartFinishStatus: "failed"` to the trip metadata. Meanwhile, the generation chain is still running fine (days 2-4 complete), but when day 5 starts, `tripCheck` query fails (returns null), stopping the chain. The failure metadata write likely interferes with the ongoing generation.

**Fix**: Increase the recovery poll window after a 504 timeout to give the chain enough time to finish. A 5-day trip takes ~3-4 minutes; the current 24s poll is far too short.

**File**: `supabase/functions/enrich-manual-trip/index.ts`
- In `runGenerationInBackground`, change the timeout recovery from `waitForGenerationCompletionAfterTimeout` (8 checks × 3s) to use `pollForCompletion`-style logic with ~60 checks × 5s (5 minutes total), matching the client-side polling window
- Also set `itinerary_status: 'generating'` on the trip BEFORE calling `generate-itinerary`, as a safety net (currently only `generate-trip` action sets it, but if there's a race, having it pre-set prevents the chain from stopping)

### Issue 2: Chat CORS error from production domain

**Root cause**: The edge function returns 401 consistently (user auth fails). The CORS headers are in all response paths, but the error manifests as a CORS block. This happens when the Supabase gateway itself rejects the request before it reaches the function — specifically when the function crashes during import or early initialization on certain cold starts. The function imports `../_shared/traveler-dna.ts` which itself imports `npm:@supabase/supabase-js@2.90.1`. If there's a version mismatch or import failure on a specific isolate, the function crashes with no CORS headers.

**Fix**: Wrap the `fetchTravelerDNA` call in a more defensive try/catch (already exists but the import itself could fail), and redeploy the function. Additionally, the auth is failing (all requests return 401) — need to verify the auth flow and add better error logging.

**File**: `supabase/functions/chat-trip-planner/index.ts`
- Move the `traveler-dna` import to be dynamic (lazy `await import()`) inside the try block so a broken import doesn't crash the entire function
- Redeploy the function

### Steps

1. **Update `enrich-manual-trip/index.ts`**:
   - Before calling `generate-itinerary`, set `itinerary_status: 'generating'` on the trip
   - Increase the 504 timeout recovery poll from 24s to 5 minutes (60 checks × 5s)

2. **Update `chat-trip-planner/index.ts`**:
   - Make the `traveler-dna` import dynamic/lazy inside the try block
   - Add more defensive error handling around the DNA fetch

3. **Redeploy both functions**: `enrich-manual-trip` and `chat-trip-planner`

### Technical Details

- **Smart Finish timeline**: Generation takes ~3-4 min for 5 days. Current 504 recovery window is only 24s — needs to be ~5 min
- **Chat auth**: All recent calls return 401. The `getUser(token)` call works but may be rejecting expired tokens. The CORS error is a symptom of the gateway, not the function code
- **Files changed**: `supabase/functions/enrich-manual-trip/index.ts`, `supabase/functions/chat-trip-planner/index.ts`

