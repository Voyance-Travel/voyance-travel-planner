## Context

Audit of `trip_intents` policies showed the reported INSERT bypass (`OR user_id = auth.uid()`) **does not exist** — the current INSERT policy is already trip-owner-OR-accepted-collaborator. The real issue is an asymmetry: collaborators can INSERT but cannot SELECT/UPDATE/DELETE.

## Current policies

| cmd | rule |
|---|---|
| INSERT | owner OR accepted collaborator ✅ |
| SELECT | owner only |
| UPDATE | owner only |
| DELETE | owner only |

## Plan

### 1. Migration — extend the three lagging policies

Drop and recreate SELECT, UPDATE, DELETE on `public.trip_intents` using the same trip-owner-OR-accepted-collaborator pattern already used by INSERT. Scope all three `TO authenticated` (matches INSERT).

```sql
DROP POLICY IF EXISTS "Users can view intents for their trips"   ON public.trip_intents;
DROP POLICY IF EXISTS "Users can update intents for their trips" ON public.trip_intents;
DROP POLICY IF EXISTS "Users can delete intents for their trips" ON public.trip_intents;

CREATE POLICY "Users can view intents for their trips"
ON public.trip_intents FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.trips
          WHERE trips.id = trip_intents.trip_id AND trips.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.trip_collaborators tc
             WHERE tc.trip_id = trip_intents.trip_id
               AND tc.user_id = auth.uid()
               AND tc.accepted_at IS NOT NULL)
);

-- Same USING clause for UPDATE (with matching WITH CHECK) and DELETE.
```

UPDATE policy gets the same expression as both `USING` and `WITH CHECK` so a collaborator can't reassign `trip_id` to a trip they don't belong to.

### 2. No app-code changes

All callers already operate within proper trip scope:
- `src/contexts/TripPlannerContext.tsx` — owner saving their own trip's occasion
- `supabase/functions/itinerary-chat/index.ts` — service-role client (bypasses RLS)
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` — service-role client
- `delete-users` / `delete-my-account` — admin/self cleanup

### 3. Security memory

Mark the original "OR user_id = auth.uid() bypass" finding as not-applicable (policy was already correct on this DB) and document the new symmetric collaborator access in the same entry pattern as R4/R5/R6/R7.

### 4. Verification

- `psql \d public.trip_intents` — confirm all 4 policies share the owner-OR-collaborator pattern
- Owner can insert/select/update/delete intents on own trip → ✅
- Accepted collaborator can insert/select/update/delete intents on shared trip → ✅
- Authenticated user with no relation to trip → blocked on all 4 ops
- Pending (not-yet-accepted) collaborator → blocked
- Linter clean
