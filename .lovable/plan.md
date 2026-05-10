## Add cost tracking to `discover-proactive`

Wire the shared `trackCost` helper into `supabase/functions/discover-proactive/index.ts` so this endpoint's AI usage shows up alongside other tracked actions.

### Signature note

The spec passes `userId` and `tripId` directly into `trackCost(...)`, but the actual helper signature in `_shared/cost-tracker.ts` is `trackCost(actionType, model?)` and uses `setUserId()` / `setTripId()` (this is how `itinerary-chat` does it). I'll follow the existing pattern.

### Changes (single file)

`supabase/functions/discover-proactive/index.ts`:

1. Add import:
   ```ts
   import { trackCost } from "../_shared/cost-tracker.ts";
   ```
2. Before the `fetch("https://ai.gateway.lovable.dev/...")` call (~line 126), instantiate:
   ```ts
   const costTracker = trackCost('discover_proactive', 'google/gemini-2.5-flash');
   if (userId) costTracker.setUserId(userId);
   if (tripId) costTracker.setTripId(tripId);
   ```
   `userId`/`tripId` will be pulled from the request body / auth header — I'll read the existing handler to use whatever's already in scope (extending the `ProactiveRequest` type if needed, matching how other functions resolve the user from the JWT).
3. After the AI response is parsed successfully (~line 155, after `aiResponse = await response.json()`):
   ```ts
   costTracker.recordAiUsage(aiResponse);
   await costTracker.save();
   ```
   Wrapped so a save failure doesn't break the user response (logged only).

### Out of scope

No rate limiting (already decided), no other behavior changes.