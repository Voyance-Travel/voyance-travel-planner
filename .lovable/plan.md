
Do I know what the issue is? Yes.

What’s actually happening
- The CORS header itself is not the core problem. Both `chat-trip-planner` and `generate-itinerary` already define browser CORS headers, and `verify_jwt = false` is already set in config. The “CORS” errors are most likely failure-path symptoms.
- The real auth clue is in the logs: repeated `bad_jwt` / `token contains an invalid number of segments` on `/user`. That means some requests are reaching the backend with a malformed or stale access token.
- Smart Finish still has a frontend/backend mismatch: the backend now waits up to 5 minutes, but `SmartFinishBanner.tsx` still gives up after `40 x 5s` and some recovery paths still use `8 x 3s`. So the UI can declare failure while the backend is still working.
- `[OfflineCache] Storage full...` is secondary, but caching full trip payloads in localStorage is risky because auth persistence also uses localStorage.
- The browser “message channel closed” errors are extension noise, not the app.
- The `<circle ... "undefined">` errors are a separate SVG animation issue, likely from animated circles in loading/progress UI.

Implementation plan

1. Stabilize auth before edge calls
- Add a shared client helper around session retrieval in `src/lib/authSessionGuard.ts` that:
  - uses the guarded session path,
  - verifies the token shape before use,
  - forces one refresh if the token is missing, expired, or malformed.
- Use that helper in:
  - `src/components/planner/TripChatPlanner.tsx`
  - `src/hooks/useItineraryGeneration.ts`

2. Add one-time auth recovery + retry for the failing flows
- In `TripChatPlanner.tsx`, if the request hits `401`, `Failed to fetch`, or a connection-style failure:
  - refresh the session once,
  - retry once,
  - then show a clean user-facing error.
- In `useItineraryGeneration.ts`, retry the initial `generate-itinerary` start call once after auth recovery instead of failing immediately.

3. Align Smart Finish polling with the backend window
- Update `src/components/itinerary/SmartFinishBanner.tsx` so every Smart Finish polling path matches the backend recovery window:
  - main polling: `60 checks x 5s`
  - fallback/recovery polling: also use the long window
- Do not refund or mark failure until that full window is exhausted.
- Prefer checking `smartFinishStatus` plus completion/failure timestamps, not only the boolean flags.

4. Harden the edge functions against malformed tokens
- In:
  - `supabase/functions/chat-trip-planner/index.ts`
  - `supabase/functions/generate-itinerary/index.ts`
- Add an early token sanity check before calling `auth.getUser(token)`.
- If the token is obviously invalid, return a structured `401` JSON response with CORS headers immediately.
- Add concise logs that distinguish:
  - invalid token
  - auth failure
  - upstream AI/generation failure
  - cold-start/boot-path failure

5. Reduce localStorage pressure
- In `src/hooks/useOfflineItinerary.ts`, stop caching oversized full-trip rows.
- Cache only lightweight trip data, or strip heavy `itinerary_data` / bulky metadata before save.
- This should remove the quota warning and reduce auth persistence instability.

6. Clean up the SVG warning separately
- Audit `src/components/planner/shared/GenerationAnimation.tsx` and similar progress-ring components.
- Replace fragile animated `cx/cy/r` attribute animation with transform-based animation or guaranteed numeric values so no `<circle>` attribute becomes `undefined`.

Verification
- Chat works on the published site without “CORS” / `Failed to fetch`.
- Auth logs stop showing malformed JWT errors for these flows.
- Smart Finish can run longer than 200s without the UI timing out early.
- LocalStorage quota warnings become rare or disappear.
- The `<circle>` console errors are gone during loading animations.

Files likely touched
- `src/components/planner/TripChatPlanner.tsx`
- `src/hooks/useItineraryGeneration.ts`
- `src/components/itinerary/SmartFinishBanner.tsx`
- `src/lib/authSessionGuard.ts`
- `src/hooks/useOfflineItinerary.ts`
- `supabase/functions/chat-trip-planner/index.ts`
- `supabase/functions/generate-itinerary/index.ts`
