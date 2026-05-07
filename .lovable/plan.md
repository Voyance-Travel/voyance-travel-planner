Root cause
- The initial `generate-trip` call succeeds, but the function then calls itself to start `generate-trip-day`.
- That self-chain request sends `Authorization: Bearer <service-role-key>` while also sending `apikey: <anon-key>`.
- Lovable Cloud rejects that combination before the function code runs: `Conflicting API keys`.
- `generate-trip` then marks the trip failed and returns the visible `502 Bad Gateway`; the underlying self-chain failure is `401`.

Implementation plan
1. Update the internal itinerary self-chain requests
   - In `supabase/functions/generate-itinerary/action-generate-trip.ts`, remove the conflicting `apikey` header from the initial `generate-trip-day` fetch.
   - In `supabase/functions/generate-itinerary/action-generate-trip-day.ts`, remove the same conflicting `apikey` header from the nested `generate-day` fetch.

2. Keep server-to-server auth intact
   - Continue using `Authorization: Bearer <service-role-key>` for these internal calls so the existing service-role bypass in `index.ts` still works.
   - Do not change frontend auth or user-facing request behavior.
   - Do not alter the generated Supabase client/types files.

3. Optional cleanup if needed during implementation
   - If the new `INTERNAL_CHAIN_SECRET` was intended to replace service-role auth, wire it in consistently as a separate header such as `x-internal-chain-secret` and validate it in `index.ts`.
   - Prefer the minimal fix first because the current code already has a service-role bypass and the logs point specifically to conflicting headers, not a missing secret.

4. Deploy and verify
   - Deploy the updated `generate-itinerary` function.
   - Check fresh edge logs for a new generation attempt.
   - Confirm the previous `Conflicting API keys` / `Initial chain failed (status=401)` messages no longer appear.