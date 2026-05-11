## Goal

Close `OPEN_ENDPOINTS / unauth_paid_api_functions` — add JWT auth to the 10 remaining paid-API edge functions so anonymous callers can't drain Lovable AI / Google / Perplexity / Viator / Amadeus budgets.

## STEP 1 — The 10 functions (enumerated, all confirmed present)

| # | Function | Paid API | Existing CostTracker? | Caller surface |
|---|---|---|---|---|
| 1 | `nearby-suggestions` | Lovable AI (Gemini 2.5 Flash) | No | `useNearbySuggestions`, `DiscoverDrawer` (in-trip, authed) |
| 2 | `fetch-reviews` | Google/TripAdvisor/Foursquare/OpenTripMap | No | `services/reviewsService.ts` (authed) |
| 3 | `recommend-restaurants` | Google/TripAdvisor/Foursquare | Yes | `restaurantRecommendationService` (authed) |
| 4 | `airport-transfers` | Google Distance Matrix | Yes | 4 itinerary components (authed) |
| 5 | `flight-status` | Amadeus | No | Agent `FlightStatusTracker` (authed) |
| 6 | `lookup-local-events` | Perplexity Sonar | Yes | `enrichmentService` (authed) |
| 7 | `lookup-travel-advisory` | Perplexity Sonar | Yes | `enrichmentService` (authed) |
| 8 | `viator-search` | Viator Partner | Yes | `generate-itinerary/venue-enrichment.ts` (server→server, authed orchestrator) |
| 9 | `viator-product` | Viator Partner | No | `viatorAPI` service (authed) |
| 10 | `viator-availability` | Viator Partner | Yes | `viatorAPI` service (authed) |

## STEP 2 — Classification

**No INTENTIONALLY-ANON candidates.** Grep across `src/pages/`, share/public surfaces, and unauth components returned zero hits for any of the 10. None feed `/trip-share/:token` or landing previews. **All 10 → SHOULD BE AUTHED.**

Special case: `viator-search` is called server-to-server from `generate-itinerary/venue-enrichment.ts`. Since `generate-itinerary` runs under the user's bearer token and uses `supabase.functions.invoke()` (which forwards `Authorization`), `requireAuth` will still pass. Will verify post-deploy by hitting it from a generate-itinerary trace.

## STEP 3 — Changes per function

For each of the 10 `supabase/functions/<name>/index.ts`:

```ts
import { parseAuth } from "../_shared/require-auth.ts";

// inside Deno.serve / serve handler, after the OPTIONS short-circuit:
const auth = await parseAuth(req);
if (auth instanceof Response) return auth;
const userId = auth.userId;
```

Use `parseAuth` (not `requireAuth`) so we get `userId` for cost tracking attribution.

### Cost-tracker additions (4 functions missing it)

For `nearby-suggestions`, `fetch-reviews`, `flight-status`, `viator-product` — add:

```ts
import { trackCost } from "../_shared/cost-tracker.ts";
const costTracker = trackCost('<function_name>', '<api_or_model>', userId, body?.tripId ?? null);
// after success: costTracker.recordAiUsage(resp)  // for Lovable AI
//                costTracker.recordApiCall()       // for Google/Amadeus/Viator/etc
await costTracker.save();
```

For the 6 that already have `trackCost(...)` calls without `userId`/`tripId`, pass `userId` (and `body.tripId` where the body carries it) so `trip_cost_tracking` rows are properly attributed instead of orphaned.

## STEP 4 — Verification per function

For each newly-authed function:

```
curl -X POST <fn-url>                                 # expect 401 UNAUTHORIZED
curl -X POST -H "Authorization: Bearer <preview>" …   # expect 200 or 4xx-validation
```

Done via `supabase--curl_edge_functions` (no Authorization → 401; preview-session bearer → 200/4xx). Then `select count(*) from trip_cost_tracking where created_at > now() - interval '5 min'` to confirm attribution rows.

After all 10:
- Re-run `supabase--linter` — `unauth_paid_api_functions` finding should resolve to 0.
- Re-run a generate-itinerary smoke test to confirm `viator-search` server→server invocation still passes auth.

## STEP 5 — Memory + rollback note

- Update `mem://constraints/security/security-definer-accepted-class` with: "All 10 paid-API edge functions now require JWT (no anon-class accepted exceptions)."
- Add new memory `mem://constraints/security/edge-function-auth-required` listing the 10 functions + the `parseAuth` + `trackCost(userId, tripId)` pattern, so future paid-API functions copy it by default.
- No DB migration needed.

## Files touched (10 + 2 memory)

- `supabase/functions/nearby-suggestions/index.ts`
- `supabase/functions/fetch-reviews/index.ts`
- `supabase/functions/recommend-restaurants/index.ts`
- `supabase/functions/airport-transfers/index.ts`
- `supabase/functions/flight-status/index.ts`
- `supabase/functions/lookup-local-events/index.ts`
- `supabase/functions/lookup-travel-advisory/index.ts`
- `supabase/functions/viator-search/index.ts`
- `supabase/functions/viator-product/index.ts`
- `supabase/functions/viator-availability/index.ts`
- `mem://constraints/security/edge-function-auth-required` (new)
- `mem://index.md` (append reference + remove Q43 deferred-class language about these)

## Out of scope

- `cleanup-friend-request-rate-log` cron job (separate item from prior verification round).
- Adding rate limits beyond auth — none of these are anon, so per-caller `db-rate-limiter` is optional follow-up; not blocking.
