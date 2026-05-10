## No-op: skip rate limiting on `discover-proactive`

Per project policy, the backend doesn't have rate-limiting primitives yet, and the standing rule is to not add ad-hoc rate limiting to endpoints. The spec's "existing rate-limit infrastructure (DB-backed, see itinerary-chat for pattern)" doesn't actually exist in this codebase — building it would be a from-scratch implementation that the policy explicitly defers until proper infra is in place.

### Action
- Do **not** modify `supabase/functions/discover-proactive/index.ts`.
- No new `rate_limits` table, no `checkRateLimit` helper.

### When to revisit
When the platform ships a shared rate-limit primitive, this endpoint (and others like `itinerary-chat`, `generate-itinerary`) can be wired up in one pass against that shared infra.