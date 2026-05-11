## X4 — Hard auth on three AI Gateway endpoints

Lock down `budget-coach`, `analyze-itinerary`, and `discover-proactive` so anonymous callers cannot burn paid AI tokens. Add cost attribution (Pattern B) on every call.

### Files

**1. `supabase/functions/budget-coach/index.ts`**
- Add `import { parseAuth } from "../_shared/require-auth.ts";` and `import { trackCost } from "../_shared/cost-tracker.ts";` (currently has neither — no cost tracking today).
- After OPTIONS preflight in `serve()` (line 71), insert hard auth gate:
  ```ts
  const auth = await parseAuth(req);
  if (auth instanceof Response) return auth;
  const userId = auth.userId;
  ```
- Read `tripId` from request body (add to `RequestBody` interface as optional `tripId?: string`).
- Wrap the existing `fetch("https://ai.gateway.lovable.dev/...")` call (around line 385) with a tracker:
  ```ts
  const costTracker = trackCost('budget_coach', 'google/gemini-2.5-flash', userId, tripId ?? null);
  // ...after response parsed:
  costTracker.recordAiUsage(aiResponseJson);
  await costTracker.save();
  ```

**2. `supabase/functions/analyze-itinerary/index.ts`**
- Add `parseAuth` import.
- After OPTIONS at line 30, insert the same hard auth gate.
- Existing `trackCost('analyze_itinerary', 'google/gemini-2.5-flash')` at line 122 → switch to Pattern B: `trackCost(..., userId, null)` (no `tripId` in this body — analyzer is for paste-flow before trip exists).

**3. `supabase/functions/discover-proactive/index.ts`**
- Add `parseAuth` import; remove the existing best-effort block at lines 36–47 (createClient + manual `getUser` + silent try/catch).
- Replace with hard `parseAuth` gate after OPTIONS at line 33; derive `userId` from result.
- Keep existing `trackCost(...)` at line 144, but always set userId (drop the `if (userId)` guard since it's now guaranteed). `tripId` already wired.

### Verification

For each function after deploy:
- `curl -X POST <fn-url>` (no auth) → **401** with `{error,code:"UNAUTHORIZED"}`.
- `curl -X POST -H "Authorization: Bearer <invalid>"` → **401**.
- Authenticated invocation → 200 / domain validation error.
- `select user_id, trip_id, function_name from trip_cost_tracking order by created_at desc limit 5;` → rows attributed correctly.
- `rg -n "best-effort|optional" supabase/functions/discover-proactive/index.ts` → 0 matches in auth comments.
- `supabase--linter` → "Three AI Gateway Endpoints Callable Without Authentication" finding cleared.

### Memory

Update `mem://constraints/security/edge-function-auth-required`:
- New rule: **NO "best-effort" or "optional" auth on paid-API edge fns.** Mandatory shape is `parseAuth` + `instanceof Response` early-return. Anon-allowed fns must be in an explicit allowlist with inline rationale.
- Add `budget-coach`, `analyze-itinerary`, `discover-proactive` to the W1 verified-clean list.

### Out of scope

Frontend callers — these endpoints are already invoked via `supabase.functions.invoke()` from authed contexts, so no client changes needed. Other unauthed AI edge fns flagged separately get their own fixes.
