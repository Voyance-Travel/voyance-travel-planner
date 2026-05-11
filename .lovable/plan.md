# X2 — Fix `trip_intents` INSERT privilege escalation

## Problem
Current INSERT policy:
```
WITH CHECK ((EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_intents.trip_id AND trips.user_id = auth.uid())) OR (user_id = auth.uid()))
```
The `OR (user_id = auth.uid())` branch lets any authenticated user insert a row into ANY trip's intents simply by setting `user_id` to themselves. Active exploit path → injection of intents into other users' trips.

## Verification of existing policies (queried)
| cmd | policy | gate |
|---|---|---|
| SELECT | Users can view intents for their trips | trip owner only ✓ |
| INSERT | Users can insert intents for their trips | **trip owner OR self-id (broken)** |
| UPDATE | Users can update intents for their trips | trip owner only ✓ |
| DELETE | Users can delete intents for their trips | trip owner only ✓ |

Only INSERT has the broken OR. UPDATE/DELETE are already strict.

## Caller audit
| Caller | Auth context | Risk |
|---|---|---|
| `src/contexts/TripPlannerContext.tsx:413` upsert | User session, trip just created by same user | Owner branch passes — safe |
| `supabase/functions/itinerary-chat/index.ts:981` upsert | `serviceSupabase` (service role) | Bypasses RLS — safe |
| `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts:345` select | service-role client | Bypasses RLS — safe |

No legitimate caller depends on the broken OR branch.

## Migration

```sql
DROP POLICY IF EXISTS "Users can insert intents for their trips" ON public.trip_intents;

CREATE POLICY "Users can insert intents for their trips"
ON public.trip_intents
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.trips
    WHERE trips.id = trip_intents.trip_id
      AND trips.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.trip_collaborators tc
    WHERE tc.trip_id = trip_intents.trip_id
      AND tc.user_id = auth.uid()
      AND tc.accepted_at IS NOT NULL
  )
);
```

Note: scoped to `TO authenticated` (was `public`) — anon never had a path here anyway.

## Verification post-migration
1. `pg_policies` shows new WITH CHECK has no `(user_id = auth.uid())` standalone branch.
2. As user A (no relation to trip T owned by user B): insert `{trip_id: T, user_id: A, …}` → RLS error (expected).
3. As trip owner: insert succeeds.
4. As accepted collaborator: insert succeeds.
5. As pending collaborator (`accepted_at IS NULL`): insert fails (expected).
6. Linter: `trip_intents_insert_weak_check` finding clears.

## Memory
No new constraint memory needed — this is a one-off RLS tightening, not a recurring pattern. Mark security finding `trip_intents_insert_weak_check` as fixed with the migration ref.

## Out of scope (flag, do not fix here)
SELECT/UPDATE/DELETE on `trip_intents` are owner-only, but the new INSERT permits accepted collaborators. This means a collaborator can write an intent they cannot then read/update/delete via client (service-role reads in `compile-prompt.ts` still see it, so the intent still influences generation — the desired effect). If full collaborator parity is wanted later, add collaborator branches to the other three policies in a follow-up. Current behavior matches user's spec exactly.
