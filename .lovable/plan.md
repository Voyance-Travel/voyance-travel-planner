## Problem

The recurring **“Invalid token”** error is not being caused by the user login token path alone. The failing functions are still using the wrong authentication style for **Lovable AI Gateway**:

- `activity-concierge` sends `Authorization: Bearer ${LOVABLE_API_KEY}` to the AI gateway.
- `itinerary-chat` does the same.
- Lovable AI Gateway expects `LOVABLE_API_KEY` in the `Lovable-API-Key` header, plus `X-Lovable-AIG-SDK: vercel-ai-sdk`; it should not receive that key as a Bearer token.

This explains why prior attempts focused on refreshing the user session but the error kept coming back.

## Plan

1. **Fix the AI Gateway auth in both assistant backends**
   - Update `supabase/functions/activity-concierge/index.ts`.
   - Update `supabase/functions/itinerary-chat/index.ts`.
   - Replace the gateway request header from:
     - `Authorization: Bearer ${LOVABLE_API_KEY}`
   - To:
     - `Lovable-API-Key: ${LOVABLE_API_KEY}`
     - `X-Lovable-AIG-SDK: vercel-ai-sdk`

2. **Keep user authentication separate and intact**
   - Keep `parseAuth(req)` in `activity-concierge` so only signed-in users can use it.
   - Keep the existing user token validation in `itinerary-chat`.
   - Do not weaken auth or allow anonymous AI usage.

3. **Improve diagnostics without exposing secrets**
   - Add safe logs around gateway failures that include:
     - function name
     - response status
     - short error body
     - whether the managed AI key exists
   - Do not log the AI key or user token.

4. **Fix the client call path if needed**
   - `useActivityConcierge.ts` already uses the user `session.access_token`, which is correct.
   - I’ll keep the one-shot refresh retry, but make the error message clearer if the user session is actually missing or expired.

5. **Validate with deployed function logs**
   - Deploy/test `activity-concierge` and `itinerary-chat`.
   - Call `activity-concierge` with the current preview user token if available.
   - Check edge logs for a successful gateway call or a clear non-auth error.

## Expected result

The assistant/concierge should stop returning **“Invalid token”** from the AI gateway. If a real user session expires, the UI will still ask the user to refresh/sign in, but AI Gateway requests will no longer be rejected because of the wrong Bearer-token header.