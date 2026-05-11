## Goal

Lock down the four `parse-*` edge functions behind authentication, and add cost tracking on the two AI-using ones that lack it.

## Audit (current state)

| Function | Auth check | Uses LOVABLE_API_KEY (AI) | trackCost |
|---|---|---|---|
| `parse-document-text` | ❌ none | ❌ no AI (regex PDF extract) | n/a |
| `parse-booking-confirmation` | ❌ none | ✅ yes | ❌ missing |
| `parse-travel-story` | ❌ none | ✅ yes | ✅ already wired |
| `parse-trip-input` | ❌ none | ✅ yes | ❌ missing |

All four are exposed to anonymous POSTs today.

## Approach

Use the existing shared helper `supabase/functions/_shared/require-auth.ts` (already battle-tested in `weather/index.ts` and other paid endpoints) instead of inlining the snippet. It returns `null` on success or a 401 `Response` on failure. This keeps the auth pattern consistent across the codebase and avoids drift.

```ts
import { requireAuth } from "../_shared/require-auth.ts";
// ...inside Deno.serve, after CORS preflight, before any work:
const authFail = await requireAuth(req);
if (authFail) return authFail;
```

For the AI-using functions, add `trackCost` mirroring the pattern already in `parse-travel-story`:

```ts
import { trackCost } from "../_shared/cost-tracker.ts";
const costTracker = trackCost('parse_booking_confirmation', 'google/gemini-2.5-flash'); // model name read from existing fetch call
// after the AI response:
await costTracker.record({ inputTokens, outputTokens });
```

I'll wire `record(...)` based on the `usage` block each function gets back from the AI gateway (same shape `parse-travel-story` already consumes).

## Per-file changes

1. **`parse-document-text/index.ts`** — add `requireAuth` gate after CORS preflight. No AI, no cost tracking.
2. **`parse-booking-confirmation/index.ts`** — add `requireAuth` gate + `trackCost('parse_booking_confirmation', <model>)` around the AI call.
3. **`parse-travel-story/index.ts`** — add `requireAuth` gate (cost tracking already present, leave untouched).
4. **`parse-trip-input/index.ts`** — add `requireAuth` gate + `trackCost('parse_trip_input', <model>)` around the AI call.

No `supabase/config.toml` changes needed — the project already deploys with `verify_jwt = false` by default and validates JWTs in code per the Lovable Cloud edge-function pattern.

## Caller impact

All four functions are invoked from the client via `supabase.functions.invoke(...)`, which automatically attaches the user's JWT in the `Authorization` header. No frontend changes required. I'll grep to confirm there are no service-role / anon-context callers before shipping.

## Verification

After deploy:

1. Anonymous POST → 401 with `{"error":"Authentication required","code":"UNAUTHORIZED"}` (test via `supabase--curl_edge_functions` with `headers: {Authorization: ""}`).
2. Authenticated POST (preview-session token auto-injected) → 200 / normal response.
3. For the two newly cost-tracked functions, check `cost_tracking` table in DB after one successful run — a row should appear with the matching `feature` name.

## Deliverables

- 4 edge-function file edits (3 new auth gates + 2 new cost trackers; the third gate has no cost tracker).
- Curl-based verification of unauth (401) and authed (200) on each.
- No DB migration, no client-side changes, no new secrets.
