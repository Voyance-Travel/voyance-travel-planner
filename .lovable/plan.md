## Realtime channel authorization audit

### What I found

The 8 tables published to `supabase_realtime`:

| Table | RLS | SELECT scope (current) | Action |
|---|---|---|---|
| `trips` | ✅ | owner OR collaborator (+ admin) | OK |
| `trip_collaborators` | ✅ | own row, trip owner, or collaborator | OK |
| `trip_cities` | ✅ | trip owner or accepted collaborator | OK |
| `itinerary_days` | ✅ | trip owner or accepted collaborator | OK |
| `trip_chat_messages` | ✅ | consumer-trip owner/collab + agency members + shared agency anon | OK |
| `trip_notifications` | ✅ | `auth.uid() = user_id` only | OK |
| `trip_suggestions` | ✅ | trip owner / accepted collab / agency agent | OK |
| `trip_suggestion_votes` | ✅ | **`USING(true)` for anon AND authenticated** | **TIGHTEN** |

The app only uses `postgres_changes` Realtime (no `broadcast`/`presence`/private channels), so Realtime delivery is gated by table-level RLS — meaning row-change events for a trip you cannot SELECT will not be sent to your subscription. This closes the cross-tenant leak for 7 of the 8 tables out of the box.

`trips`, `trip_activities` (not published), `trip_payments` (not published), `itinerary_versions` (not published), `trip_collaborators` are already correctly scoped — no changes needed.

The `realtime.messages` RLS the scanner mentions only matters for Broadcast/Presence channels, which this codebase does not use.

### What I'll change

Lock down `trip_suggestion_votes` SELECT to people who can see the parent trip:

```sql
DROP POLICY IF EXISTS "Anon can read votes" ON public.trip_suggestion_votes;
DROP POLICY IF EXISTS "Authenticated users can read votes" ON public.trip_suggestion_votes;

CREATE POLICY "Trip members can read votes"
  ON public.trip_suggestion_votes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_suggestions ts
      WHERE ts.id = trip_suggestion_votes.suggestion_id
        AND (
          EXISTS (SELECT 1 FROM public.trips t WHERE t.id = ts.trip_id AND t.user_id = auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.trip_collaborators tc
            WHERE tc.trip_id = ts.trip_id
              AND tc.user_id = auth.uid()
              AND tc.accepted_at IS NOT NULL
          )
          OR EXISTS (
            SELECT 1 FROM public.agency_trips at
            WHERE at.id = ts.trip_id AND (at.agent_id = auth.uid() OR at.share_enabled = true)
          )
        )
    )
  );

-- Preserve anon read for shared agency trips (parity with trip_suggestions)
CREATE POLICY "Anon can read votes for shared agency trips"
  ON public.trip_suggestion_votes
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_suggestions ts
      JOIN public.agency_trips at ON at.id = ts.trip_id
      WHERE ts.id = trip_suggestion_votes.suggestion_id
        AND at.share_enabled = true
    )
  );
```

### What I won't change

- All other 7 published tables — already owner/collaborator-scoped.
- "Require auth" Realtime dashboard toggle is not a code-level change; I'll note it for the user.

### Verification

1. Sign in as User B (not on User A's trip), `supabase.from('trip_suggestion_votes').select('*').eq('suggestion_id', <A's vote>)` → 0 rows.
2. Subscribe to `postgres_changes` for `trip_suggestion_votes` filtered to A's trip — INSERT/UPDATE events for A's votes are not delivered.
3. Owner and accepted collaborator of A's trip still see votes and receive events.
4. Re-run Supabase linter — `realtime_no_channel_authorization` and `policy_exists_rls_disabled` (already cleared) stay clean.
