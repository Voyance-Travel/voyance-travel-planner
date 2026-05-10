## Lock `weather` and `suggest-landmarks` behind authenticated JWT

Both edge functions currently accept anonymous POSTs and call paid upstream APIs (Apple WeatherKit, Open-Meteo, Lovable AI Gateway). Add the same JWT gate used elsewhere, plus a `CostTracker` to `suggest-landmarks` (weather already has one).

Both functions are invoked from the client via `supabase.functions.invoke()`, which auto-attaches the user's session token — so adding auth does not require any frontend changes.

---

### 1. `supabase/functions/weather/index.ts`

At the top of the `Deno.serve` handler, immediately after the CORS preflight short-circuit and before `trackCost(...)`:

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Inside handler:
const authHeader = req.headers.get('Authorization');
if (!authHeader?.startsWith('Bearer ')) {
  return errorResponse('Authentication required', 401);
}
const supabaseAuth = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
);
const token = authHeader.replace('Bearer ', '');
const { data: claimsData, error: authError } = await supabaseAuth.auth.getClaims(token);
if (authError || !claimsData?.claims) {
  return errorResponse('Invalid token', 401);
}

// TODO(rate-limit): per-user / per-IP rate limiting deferred — same approach as Discover hardening.
```

(Existing `trackCost('weather', 'weatherkit')` and downstream logic unchanged.)

### 2. `supabase/functions/suggest-landmarks/index.ts`

- Add the same auth gate immediately after the preflight check (using the existing service-role client is fine for DB writes, but we need a separate anon-key client for `getClaims`, or reuse the service client with `auth.getUser(token)` — match Weather's pattern with `getClaims` for consistency).
- Import and use `trackCost` from `../_shared/cost-tracker.ts`:
  - Initialize once we know we'll call the AI: `const costTracker = trackCost('suggest-landmarks', 'lovable-ai');`
  - On cache hit, skip cost tracking (no upstream spend).
  - After the AI response, record usage / metadata and `await costTracker.save()` before returning.
- Add `// TODO(rate-limit): defer — see Discover hardening pattern.` comment.

### Verification

1. Anonymous `curl` to both endpoints → `401 Authentication required`.
2. Authenticated request (preview session) → existing 200 behavior.
3. After an authenticated weather + landmark call, `trip_cost_tracking` shows `weather` and `suggest-landmarks` rows (cache-miss path for landmarks).

No frontend changes — `supabase.functions.invoke` already attaches the JWT.
