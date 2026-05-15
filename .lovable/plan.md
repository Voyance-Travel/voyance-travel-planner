## Goal
Stop silent itinerary regeneration on refresh/background polling while still letting users recover stalled generation manually.

## What I found
- `TripDetail.tsx` no longer auto-resumes on page load. The two `NOT auto-resuming` sites only set stalled UI and are correct.
- The risky extracted `src/hooks/useAutoResume.ts` is already gone.
- The remaining auto-fire path is `src/hooks/useGenerationPoller.ts`: when it detects a stalled generation, it invokes `generate-itinerary` up to 3 times automatically.
- That path can still produce different LLM output without explicit user action, which is the same class of bug we were trying to eliminate.

## Plan
1. **Disable poller auto-resume**
   - Update `useGenerationPoller.ts` so stall detection only transitions to `status: 'stalled'` and calls `onStalled`.
   - Remove the automatic `supabase.functions.invoke('generate-itinerary', { isResume: true })` branch from the poller.
   - Keep progress polling, ready detection, failed detection, heartbeat/stall detection, and stalled UI behavior.

2. **Preserve manual recovery**
   - Leave `TripDetail.tsx`’s `handleResumeGeneration` button path intact.
   - The user can still click the visible retry/regenerate button when generation stalls.

3. **Rename stale internals/comments**
   - Replace `autoResumeCountRef`/`MAX_AUTO_RESUME_ATTEMPTS` with a stall-notification guard where needed.
   - Update comments in `useGenerationPoller.ts` so future agents don’t re-add auto-generation from the poller.

4. **Add a regression test**
   - Add/update a focused test for `useGenerationPoller` or a static guard test verifying the hook does not call `supabase.functions.invoke('generate-itinerary')` from stall handling.
   - This locks the policy: background poller may detect stalls, but must not auto-start generation.

## Files to change
- `src/hooks/useGenerationPoller.ts`
- A focused test file under `src/hooks/__tests__/` or `src/test/`

## Expected result
Refreshing or background polling will never silently regenerate itinerary content. Stalled trips still surface recovery UI, and explicit user action remains the only way to resume generation.