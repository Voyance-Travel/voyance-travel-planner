# Add Auth + Cost Attribution to `activities` and `transfer-pricing`

Same fix pattern as the W1 ten functions. Both functions currently accept anonymous traffic and call paid third-party APIs (Viator, Google Distance Matrix). No frontend callers found in `src/` for either — they're either dead code paths or invoked by URL — but we still close the open endpoint.

## 1. `supabase/functions/activities/index.ts`

Currently: GET-style handler reading query params. No `trackCost` exists yet.

Edits at the top of `serve(async (req) => …)` (line 164), immediately after the OPTIONS short-circuit and before the `try`:

```ts
import { parseAuth } from "../_shared/require-auth.ts";
import { trackCost } from "../_shared/cost-tracker.ts";
// (already imports serve, createClient)

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await parseAuth(req);
  if (auth instanceof Response) return auth;
  const userId = auth.userId;

  const costTracker = trackCost('activities', 'viator');
  costTracker.setUserId(userId);

  try {
    const url = new URL(req.url);
    const destination = url.searchParams.get('destination');
    const destinationId = url.searchParams.get('destinationId');
    const tripId = url.searchParams.get('tripId');
    if (tripId) costTracker.setTripId(tripId);
    // … existing logic unchanged …

    if (viatorApiKey && destination) {
      const viatorResults = await searchViator(destination, viatorApiKey, category, limit);
      if (viatorResults.length > 0) {
        costTracker.recordApiCall('viator', 1);
        // …
      }
    }

    // before the success Response:
    await costTracker.save();
    return new Response(/* … */);
  } catch (error) { /* unchanged */ }
});
```

`tripId` is optional (no current frontend caller passes it; harmless when absent — orphan tolerated only for legacy paths until a caller exists).

## 2. `supabase/functions/transfer-pricing/index.ts`

Currently: POST handler. `trackCost('transfer_pricing', 'google_routes')` already exists at line 325 but is never given a user. Just add the auth gate + attribution lines.

Edits inside the existing `serve` handler (line 320):

```ts
import { parseAuth } from "../_shared/require-auth.ts"; // add to imports

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await parseAuth(req);
  if (auth instanceof Response) return auth;
  const userId = auth.userId;

  const costTracker = trackCost('transfer_pricing', 'google_routes');
  costTracker.setUserId(userId);

  try {
    const request: TransferPricingRequest = await req.json();
    const tripId = (request as any).tripId;
    if (tripId) costTracker.setTripId(tripId);
    // … existing logic …
  }
});
```

Add `tripId?: string` to the `TransferPricingRequest` interface so it's typed.

## 3. Verification

After deploy:

```bash
curl -X POST "$URL/functions/v1/activities?destination=Rome"          # → 401
curl -X POST "$URL/functions/v1/transfer-pricing" -d '{"origin":"a"}' # → 401
```

Then 30 minutes later, check `trip_cost_tracking` for the two `action_type` rows: 0 orphans expected for new rows.

## 4. Memory

Append both function names to the W1-cleaned list in `mem://constraints/security/edge-function-auth-required` (count 10 → 12).

## Out of scope

- No changes to either function's business logic, API shape, or response.
- No frontend changes (no current callers found; if any URL-based caller exists outside the repo it must already be sending a Bearer to other authed endpoints).
- No `verify_jwt = true` switch in `config.toml` — in-code `parseAuth` is the project standard.
