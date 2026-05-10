## Daily Chat Cap on `itinerary-chat`

Add an ad-hoc daily cap (50 requests / user / rolling 24h) to `supabase/functions/itinerary-chat/index.ts`, gated by a count query against `trip_cost_tracking`.

> ⚠️ Heads up: the backend doesn't have shared rate-limit primitives yet. This is ad-hoc per your "auth + visibility + soft cap" compensating-controls plan, and matches what we'll later replace with a proper limiter.

### Changes — single file: `supabase/functions/itinerary-chat/index.ts`

1. **Promote auth from optional to required.** Today `userId` can be `null` (anon callers fall through). The cap query is keyed on `user_id`, so we must 401 unauth'd callers first — same pattern just applied to `discover-proactive` and `activity-concierge`.
   - After the existing `getUser` block (~line 487), if `!userId` → return 401 `{ error: 'Authentication required' }`.

2. **Insert daily-cap check** immediately after the 401 guard, before `const body = await req.json()` is consumed for processing:
   ```ts
   const { count } = await supabase
     .from('trip_cost_tracking')
     .select('*', { count: 'exact', head: true })
     .eq('user_id', userId)
     .eq('action_type', 'itinerary_chat')
     .gte('created_at', new Date(Date.now() - 86_400_000).toISOString());

   const DAILY_CHAT_CAP = 50;
   if ((count ?? 0) >= DAILY_CHAT_CAP) {
     return new Response(
       JSON.stringify({ error: 'Daily AI chat limit reached', code: 'DAILY_CAP_EXCEEDED' }),
       { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
     );
   }
   ```
   - Uses the already-constructed `supabase` client (RLS on `trip_cost_tracking` allows users to read their own rows; `count` works under RLS).

3. **Constant placement.** Define `DAILY_CHAT_CAP = 50` at module scope (top of file, near other constants) so it's easy to tune without hunting inside the handler.

### Frontend note (out of scope for this change, flagged for follow-up)
The chat UI should surface `code: 'DAILY_CAP_EXCEEDED'` as a friendly toast ("You've hit today's AI chat limit — resets in 24h") instead of a generic error. Not changing frontend in this pass unless you want me to.

### Verification
- Manual: call `itinerary-chat` 51 times as one user → 51st returns 429 with the expected code.
- Existing `costTracker.save()` already writes `action_type='itinerary_chat'`, so the counter self-feeds — no schema work needed.

### Explicitly NOT included
- No new table, no Redis, no token bucket, no burst window — pure count-on-existing-table.
- No backfill, no admin override path, no per-trip cap.
- No changes to `discover-proactive` or `activity-concierge` caps (separate decisions if you want them).