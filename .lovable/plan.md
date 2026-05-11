## Context

Four RLS policies grant `anon` direct REST SELECT access to agency share-link data based only on `share_enabled = true`, with no `share_token` validation. Anon callers can dump every shared agency trip's `internal_notes`, `total_cost_cents`, `total_commission_cents`, plus all cascading suggestions, votes, and chat messages via the PostgREST REST API.

The legitimate share UX (`src/pages/agent/TripShare.tsx:79`) already routes through the SECURITY DEFINER RPC `public.get_shared_trip_payload(p_share_token)` (defined in migration `20260120225243_*`, granted to `anon`+`authenticated`), which validates the token server-side and returns sanitized data. Dropping the broken policies removes the leak without breaking the share page.

## Migration — single file

Drop the 4 broken policies, no replacements:

```sql
DROP POLICY IF EXISTS "Public can view shared trips by token"
  ON public.agency_trips;

DROP POLICY IF EXISTS "Anon can read suggestions for shared agency trips"
  ON public.trip_suggestions;

DROP POLICY IF EXISTS "Anon can read votes for shared agency trips"
  ON public.trip_suggestion_votes;

DROP POLICY IF EXISTS "Shared trip viewers can read chat"
  ON public.trip_chat_messages;
```

## Future-extension contract

If product later wants anon viewers of a shared trip to see suggestions / votes / chat, the only correct path is:

- Extend `get_shared_trip_payload(token)` to return them in the same payload, **or**
- Add sibling token-validating SECURITY DEFINER RPCs (e.g. `get_shared_trip_chat(p_share_token)`, `get_shared_trip_suggestions(p_share_token)`) granted to `anon`.

Never re-add direct anon table policies on `agency_trips` / `trip_suggestions` / `trip_suggestion_votes` / `trip_chat_messages`.

## Verification

After deploy:

```bash
# 1. agency_trips REST surface — must NOT return shared rows to anon
curl -s 'https://jsxplunjjvxuejeouwob.supabase.co/rest/v1/agency_trips?share_enabled=eq.true&select=*' \
  -H "apikey: <ANON_KEY>"
# expect: []

# 2. trip_chat_messages REST surface — must NOT leak chat to anon
curl -s 'https://jsxplunjjvxuejeouwob.supabase.co/rest/v1/trip_chat_messages?select=*' \
  -H "apikey: <ANON_KEY>"
# expect: [] (or auth error)
```

In-app smoke: open an existing `/trip-share/<token>` link in a logged-out browser → trip details + segments still render via `get_shared_trip_payload` RPC. Verify `TripShare.tsx` works end-to-end.

After deploy completes, mark the security finding fixed via `security--manage_security_finding` and append a memory entry under `mem://constraints/security/agency-share-token-rpc-only` documenting: anon access to shared agency trip data must go exclusively through `get_shared_trip_payload(token)` (or future sibling token-validating RPCs); never direct table policies.
